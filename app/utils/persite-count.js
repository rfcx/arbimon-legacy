/**
 * Per-site COUNT fan-out for the recordings COUNT shapes (2026-09-12, P7
 * pre-flip read-timeout sweep — item 2).
 *
 * Standalone + dependency-injected so it is unit-testable without booting the
 * app's DB pool (same pattern as date-range-fastpath.js / persite-sort.js).
 *
 * THE PROBLEM
 * -----------
 * The exact "active recordings" count for a project is one aggregate statement
 * over ALL of the project's rows (COUNT over `site_id IN (...)` /
 * `JOIN sites ... project_id = ?`, plus the sites list's per-site
 * `COUNT(*) … archived_at IS NULL` leg). Row visits on PG are heap-scattered
 * (mashpi's 1.86 M rows span 223 k heap pages of the 141 GB table), so the
 * statement is I/O-bound and blows the 8 s routed-read statement_timeout
 * whenever the project's pages are cold: measured >25 s cold / 2.27 s warm on
 * the leader for mashpi (20 sites, 1.86 M recs); the JOIN form
 * (`totalRecordings`, the cached-metrics fill) is 8.7 s even WARM (nested-loop
 * plan off a rows=4 estimate). On MariaDB the same count is a covering
 * secondary-index scan and returns in <1 s — so today every one of these is a
 * deterministic fail-open (pg_route_timeout hashes `ae287941…` (89/24 h,
 * sites-list rec_count leg), `dae78d5b…` (36/24 h, /search count output),
 * `cf1aae07…` (7/24 h, the totalRecordings fill)). At P7 the fallback target
 * disappears and each becomes a user-facing error.
 *
 * THE SHAPE
 * ---------
 * Run the count as ONE BOUNDED STATEMENT PER SITE, a few at a time, and sum /
 * merge app-side. Each statement visits one site's rows (mashpi's largest site
 * = 650,898 rows = 491.9 ms warm on the leader), so every statement fits its
 * own 8 s budget — the aggregate wall time no longer matters to the timeout.
 * A per-site statement that still times out (a multi-million-row COLD site)
 * fails open to MariaDB on its own, exactly like today — per-statement, not
 * whole-request. Exactness is preserved: recording_id is unique per row, each
 * row belongs to exactly one site, and the site list is unchanged, so
 * SUM(per-site counts) == the single-statement count (verified live on mashpi:
 * per-site counts sum to 1,863,381 == the measured IN-list count).
 *
 * This is the app-level, dual-dialect fix — identical SQL on MariaDB and PG,
 * no new index (a covering/partial index over 306 M rows is the rejected
 * #1859-F5 / §297 class: hours of CIC I/O + WAL on the leader).
 *
 * GATES: the fan-out is for MID-size projects. Giants (> MAX_SITES sites) keep
 * the single-statement shape (the accepted ae28 residual — 950 sites of
 * fan-out would be ~200 sequential rounds; their unfiltered counts are served
 * by the cached_metrics tier added in the same PR).
 * Concurrency is capped so a fan-out cannot monopolise the routed-read pool
 * (PG_POOL_MAX=20): CAP=4 keeps a page load to <=4 concurrent reads.
 */

var DEFAULT_CAP = 4;
var MAX_SITES = 200;

