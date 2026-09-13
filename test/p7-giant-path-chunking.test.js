/**
 * P7 POST-FLIP — the GIANT (> MAX_SITES) count paths must CHUNK, not run one
 * mega-statement.
 *
 * THE DEFECT (measured live 2026-09-12, post-flip):
 * `puerto-rico-island-wide` (950 sites, 11.2 M recordings) 500s on EVERY load
 * of `GET /legacy-api/project/<slug>/sites?count=true&…`:
 *   Response Time: 8055 / 8058 / 8062 / 8072 / 8185 / 8350 ms -> 500
 * because the >MAX_SITES carve-out of the 2026-09-12 per-site fan-out kept the
 * historical SINGLE statement: 950 sites x 3 correlated subplans over the
 * 142 GB `recordings` table. Measured on the LEADER, warm: 7,704 ms — i.e. it
 * sits just under the 8,000 ms routed-read statement_timeout, so ordinary
 * app-side overhead pushes the round trip over it, PG cancels with 57014
 * (`pg_route_timeout` hashes ae287941… for the sites leg / 04e1b3d8… for the
 * countProjectRecordings leg), and post-flip there is no MariaDB fail-open
 * left to hide it. On a cold replica the same statement exceeded 25 s.
 *
 * Chunking is what actually fixes it, and the margin is ~100x rather than
 * marginal: on the leader a 50-site chunk of the same statement (114,582 rows)
 * runs in 63.6 ms, and the project's single biggest site (361,036 rows) in
 * 178.5 ms. Exactness is untouched: the per-site SQL text is unchanged, only
 * the IN list is batched, and rows merge by site_id.
 *
 * NEGATIVE CONTROL: the chunking assertions FAIL against the pre-fix tree,
 * where >MAX_SITES took `runOne(siteIds)` / `return null` (one statement).
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var persiteCount = require('../app/utils/persite-count');

describe('giant-path chunk runner', function () {

    it('exposes a giant chunk size that fits the routed-read budget', function () {
        assert.ok(persiteCount.GIANT_CHUNK_SIZE > 0, 'no GIANT_CHUNK_SIZE');
        assert.ok(persiteCount.GIANT_CHUNK_SIZE <= persiteCount.PERSITE_COUNT_MAX_SITES,
            'a chunk must be smaller than the giant threshold or it is not a chunk');
        // Sized by the WORST chunk, not the average (measured on the leader):
        //   50 -> max 4,734 ms (1.7x margin) | 25 -> 4,692 ms | 10 -> 2,344 ms (3.4x)
        // Total work is ~8.0 s at every size, so the small chunk is free margin.
        assert.strictEqual(persiteCount.GIANT_CHUNK_SIZE, 10);
        // Guard the PROPERTY, not just the constant: the worst observed chunk
        // must leave real head-room under the 8 s routed-read budget.
        assert.ok(persiteCount.GIANT_CHUNK_SIZE <= 25,
            'a larger chunk concentrates the giant sites and erodes the timeout margin');
        // keep concurrency modest: the routed pool is shared (PG_POOL_MAX=20)
        assert.ok(persiteCount.GIANT_CHUNK_CAP >= 1 && persiteCount.GIANT_CHUNK_CAP <= 4);
    });

    it('splits ids into fixed-size chunks, order preserved, remainder last', function () {
        var ids = [];
        for (var i = 1; i <= 125; i++) { ids.push(i); }
        var chunks = persiteCount.chunkIds(ids, 50);
        assert.strictEqual(chunks.length, 3);
        assert.strictEqual(chunks[0].length, 50);
        assert.strictEqual(chunks[1].length, 50);
        assert.strictEqual(chunks[2].length, 25);
        // and at the shipped default
        assert.strictEqual(persiteCount.chunkIds(ids, persiteCount.GIANT_CHUNK_SIZE).length,
            Math.ceil(125 / persiteCount.GIANT_CHUNK_SIZE));
        assert.deepStrictEqual([].concat(chunks[0], chunks[1], chunks[2]), ids,
            'chunking must be a partition: same ids, same order, none lost or duplicated');
    });

    it('runs CEIL(n/size) statements for a 950-site giant — not one', async function () {
        var ids = [];
        for (var i = 0; i < 950; i++) { ids.push(8412 + i); }
        var statements = [];
        await persiteCount.runInChunks(ids, async function (chunkIds) {
            statements.push(chunkIds);
            return [];
        });
        assert.strictEqual(statements.length, Math.ceil(950 / persiteCount.GIANT_CHUNK_SIZE),
            'expected one statement per chunk (95 for 950 sites at 10/chunk)');
        // every statement is bounded — this is the whole point of the fix
        statements.forEach(function (s) {
            assert.ok(s.length <= persiteCount.GIANT_CHUNK_SIZE,
                'a chunk exceeded GIANT_CHUNK_SIZE: ' + s.length);
        });
        // and the union of the chunks is exactly the input set (no site dropped)
        var seen = [].concat.apply([], statements);
        assert.strictEqual(seen.length, 950);
        assert.deepStrictEqual(seen, ids);
    });

    it('merges per-chunk rows correctly (counts are summed across chunks, not overwritten)', async function () {
        var ids = [1, 2, 3, 4, 5];
        var perChunk = await persiteCount.runInChunks(ids, async function (chunkIds) {
            return chunkIds.map(function (id) { return { site_id: id, n: id * 10 }; });
        }, { size: 2 });
        var flat = [];
        perChunk.forEach(function (rows) { flat.push.apply(flat, rows || []); });
        assert.strictEqual(flat.length, 5, 'every site must appear exactly once after the merge');
        var total = flat.reduce(function (a, r) { return a + r.n; }, 0);
        assert.strictEqual(total, 150, '10+20+30+40+50 — merged, not clobbered');
        assert.deepStrictEqual(flat.map(function (r) { return r.site_id; }), ids);
    });

    it('respects the chunk concurrency cap', async function () {
        var ids = [];
        for (var i = 0; i < 400; i++) { ids.push(i + 1); }
        var live = 0, maxLive = 0;
        await persiteCount.runInChunks(ids, async function () {
            live++; if (live > maxLive) { maxLive = live; }
            await new Promise(function (r) { setTimeout(r, 3); });
            live--;
            return [];
        });
        assert.ok(maxLive <= persiteCount.GIANT_CHUNK_CAP,
            'chunk concurrency ' + maxLive + ' exceeded cap ' + persiteCount.GIANT_CHUNK_CAP);
    });

    it('propagates a chunk failure rather than silently returning partial counts', async function () {
        var threw = null;
        try {
            await persiteCount.runInChunks([1, 2, 3, 4], async function (chunkIds) {
                if (chunkIds[0] === 3) { throw new Error('57014'); }
                return [];
            }, { size: 2 });
        } catch (e) { threw = e; }
        assert.ok(threw && /57014/.test(threw.message),
            'a cancelled chunk must surface — a partial count is a WRONG count');
    });

    it('drops non-integer ids the same way the per-site runner does', async function () {
        var seen = [];
        await persiteCount.runInChunks(['10', 'x; DROP TABLE recordings', 12], async function (c) {
            seen.push(c);
            return [];
        }, { size: 10 });
        assert.deepStrictEqual(seen, [[10, 12]]);
    });
});

// ------------------------------------------------------------- source guards
// The runner above is generic; these pin that the two GIANT call sites actually
// USE it. Both fail against the pre-fix tree.
describe('giant call sites use the chunk runner', function () {
    function srcOf(rel) {
        var text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
        // strip comment lines so a rationale comment cannot satisfy a guard
        return text.split('\n').filter(function (l) {
            return !/^\s*(\/\/|\*|\/\*)/.test(l);
        }).join('\n');
    }

    it('projects.getProjectSites chunks the >MAX_SITES rec_count path', function () {
        var src = srcOf('app/model/projects.js');
        assert.ok(/siteIds\.length > persiteCount\.PERSITE_COUNT_MAX_SITES/.test(src),
            'the giant branch disappeared');
        assert.ok(/persiteCount\.runInChunks\(siteIds/.test(src),
            'the giant branch does not use runInChunks');
        assert.ok(!/return runOne\(siteIds\)\.then\(applyRows\)/.test(src),
            'the single mega-statement giant path is still present (the defect)');
    });

    it('recordings.countProjectRecordings chunks the >MAX_SITES path instead of falling back', function () {
        var src = srcOf('app/model/recordings.js');
        assert.ok(/persiteCount\.runInChunks\(/.test(src),
            'countProjectRecordings does not chunk the giant path');
        assert.ok(!/if \(siteRows\.length > persiteCount\.PERSITE_COUNT_MAX_SITES\) \{ return null; \}/.test(src),
            'the giant path still bails out to the single grouped statement (the defect)');
    });

    it('keeps the sites-BY-site_id selection (imported sites must keep their counts)', function () {
        var src = srcOf('app/model/projects.js');
        assert.ok(/FROM sites s \"\s*\+\s*\n?\s*\"WHERE s\.site_id IN \(\?\)/.test(src) ||
                  /WHERE s\.site_id IN \(\?\)/.test(src),
            're-filtering by project_id would silently zero imported sites');
    });
});