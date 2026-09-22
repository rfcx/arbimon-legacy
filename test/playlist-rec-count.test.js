/* jshint node:true */
'use strict';

// Guards for the 2026-09-22 playlists.total_recordings read path + write-plane.
// Run: node test/playlist-rec-count.test.js
//
// 1. app/model/playlist-rec-count.js is exercised with a fake execQuery that
//    records SQL and returns canned rows (no DB).
// 2. The shipped source text is asserted: playlists.find no longer emits the
//    correlated COUNT(*) for `count`, every membership-changing write path
//    calls into the maintenance module, and refreshTotalRecs writes 0 for an
//    emptied playlist.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function eq (label, actual, expected) {
    try { assert.deepStrictEqual(actual, expected); console.log('  ok   ' + label); pass++; }
    catch (e) { console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')'); fail++; }
}

const root = path.join(__dirname, '..');
const read = function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); };
const prc = require(path.join(root, 'app/model/playlist-rec-count.js'));

function fakeQuery (rowsForSelect) {
    const calls = [];
    const q = function (sql) { calls.push(sql); return Promise.resolve(/^SELECT/i.test(sql) ? rowsForSelect : { affectedRows: 1 }); };
    q.calls = calls;
    return q;
}

(async function () {
    console.log('1. playlist-rec-count module');
    eq('cleanIds drops non-positive / non-integer', prc._cleanIds([1, '2', 0, -3, 'x', 4.5, null]), [1, 2]);

    let q = fakeQuery([{ playlist_id: 10 }, { playlist_id: 11 }]);
    const pls = await prc.playlistsContaining(q, [5, 6]);
    eq('playlistsContaining queries DISTINCT playlist_id for the ids', q.calls, ['SELECT DISTINCT playlist_id FROM playlist_recordings WHERE recording_id IN (5,6)']);
    eq('playlistsContaining returns the playlist ids', pls, [10, 11]);

    q = fakeQuery([[{ playlist_id: 7 }]]); // mysql-style [rows, fields] shape
    eq('playlistsContaining accepts the [rows, fields] shape', await prc.playlistsContaining(q, [1]), [7]);

    q = fakeQuery([]);
    await prc.recount(q, [10, 11]);
    eq('recount is ONE UPDATE with a per-playlist subquery, scoped to the ids', q.calls,
        ['UPDATE playlists SET total_recordings = (SELECT COUNT(*) FROM playlist_recordings PLR WHERE PLR.playlist_id = playlists.playlist_id) WHERE playlist_id IN (10,11)']);
    q = fakeQuery([]);
    await prc.recount(q, []);
    eq('recount with no ids issues nothing', q.calls, []);
    q = fakeQuery([]);
    eq('playlistsContaining with no ids issues nothing', await prc.playlistsContaining(q, []), []);
    eq('  ... and no SQL', q.calls, []);

    q = fakeQuery([{ playlist_id: 3 }]);
    const touched = await prc.removeRecordingsAndRecount(q, [9, 8]);
    eq('removeRecordingsAndRecount: find -> DELETE -> recount, in that order, same connection', q.calls, [
        'SELECT DISTINCT playlist_id FROM playlist_recordings WHERE recording_id IN (9,8)',
        'DELETE FROM playlist_recordings WHERE recording_id IN (9,8)',
        'UPDATE playlists SET total_recordings = (SELECT COUNT(*) FROM playlist_recordings PLR WHERE PLR.playlist_id = playlists.playlist_id) WHERE playlist_id IN (3)'
    ]);
    eq('  returns the touched playlist ids', touched, [3]);
    q = fakeQuery([]);
    await prc.removeRecordingsAndRecount(q, [9]);
    eq('removeRecordingsAndRecount with no containing playlist still DELETEs, skips the recount', q.calls, [
        'SELECT DISTINCT playlist_id FROM playlist_recordings WHERE recording_id IN (9)',
        'DELETE FROM playlist_recordings WHERE recording_id IN (9)'
    ]);
    eq('module never touches rec_count_updated_at (that is the sites plane)', /rec_count_updated_at/.test(read('app/model/playlist-rec-count.js')), false);

    console.log('2. shipped read path');
    const pl = read('app/model/playlists.js');
    const findFn = pl.slice(pl.indexOf('find: function (query, options, callback)'), pl.indexOf('getInfo: function'));
    eq('find(): count comes from PL.total_recordings', /projection\.push\("PL\.total_recordings as count"\)/.test(findFn), true);
    eq('find(): the correlated COUNT(*) projection is gone', /SELECT COUNT\(\*\) FROM playlist_recordings PLR WHERE PL\.playlist_id = PLR\.playlist_id/.test(findFn), false);

    console.log('3. shipped write plane');
    const refresh = pl.slice(pl.indexOf('refreshTotalRecs: async function'), pl.indexOf('findRecordingsPlaylists: function'));
    eq('refreshTotalRecs writes 0 when the playlist is now empty (no early return on null)', /total === null \? 0 : total/.test(refresh) && !/if \(total === null\) \{\s*return/.test(refresh), true);
    const rec = read('app/model/recordings.js');
    eq('recordings.removeArchivedFromPlaylists delegates to removeRecordingsAndRecount', /removeArchivedFromPlaylists: async function\(recIds, query\) \{[\s\S]*?playlistRecCount\.removeRecordingsAndRecount\(query, ids\)/.test(rec), true);
    eq('recordings.js has no bare DELETE FROM playlist_recordings left', /DELETE FROM playlist_recordings/.test(rec), false);
    const sites = read('app/model/sites.js');
    eq('sites.archiveRecordingsBySite delegates to removeRecordingsAndRecount', /playlistRecCount\.removeRecordingsAndRecount\(executeQuery, recIds\)/.test(sites), true);
    eq('sites.js has no bare DELETE FROM playlist_recordings left', /DELETE FROM playlist_recordings/.test(sites), false);
    const ss = read('app/model/soundscapes.js');
    eq('soundscapes region-sample insert recounts its playlist in the same transaction', /ON CONFLICT \(playlist_id, recording_id\) DO NOTHING[\s\S]{0,900}playlistRecCount\.recount\(/.test(ss), true);
    // the create/combine paths already maintained the column; pin that they still do
    eq('playlists.create sets total_recordings from the insert', /UPDATE playlists SET total_recordings = \?, status = \? WHERE playlist_id = \?',\s*\[totalInserted, status\.CREATED, playlistId\]/.test(pl), true);
    eq('playlists.combine refreshes after eval', /await Playlists\.refreshTotalRecs\(newPlaylistId\)/.test(pl), true);

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });