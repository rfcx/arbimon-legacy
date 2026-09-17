/*
 * page-anchor.js — resolve an arbitrary page number to a KEYSET ANCHOR using
 * the `recording_page_anchor` checkpoint table.
 *
 * WHY THIS EXISTS
 * ---------------
 * `persite-sort.js` can seek from an anchor at any depth in constant time
 * (measured on the live PG leader at the prod 8 s bound: page 33,180 -> 206 ms,
 * page 112,402 -> 10.7 ms). Until now only a ±1 move could produce an anchor,
 * because the client could only anchor on a row it had ON SCREEN. Anything else
 * — First, Last, a typed jump — fell back to OFFSET, which is CANCELLED at
 * every depth past MAX_WINDOW (20,000 rows) on a many-site project.
 *
 * The checkpoint table stores, for each (project, sort column), one row per
 * `INTERVAL` rows of the project's globally-ordered recording stream. A jump to
 * page P therefore becomes: find the nearest checkpoint at rank <= P's first
 * row, seek from it, and walk forward at most INTERVAL-1 rows. That makes every
 * page reachable at seek cost, which is what lets the reachable-page cap go.
 *
 * Built by rfcx-local `runbooks/evidence/keyset-checkpoint-rehearsal-2026-09-17/build-checkpoints.sh`.
 * Design: rfcx-local `runbooks/DESIGN-2026-09-17-anchor-pagination-any-page-any-size.md`.
 *
 * WHY SERVER-SIDE
 * ---------------
 * The lookup could have lived in the SPA, but then every other consumer of
 * `recordings/search` (the export path, the CLI, any integration) would keep
 * the OFFSET cliff, and the SPA would need to know the checkpoint interval and
 * the rank arithmetic. Resolving here means a caller just asks for `offset` as
 * it always has, and deep pages stop being special.
 *
 * 🔴 TABLE MAY BE ABSENT OR PARTIAL — THAT IS A SUPPORTED STATE, NOT AN ERROR.
 * Checkpoints are built per project, per sort column, by an operator-gated
 * batch job. At the time of writing 13 projects have `datetime` and the two
 * largest have NOTHING. Every failure path here returns null, which means "no
 * anchor available" and leaves the caller on exactly today's OFFSET behaviour.
 * The cap that protects those un-built projects is driven by this same
 * availability signal (see `coverageFor`), so a project without checkpoints
 * keeps its cap instead of being handed a page that would cancel.
 *
 * ⚠️ ASCENDING RANKS ONLY. The table stores the ASC direction; a descending
 * rank is `N + 1 - rank` where N is the project's TRUE live row count. Using
 * the count of rows a build phase ranked instead of the true total returns the
 * WRONG ROW (measured: 65834072 instead of 28937575 on project 1533). The
 * caller passes `total`, which is the `count` output the search already
 * computes — the same number the pager uses to render page links, so the two
 * cannot disagree.
 */

'use strict';

// One checkpoint per default page. Chosen so a jump's forward walk is at most
// one page: measured worst-case jump 1.17 ms / 393 buffers on the real table.
var INTERVAL = 100;

// Sort columns the checkpoint table is keyed by. MUST match the `sort_col`
// values the builder writes and the anchor types persite-sort.js can build a
// literal for. `site` is deliberately absent: it has no anchor type, so a
// checkpoint could not be turned into a seek.
var SORT_COLS = {
    datetime: 'timestamp',
    filename: 'text',
    upload_time: 'timestamp'
};

/**
 * Is this sort column checkpointable at all?
 */
function isCheckpointable(sortCol) {
    return Object.prototype.hasOwnProperty.call(SORT_COLS, sortCol);
}

/**
 * Resolve the target row rank for a page, in ASCENDING terms.
 *
 * @param {number} offset  zero-based row offset the caller asked for
 * @param {number} limit   page size
 * @param {boolean} sortRev true when the requested sort is DESCENDING
 * @param {number} total   the project's TRUE live row count for this filter set
 * @returns {number|null}  1-based ASC rank of the page's first row in ASC order,
 *                         or null when the inputs cannot be trusted
 */