// GIANT-PATH CHUNKING (2026-09-12, post-flip): projects with > MAX_SITES
// sites used to keep the historical single-statement shape (the "accepted
// ae28 residual" of the fan-out PR). Post-flip there is no fail-open target,
// and the mega-statement (950 sites x 3 correlated subplans over the 142 GB
// `recordings` table) straddles the 8 s routed-read statement_timeout:
// measured 7,704 ms direct on the leader (warm), 8,055-8,350 ms through the
// app -> cancel -> a user-facing 500 on every attempt of the sites page
// (pg_route_timeout hashes ae287941... / 04e1b3d8...). Run the SAME statement
// in fixed-size chunks of site ids instead, a couple at a time: each chunk
// fits the budget with ~100x margin (measured on the leader: 50 sites /
// 114k rows = 63.6 ms warm; the single biggest site (361k rows) = 178.5 ms),
// and rows merge app-side by site_id exactly like the per-site fan-out.
// Exactness is unchanged: the per-site SQL text is untouched, only the IN
// list is batched; every site's subplan is independent of every other site.
//
// SIZING IS SET BY THE WORST CHUNK, NOT THE AVERAGE (measured on the leader,
// 2026-09-12 — the first pass of this fix used 50 because the AVERAGE chunk was
// 63 ms, which is the wrong statistic). This project's rows are heavily skewed:
// a handful of sites hold 361k/342k/331k/325k/313k/307k recordings each, so
// whichever chunk catches several of them sets the worst case:
//     size 50 -> 19 statements, MAX 4,734 ms  (1.7x margin on the 8 s budget)
//     size 25 -> 39 statements, MAX 4,692 ms  (1.7x)
//     size 10 -> 96 statements, MAX 2,344 ms  (3.4x)
// Total work is ~8.0 s in all three (same rows, same plans; 8,097 ms at size 10
// vs 7,998 ms at size 25), so the smaller chunk buys margin essentially for
// free. 1.7x is not enough head-room for a cold buffer cache — the same
// statement measured >25 s cold on the replica — hence 10.
var GIANT_CHUNK_SIZE = 10;
var GIANT_CHUNK_CAP = 2;

function toIntIds(siteIds) {
    return (siteIds || []).map(function (s) { return parseInt(s, 10); })
        .filter(function (s) { return Number.isFinite(s); });
}

/**
 * Run `sqlForSite(siteId)` for each site id with bounded concurrency.
 * @param {Array}    siteIds
 * @param {Function} sqlForSite  - (siteId:int) => sql string
 * @param {Function} runQuery    - (sql:string) => Promise<rows>
 * @param {Object}   opts        - { cap }
 * @return {Promise<Array>} array of per-site row-arrays, in the input order of
 *                          siteIds (NOT flattened — a site whose query returns
 *                          zero rows must not shift the alignment)
 */
async function runPerSite(siteIds, sqlForSite, runQuery, opts) {
    var ids = toIntIds(siteIds);
    var cap = (opts && opts.cap) || DEFAULT_CAP;
    var results = new Array(ids.length);
    var next = 0;
    async function worker() {
        while (next < ids.length) {
            var i = next++;
            results[i] = await runQuery(sqlForSite(ids[i]));
        }
    }
    var workers = [];
    for (var w = 0; w < Math.min(cap, ids.length); w++) { workers.push(worker()); }
    await Promise.all(workers);
    return results;
}

/** Split an id list into fixed-size chunks (order preserved). */
function chunkIds(ids, size) {
    var out = [];
    for (var i = 0; i < ids.length; i += size) { out.push(ids.slice(i, i + size)); }
    return out;
}

/**
 * Giant-path variant of runPerSite: run `runQuery(chunkIds)` per fixed-size
 * chunk of the site list, `cap` chunks in flight, and return the per-chunk
 * row-arrays in chunk order (NOT flattened — the caller merges by site_id,
 * so chunk alignment does not matter, but a zero-row chunk must not shift
 * anything for callers that do align).
 * @param {Array}    siteIds
 * @param {Function} runQuery - (chunkIds:int[]) => Promise<rows>
 * @param {Object}   opts     - { size, cap }
 */
async function runInChunks(siteIds, runQuery, opts) {
    var ids = toIntIds(siteIds);
    var size = (opts && opts.size) || GIANT_CHUNK_SIZE;
    var cap = (opts && opts.cap) || GIANT_CHUNK_CAP;
    var chunks = chunkIds(ids, size);
    // runPerSite coerces its first argument through toIntIds, which would
    // mangle array elements — so iterate chunk INDEXES and look the chunk up
    // in sqlForSite (which, for this runner, returns the id batch itself).
    var perChunk = await runPerSite(chunks.map(function (c, i) { return i; }),
        function (i) { return chunks[i]; },
        runQuery, { cap: cap });
    return perChunk;
}

module.exports = {
    runPerSite: runPerSite,
    runInChunks: runInChunks,
    chunkIds: chunkIds,
    PERSITE_COUNT_CAP: DEFAULT_CAP,
    PERSITE_COUNT_MAX_SITES: MAX_SITES,
    GIANT_CHUNK_SIZE: GIANT_CHUNK_SIZE,
    GIANT_CHUNK_CAP: GIANT_CHUNK_CAP
};
