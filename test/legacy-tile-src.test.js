/* jshint node:true */
'use strict';

// Guard for app/utils/legacy-tile-src.js (2026-09-25): the recordings `info`
// payload must carry a tile `src` for LEGACY (`project_*`) recordings, because
// the SPA visualizer renders a server-supplied src when it cannot build a
// media-api URL (it cannot for legacy recordings: no core stream). Without it
// the SPA spectrogram renders BLACK (operator report 2026-09-25 14:51).
// Run: node test/legacy-tile-src.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function eq (label, actual, expected) {
    try { assert.deepStrictEqual(actual, expected); console.log('  ok   ' + label); pass++; }
    catch (e) { console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')'); fail++; }
}

const root = path.join(__dirname, '..');
const { attachLegacyTileSrc } = require(path.join(root, 'app/utils/legacy-tile-src.js'));
const base = '/legacy-api/project/1485-juliana-project/recordings';
const grid = () => ({ set: [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 0, j: 10 }] });

console.log('helper');
{
    const rec = { id: 54462858, uri: 'project_1992/site_24533/2021/7/20210713_020800.flac', tiles: grid() };
    eq('legacy: every tile gets a src', attachLegacyTileSrc(rec, base), 3);
    eq('legacy: route shape', rec.tiles.set.map(t => t.src), [
        base + '/tiles/54462858/0/0/t', base + '/tiles/54462858/0/1/t', base + '/tiles/54462858/0/10/t']);
}
{
    // the SPA's media-api path must stay exactly as it was: no src added
    const rec = { id: 25449232, uri: '2021/04/05/aos2q1qflsbk/x.flac', tiles: grid() };
    eq('non-legacy: untouched (0)', attachLegacyTileSrc(rec, base), 0);
    eq('non-legacy: no src key', rec.tiles.set.map(t => 'src' in t), [false, false, false]);
}
{
    // legacy-ness comes from the uri, not a `legacy` flag some loaders omit
    const rec = { id: 1, legacy: undefined, uri: 'project_5/site_9/x.wav', tiles: grid() };
    eq('uri decides, not the flag', attachLegacyTileSrc(rec, base), 3);
    const rec2 = { id: 2, legacy: true, uri: '2021/01/01/abc/x.flac', tiles: grid() };
    eq('a stray legacy flag on a stream uri does nothing', attachLegacyTileSrc(rec2, base), 0);
}
{
    eq('no tiles: no throw, 0', attachLegacyTileSrc({ id: 3, uri: 'project_1/x.flac' }, base), 0);
    eq('no base: 0', attachLegacyTileSrc({ id: 3, uri: 'project_1/x.flac', tiles: grid() }, ''), 0);
    const rec = { id: 4, uri: 'project_1/x.flac', tiles: { set: [{ i: 0, j: 0 }, { i: 'x', j: 1 }, null] } };
    eq('malformed tiles skipped', attachLegacyTileSrc(rec, base), 1);
}

console.log('route wiring (shipped source)');
{
    const src = fs.readFileSync(path.join(root, 'app/routes/data-api/project/recordings.js'), 'utf8');
    const info = src.slice(src.indexOf("case 'info'"), src.indexOf("case 'audio'"));
    eq('info case calls attachLegacyTileSrc with the imageUrl prefix', /attachLegacyTileSrc\(rec, url_comps\[1\]\)/.test(info), true);
    const call = info.indexOf('attachLegacyTileSrc(rec');
    eq('…before the payload is sent', call > -1 && call < info.indexOf('res.json(rec)'), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);