function ascRankFor(offset, limit, sortRev, total) {
    var off = parseInt(offset, 10);
    var lim = parseInt(limit, 10);
    var tot = parseInt(total, 10);
    if (!Number.isFinite(off) || off < 0) { return null; }
    if (!Number.isFinite(lim) || lim <= 0) { return null; }
    if (!Number.isFinite(tot) || tot <= 0) { return null; }
    // Asking past the end is not an error; there is simply nothing to anchor.
    if (off >= tot) { return null; }

    if (!sortRev) {
        // ASC: the page's first row is at rank offset+1.
        return off + 1;
    }
    // DESC: the page spans DESC ranks [off+1 .. off+lim]. Its LAST row in DESC
    // terms is the LOWEST ASC rank of the window, and that is the row we must
    // seek from so a forward ASC walk covers the whole page.
    var lastDescRank = Math.min(off + lim, tot);
    var ascRank = tot + 1 - lastDescRank;
    return ascRank >= 1 ? ascRank : 1;
}

/**
 * Build the lookup SQL with VALIDATED LITERALS.
 *
 * The PG read path in this codebase is `dbpoolPg.pgReadQuery(sql, cb)` — a SQL
 * STRING interface (it MySQL->PG translates the text), not a parameterised one.
 * So there is no bind-parameter channel available here, and the values must be
 * embedded. That is safe ONLY because both are constrained first:
 *   - projectId / rank: must be safe non-negative INTEGERS or we refuse. Note
 *     parseInt is too permissive for a security boundary (parseInt('1 OR 1=1')
 *     returns 1 and would silently ACCEPT an injected value by truncating it),
 *     which is the same trap persite-sort.js documents, so the whole string
 *     must match an integer.
 *   - sortCol: must be a key of SORT_COLS via hasOwnProperty, so it can only
 *     ever be one of three literals this module owns. Never the caller's string.
 * Anything else returns null and the caller keeps today's OFFSET behaviour.
 */
function safeInt(v) {
    if (typeof v === 'number') {
        return Number.isInteger(v) && v >= 0 && Number.isSafeInteger(v) ? v : null;
    }
    if (typeof v === 'string' && /^\d{1,15}$/.test(v.trim())) {
        var n = parseInt(v.trim(), 10);
        return Number.isSafeInteger(n) ? n : null;
    }
    return null;
}

function lookupSql(projectId, sortCol, ascRank) {
    var pid = safeInt(projectId);
    var rank = safeInt(ascRank);
    if (pid === null || pid <= 0 || rank === null || rank < 1) { return null; }
    if (!isCheckpointable(sortCol)) { return null; }
    return 'SELECT rank, sort_key, recording_id FROM recording_page_anchor ' +
        "WHERE project_id = " + pid + " AND sort_col = '" + sortCol + "' " +
        'AND rank <= ' + rank + ' ORDER BY rank DESC LIMIT 1';
}

function coverageSql(projectId, sortCol) {
    var pid = safeInt(projectId);
    if (pid === null || pid <= 0 || !isCheckpointable(sortCol)) { return null; }
    return 'SELECT coalesce(max(rank), 0) AS max_rank FROM recording_page_anchor ' +
        "WHERE project_id = " + pid + " AND sort_col = '" + sortCol + "'";
}

function firstRow(rows) {
    if (!rows) { return null; }
    if (Array.isArray(rows)) { return rows.length ? rows[0] : null; }
    if (Array.isArray(rows.rows)) { return rows.rows.length ? rows.rows[0] : null; }
    return null;
}

/**
 * Look up the nearest checkpoint at or before `ascRank`.
 *
 * Returns `{ anchor: {id, key, isNull}, walk, checkpointRank }` or null.
 * `walk` is how many rows to discard after seeking — bounded by INTERVAL-1 by
 * construction, i.e. at most one page.
 *
 * @param {function} queryFn (sql, cb) => cb(err, rows)   e.g. dbpoolPg.pgReadQuery
 */
