// sites.rec_count event-driven maintenance (rfcx-local DESIGN-2026-09-16, step S2).
//
// WHAT IS PINNED HERE, and why each matters:
//  1. Per-site aggregation of an interleaved batch -> ONE UPDATE per site, with
//     +n, LEAST(min), GREATEST(max). The ingest batch CAN interleave sites
//     (insertBatch builds recs.map(...) in request order), so a per-row or
//     single-site assumption would miscount.
//  2. THE INVARIANT: no SQL this module emits may mention rec_count_updated_at.
//     That column is the backfill's completion marker (S3) and the read path's
//     trust signal (S4). S2 ships BEFORE S3, so stamping it here would erase the
//     flag that tells S4 a never-backfilled site is not yet trustworthy.
//  3. Archive decrements by the UPDATE's affectedRows, never below 0, and
//     REFUSES a missing site_id (the design's "derive site from rows changed"
//     guard, expressed as a required parameter because both callers hold it).
//  4. Source-level: the FOUR live write sites in recordings.js / sites.js
//     (the browser-facing recordings.delete() was MISSED by the first
//     enumeration and caught during S2's acceptance pass -- pinned here so it
//     cannot silently regress)
//     actually call into this module, and the old autocommit shape is gone.
//
// NEGATIVE CONTROL: with the helper stubbed to emit a rec_count_updated_at
// write, test 2 goes RED (verified while writing this file). With the wiring
// reverted in recordings.js, test 4 goes RED.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = require(path.join(__dirname, '..', 'app', 'model', 'site-rec-count.js'));
const recordingsSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'recordings.js'), 'utf8');
const sitesSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'sites.js'), 'utf8');

// A fake execQuery that records every (sql, params) it is handed.
function recorder() {
    const calls = [];
    const fn = (sql, params) => { calls.push({ sql, params }); return Promise.resolve({ affectedRows: 1 }); };
    fn.calls = calls;
    return fn;
}

describe('site-rec-count — aggregateBySite', function () {
    it('groups an INTERLEAVED batch by site with n / min / max', function () {
        const aggs = src.aggregateBySite([
            { site_id: 7, datetime: '2026-09-01 10:00:00' },
            { site_id: 9, datetime: '2026-09-02 10:00:00' },
            { site_id: 7, datetime: '2026-08-30 09:00:00' },   // earlier -> new min for 7
            { site_id: 7, datetime: '2026-09-05 12:00:00' },   // later   -> new max for 7
            { site_id: 9, datetime: '2026-09-01 08:00:00' }
        ]).sort((a, b) => a.site_id - b.site_id);
        assert.deepStrictEqual(aggs, [
            { site_id: 7, n: 3, min_dt: '2026-08-30 09:00:00', max_dt: '2026-09-05 12:00:00' },
            { site_id: 9, n: 2, min_dt: '2026-09-01 08:00:00', max_dt: '2026-09-02 10:00:00' }
        ]);
    });

    it('ignores rows without a usable site_id and tolerates missing datetimes', function () {
        const aggs = src.aggregateBySite([
            { site_id: 3, datetime: null }, { site_id: 3 }, { datetime: 'x' }, { site_id: 'abc' }
        ]);
        assert.deepStrictEqual(aggs, [{ site_id: 3, n: 2, min_dt: null, max_dt: null }]);
    });
});

describe('site-rec-count — bumpForInsertedRows', function () {
    it('emits exactly ONE UPDATE per site, never per row', async function () {
        const exec = recorder();
        await src.bumpForInsertedRows(exec, [
            { site_id: 1, datetime: 'a' }, { site_id: 2, datetime: 'b' }, { site_id: 1, datetime: 'c' }
        ]);
        assert.strictEqual(exec.calls.length, 2, 'expected 2 UPDATEs for 2 sites, got ' + exec.calls.length);
        exec.calls.forEach(c => assert.ok(/^UPDATE sites SET/.test(c.sql), c.sql));
    });

    it('increments by n and uses LEAST/GREATEST with COALESCE (so a NULL range does not wipe the value)', async function () {
        const exec = recorder();
        await src.bumpForInsertedRows(exec, [{ site_id: 5, datetime: 'd1' }, { site_id: 5, datetime: 'd2' }]);
        const c = exec.calls[0];
        assert.ok(/rec_count = rec_count \+ \?/.test(c.sql), c.sql);
        assert.ok(/LEAST\(COALESCE\(first_recording_at, \?\), \?\)/.test(c.sql), c.sql);
        assert.ok(/GREATEST\(COALESCE\(last_recording_at, \?\), \?\)/.test(c.sql), c.sql);
        assert.deepStrictEqual(c.params, [2, 'd1', 'd1', 'd2', 'd2', 5]);
    });

    it('THE INVARIANT: never mentions rec_count_updated_at (S3 owns it; S4 trusts it)', async function () {
        const exec = recorder();
        await src.bumpForInsertedRows(exec, [{ site_id: 1, datetime: 'a' }]);
        await src.decrementForArchive(exec, 1, 1);
        exec.calls.forEach(c => assert.ok(!/rec_count_updated_at/.test(c.sql),
            'write path touched the trust flag: ' + c.sql));
        // and the module SOURCE must not either (a literal string check catches a
        // future edit that adds it in a code path these calls do not exercise)
        const helperSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'site-rec-count.js'), 'utf8');
        const codeOnly = helperSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        assert.ok(!/rec_count_updated_at/.test(codeOnly), 'helper CODE mentions rec_count_updated_at');
    });
});

