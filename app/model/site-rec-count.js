/**
 * Event-driven maintenance of the per-site recording counters on `sites`
 * (rfcx-local DESIGN-2026-09-16-rec-count-event-driven-cache, step S2).
 *
 * WHAT THIS IS
 * ------------
 * `sites.rec_count`, `sites.first_recording_at`, `sites.last_recording_at` are
 * a WRITE-PATH-maintained cache of the three correlated subqueries the sites
 * list used to run per site (`projects.js getProjectSites`, translator hash
 * ae28794138b7d016). Those subqueries are I/O-bound against a 225 GB
 * `recordings` table that can never be fully resident in 24 GB of
 * shared_buffers: measured >8 s cold (cancelled at the routed-read
 * statement_timeout) vs 214 ms warm for the SAME statement, same plan, same
 * index. No index fixes cold I/O; a longer bound was ruled out (§300-G).
 * Maintaining the value at write time makes the read a column fetch.
 *
 * THE CONTRACT (operator ruling 2026-09-16 00:17 + 00:24)
 * -------------------------------------------------------
 * "Be correct on every write this code can see." That is ALL. There are
 * exactly three count-changing write paths in the codebase (recordings
 * INSERT; `archived_at` NULL -> NOW() from two archive callers; nothing
 * else -- ingest-service, rfcx-api and arbimon-jobs do not write
 * `recordings`, and all four arbimon sync CronJobs are suspended), and each
 * of them calls into here INSIDE ITS OWN TRANSACTION. Drift from writes this
 * code cannot see (manual DML, a future un-suspended sync cron, a missed
 * event) is explicitly NOT this module's job: a separate background REPAIR
 * plane owns it, designed as its own session. So this module has NO TTL and
 * NO self-heal, on purpose. If you are tempted to add one, read the ruling.
 *
 * THE ONE COLUMN THIS MODULE MUST NEVER TOUCH: `rec_count_updated_at`.
 * ----------------------------------------------------------------------
 * It is the BACKFILL's completion marker (design step S3) and the read
 * path's TRUST SIGNAL (step S4). S2 (this code) ships BEFORE S3 by design, so
 * on a never-backfilled site an increment yields `0 + n` -- a number that is
 * wrong by the site's entire history -- and stamping `rec_count_updated_at`
 * here would erase the exact flag S4 uses to know that row is not yet
 * trustworthy. Only S3 (and later the repair plane) may set it. The tests
 * pin this: every SQL string this module emits is asserted NOT to mention it.
 *
 * WHY THE ARCHIVE SIDE LEAVES first/last ALONE
 * --------------------------------------------
 * On insert, `LEAST`/`GREATEST` keep the range exact for free. On archive the
 * range can only SHRINK, and computing the new min/max needs a scan of the
 * site's remaining rows -- the very cold read this cache exists to avoid. So
 * archive decrements the count and leaves the range untouched; it may read a
 * little too WIDE after a deletion until the repair plane tightens it. Stated
 * in the design (D2) and accepted.
 *
 * WHY site_id IS A REQUIRED ARGUMENT ON THE ARCHIVE PATH
 * ------------------------------------------------------
 * Both archive callers already know the single site they are acting on
 * (`ingest.js` resolves `site` first; `softRemoveAllSites` iterates
 * `for (site_id of siteIds)` and archives one site's ids per call). Making it
 * a required parameter turns "caller passed a mixed-site id list" into a
 * programming error at the call site rather than a silent miscount. The
 * decrement uses the UPDATE's own `affectedRows` -- the count of rows that
 * actually flipped from NULL -> archived_at -- so re-archiving an already
 * archived row (affectedRows 0) correctly decrements by 0.
 *
 * Dependency-injected (`execQuery`) so it is unit-testable without booting
 * the app's DB pool -- same pattern as persite-count.js / date-range-fastpath.js.
 */
'use strict';

/**
 * Group a batch of about-to-be-inserted recording rows by site and return one
 * aggregate per site: { site_id, n, min_dt, max_dt }. `datetime` is the
 * site-local timestamp the app stores in `recordings.datetime`, which is the
 * column the old subqueries ordered by, so first/last stay comparable.
 *
 * Pure. Exported for tests.
 */
function aggregateBySite(recs) {
    var bySite = {};
    (recs || []).forEach(function (rec) {
        if (!rec || rec.site_id === undefined || rec.site_id === null) { return; }
        var sid = Number(rec.site_id);
        if (!Number.isFinite(sid)) { return; }
        var agg = bySite[sid] || (bySite[sid] = { site_id: sid, n: 0, min_dt: null, max_dt: null });
        agg.n += 1;
        var dt = rec.datetime;
        if (dt !== undefined && dt !== null && dt !== '') {
            if (agg.min_dt === null || dt < agg.min_dt) { agg.min_dt = dt; }
            if (agg.max_dt === null || dt > agg.max_dt) { agg.max_dt = dt; }
        }
    });
    return Object.keys(bySite).map(function (k) { return bySite[k]; });
}