function lookup(queryFn, projectId, sortCol, ascRank, callback) {
    if (typeof queryFn !== 'function') { return callback(null, null); }
    var sql = lookupSql(projectId, sortCol, ascRank);
    if (sql === null) { return callback(null, null); }
    var rank = safeInt(ascRank);

    queryFn(sql, function (err, rows) {
        if (err) {
            // A missing table (42P01) is the EXPECTED state before the backfill
            // reaches a project; a pgRouteFallback sentinel means the PG read
            // path declined. Neither is worth failing a user's page over.
            console.error('page-anchor lookup failed, falling back to OFFSET:', {
                projectId: projectId, sortCol: sortCol, ascRank: rank,
                code: err && err.code, error: String(err && (err.message || err)).slice(0, 200)
            });
            return callback(null, null);
        }
        var row = firstRow(rows);
        if (!row) { return callback(null, null); }
        var cpRank = safeInt(row.rank);
        var recId = row.recording_id;
        if (cpRank === null || recId === undefined || recId === null) {
            return callback(null, null);
        }
        var walk = rank - cpRank;
        if (!Number.isFinite(walk) || walk < 0 || walk >= INTERVAL) {
            // Out-of-grid => the table disagrees with INTERVAL. Refuse rather
            // than serve from a checkpoint we cannot reason about, because the
            // forward walk would then be unbounded (the original problem).
            console.error('page-anchor rank out of grid, falling back to OFFSET:', {
                projectId: projectId, sortCol: sortCol, ascRank: rank, cpRank: cpRank, walk: walk
            });
            return callback(null, null);
        }
        callback(null, {
            anchor: {
                id: recId,
                // A band checkpoint stores sort_key IS NULL — the signal
                // persite-sort.js needs to seek INSIDE the NULL band, where the
                // key is constant and only the tiebreaker orders. A band-blind
                // anchor drops the whole band (measured: 250 of 400 rows lost).
                key: row.sort_key === null || row.sort_key === undefined ? undefined : String(row.sort_key),
                isNull: row.sort_key === null || row.sort_key === undefined
            },
            walk: walk,
            checkpointRank: cpRank
        });
    });
}

/**
 * How deep are this project's checkpoints for this sort column?
 *
 * This is the signal the reachable-page cap is driven by. A project with
 * checkpoints to rank R can serve any page up to R because every such page has
 * an anchor at most INTERVAL-1 rows behind it. A project with NO checkpoints
 * returns 0 and KEEPS its existing bound — which is precisely why removing the
 * static cap does not re-expose the cancelling deep pages on the projects the
 * backfill has not reached yet (at the time of writing: the two largest).
 *
 * Fails SAFE, not open: any error reports 0 coverage.
 */
function coverageFor(queryFn, projectId, sortCol, callback) {
    var none = { maxRank: 0, interval: INTERVAL };
    if (typeof queryFn !== 'function') { return callback(null, none); }
    var sql = coverageSql(projectId, sortCol);
    if (sql === null) { return callback(null, none); }
    queryFn(sql, function (err, rows) {
        if (err) {
            console.error('page-anchor coverage lookup failed, assuming none:', {
                projectId: projectId, sortCol: sortCol,
                code: err && err.code, error: String(err && (err.message || err)).slice(0, 200)
            });
            return callback(null, none);
        }
        var row = firstRow(rows);
        var maxRank = row ? safeInt(row.max_rank) : 0;
        if (maxRank === null || maxRank < 0) { maxRank = 0; }
        callback(null, { maxRank: maxRank, interval: INTERVAL });
    });
}

module.exports = {
    INTERVAL: INTERVAL,
    SORT_COLS: SORT_COLS,
    isCheckpointable: isCheckpointable,
    ascRankFor: ascRankFor,
    safeInt: safeInt,
    lookupSql: lookupSql,
    coverageSql: coverageSql,
    lookup: lookup,
    coverageFor: coverageFor
};