describe('site-rec-count — decrementForArchive', function () {
    it('decrements by the affectedRows it is given, floored at 0 in SQL', async function () {
        const exec = recorder();
        await src.decrementForArchive(exec, 42, 3);
        assert.strictEqual(exec.calls.length, 1);
        assert.ok(/GREATEST\(rec_count - \?, 0\)/.test(exec.calls[0].sql), exec.calls[0].sql);
        assert.deepStrictEqual(exec.calls[0].params, [3, 42]);
    });

    it('is a no-op when nothing was actually archived (affectedRows 0)', async function () {
        const exec = recorder();
        await src.decrementForArchive(exec, 42, 0);
        assert.strictEqual(exec.calls.length, 0);
    });

    it('REFUSES a missing / non-numeric site_id instead of guessing', async function () {
        const exec = recorder();
        await assert.rejects(() => src.decrementForArchive(exec, undefined, 1), /requires a numeric site_id/);
        await assert.rejects(() => src.decrementForArchive(exec, 'abc', 1), /requires a numeric site_id/);
        assert.strictEqual(exec.calls.length, 0);
    });
});

describe('site-rec-count — decrementForArchivedRows (the multi-site browser delete path)', function () {
    it('groups the about-to-flip rows by site and emits one decrement per site', async function () {
        const exec = recorder();
        await src.decrementForArchivedRows(exec, [
            { site_id: 10 }, { site_id: 11 }, { site_id: 10 }, { site_id: 10 }
        ]);
        const bySite = {};
        exec.calls.forEach(c => { bySite[c.params[1]] = c.params[0]; });
        assert.deepStrictEqual(bySite, { 10: 3, 11: 1 });
        assert.strictEqual(exec.calls.length, 2);
    });

    it('decrements by NOTHING for an empty active set (all ids already archived)', async function () {
        const exec = recorder();
        await src.decrementForArchivedRows(exec, []);
        assert.strictEqual(exec.calls.length, 0);
    });

    it('never mentions rec_count_updated_at', async function () {
        const exec = recorder();
        await src.decrementForArchivedRows(exec, [{ site_id: 1 }]);
        exec.calls.forEach(c => assert.ok(!/rec_count_updated_at/.test(c.sql), c.sql));
    });
});

describe('site-rec-count — the FOUR live write sites are wired (the fourth was missed by the first enumeration)', function () {
    it('recordings.delete() selects the still-active subset BEFORE archiving and decrements from it', function () {
        const i = recordingsSrc.indexOf('delete: async function(recs, project_id, token, callback, archivedBy)');
        assert.ok(i > 0, 'delete() not found');
        const body = recordingsSrc.slice(i, i + 4000);
        const sel = body.indexOf('archived_at IS NULL`)');
        const arch = body.indexOf('archiveRecordingsInArbimon(recIds, archivedBy, query)');
        const dec = body.indexOf('siteRecCount.decrementForArchivedRows(query, activeRows)');
        assert.ok(sel > 0 && arch > 0 && dec > 0, 'delete() is not wired');
        // ORDER MATTERS: the active-subset SELECT must precede the archive UPDATE
        // (else it reads zero rows and never decrements), and the decrement must
        // follow the archive (same tx, same snapshot either way, but this order
        // is what the comment promises).
        assert.ok(sel < arch, 'active-subset SELECT must run BEFORE the archive UPDATE');
        assert.ok(arch < dec, 'decrement must follow the archive UPDATE');
    });
});

describe('site-rec-count — the three live write sites are wired', function () {
    it('recordings.insertBatch and insert route through the transactional runner', function () {
        assert.ok(/_insertWithRecCount\(/.test(recordingsSrc), 'runner missing');
        // the old autocommit shape is GONE for both insert paths
        const autocommitInsert = /queryHandler\('INSERT INTO recordings \(/g;
        assert.strictEqual((recordingsSrc.match(autocommitInsert) || []).length, 0,
            'an autocommit INSERT INTO recordings survived — it would bypass the counter');
        // and the runner does the bump inside the transaction
        assert.ok(/siteRecCount\.bumpForInsertedRows\(/.test(recordingsSrc));
        assert.ok(/new sqlutil\.transaction\(connection\)/.test(recordingsSrc));
    });

    it('recordings.archiveBySiteAndUris decrements by affectedRows inside a transaction', function () {
        const i = recordingsSrc.indexOf('archiveBySiteAndUris: async function');
        const body = recordingsSrc.slice(i, i + 1600);
        assert.ok(/siteRecCount\.decrementForArchive\(execQuery, site_id, n\)/.test(body), body.slice(0, 300));
        assert.ok(/affectedRows/.test(body));
        assert.ok(/sqlutil\.transaction/.test(body));
    });

    it('sites.archiveRecordingsBySite requires site_id and decrements by affectedRows', function () {
        assert.ok(/archiveRecordingsBySite: async function\(recIds, connection, site_id\)/.test(sitesSrc));
        assert.ok(/site_id is required/.test(sitesSrc));
        assert.ok(/siteRecCount\.decrementForArchive\(executeQuery, site_id, n\)/.test(sitesSrc));
        // the caller passes it
        assert.ok(/archiveRecordingsBySite\(recIds, db, site_id\)/.test(sitesSrc), 'caller does not pass site_id');
    });
});