/**
 * After inserting `recs` (inside the SAME transaction), bump each affected
 * site's counters. One UPDATE per site per batch -- never per row.
 *
 * @param {Function} execQuery  (sql, params) -> Promise  -- MUST run on the
 *                              transaction's connection.
 * @param {Array}    recs       the rows that were just inserted.
 * @returns {Promise}
 */
function bumpForInsertedRows(execQuery, recs) {
    return applyBump(execQuery, aggregateBySite(recs));
}

/**
 * The shared +n / widen-range write, used by BOTH row-adding paths (insert and
 * restore). One UPDATE per site, never per row.
 */
function applyBump(execQuery, aggs) {
    var p = Promise.resolve();
    aggs.forEach(function (a) {
        p = p.then(function () {
            // COALESCE handles the never-backfilled / no-recordings case where
            // first/last are NULL: LEAST(NULL, x) is NULL in SQL, which would
            // wipe the incoming value.
            return execQuery(
                'UPDATE sites SET ' +
                '  rec_count = rec_count + ?, ' +
                '  first_recording_at = LEAST(COALESCE(first_recording_at, ?), ?), ' +
                '  last_recording_at  = GREATEST(COALESCE(last_recording_at, ?), ?) ' +
                'WHERE site_id = ?',
                [a.n, a.min_dt, a.min_dt, a.max_dt, a.max_dt, a.site_id]
            );
        });
    });
    return p;
}

/**
 * After RESTORING rows (un-archiving them) inside the SAME transaction, add
 * them back to their sites' counters.
 *
 * WHY THIS EXISTS (rfcx-local OPEN-ITEMS 336, 2026-09-16): `recordings.restore()`
 * shipped 57 minutes AFTER the first version of this module and flipped
 * `archived_at` back to NULL with no counter call, so every restore left
 * `sites.rec_count` permanently LOW. This plane has no TTL and no self-heal by
 * design, so nothing corrected it. Restore is the ONE archive-family path that
 * ADDS active rows, which is why it bumps rather than decrements.
 *
 * RANGE: restore may legitimately WIDEN first/last_recording_at (a restored row
 * can be older or newer than everything currently active), so it uses the same
 * LEAST/GREATEST shape as the insert path. It can never need to SHRINK the
 * range -- that stays the repair plane's job.
 *
 * @param {Function} execQuery  (sql, params) -> Promise, on the tx connection.
 * @param {Array}    rows       [{site_id, datetime}, ...] -- the rows that WILL
 *                              flip. Select them with `archived_at IS NOT NULL`
 *                              in the same transaction BEFORE the restore
 *                              UPDATE, so re-restoring an already-active id
 *                              adds 0 (mirrors decrementForArchivedRows).
 */
function bumpForRestoredRows(execQuery, rows) {
    return applyBump(execQuery, aggregateBySite(rows));
}

/**
 * After archiving `n` recordings of ONE site (inside the SAME transaction),
 * decrement that site's count. `n` should be the archive UPDATE's
 * affectedRows -- the rows that actually flipped -- not the caller's intended
 * count. Never goes below zero (a repair-plane concern if it ever would).
 *
 * @param {Function} execQuery
 * @param {number}   site_id    REQUIRED. See header.
 * @param {number}   n          rows actually archived.
 * @returns {Promise}
 */
function decrementForArchive(execQuery, site_id, n) {
    var sid = Number(site_id);
    if (!Number.isFinite(sid)) {
        return Promise.reject(new Error('site-rec-count: decrementForArchive requires a numeric site_id (got ' + site_id + ')'));
    }
    var count = Number(n) || 0;
    if (count <= 0) { return Promise.resolve(); }
    return execQuery(
        'UPDATE sites SET rec_count = GREATEST(rec_count - ?, 0) WHERE site_id = ?',
        [count, sid]
    );
}

/**
 * Multi-site archive decrement, for callers that archive an id list spanning
 * sites (the browser-facing recordings.delete()). `rows` are the rows that
 * WILL flip -- select them with `archived_at IS NULL` in the same transaction
 * before the archive UPDATE, so an already-archived id in the request does not
 * over-decrement. One UPDATE per site.
 *
 * @param {Function} execQuery  (sql[, params]) -> Promise, on the tx connection
 * @param {Array}    rows       [{site_id}, ...] the about-to-flip rows
 */
function decrementForArchivedRows(execQuery, rows) {
    var aggs = aggregateBySite(rows);
    var p = Promise.resolve();
    aggs.forEach(function (a) {
        p = p.then(function () {
            return decrementForArchive(execQuery, a.site_id, a.n);
        });
    });
    return p;
}

module.exports = {
    aggregateBySite: aggregateBySite,
    bumpForInsertedRows: bumpForInsertedRows,
    bumpForRestoredRows: bumpForRestoredRows,
    decrementForArchive: decrementForArchive,
    decrementForArchivedRows: decrementForArchivedRows
};