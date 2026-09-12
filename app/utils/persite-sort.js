/**
 * Per-site top-N UNION builder for the recordings list's NON-DEFAULT sorts
 * (2026-09-12, P7 pre-flip read-timeout sweep — item 1).
 *
 * Kept as a standalone, dependency-free module so it can be unit-tested without
 * booting the app's DB pool (same pattern as date-range-fastpath.js).
 *
 * THE PROBLEM
 * -----------
 * The recordings list on a multi-site project sorts GLOBALLY across all of the
 * project's sites. The whitelisted sort columns are each backed by a
 * (site_id, <col>) composite index, which gives PER-SITE order only — no index
 * can yield the global order, so both engines materialise and sort the
 * project's ENTIRE recording set for page 1:
 *
 *   - MariaDB: FORCE INDEX (recordings_site_filename_idx) + filesort of
 *     11.2 M rows on `puerto-rico-island-wide` — measured 100.9 s (2026-08-31).
 *   - PG: the translator's collation fold on ORDER BY r.filename
 *     (translate(lower(...)) ...) additionally defeats every index, and even
 *     unfolded the global sort scans all 11.2 M rows (~109 s) — so the
 *     statement is cancelled DETERMINISTICALLY at the 8 s routed-read
 *     statement_timeout (pg_route_timeout hashes f44b4c1fdbb60431 (ASC) /
 *     16670983c3ff6008 (DESC), derived with templateHash() in the running
 *     container). Today the fail-open lands on the same ~100 s MariaDB filesort
 *     and the request dies at the ~30 s proxy bound → the SPA renders its
 *     error path as "0 Recordings" over a project that has 11.2 M.
 *
 * THE SHAPE
 * ---------
 * Global top-N of a union == top-N of (per-site top-N). TWO arms per site:
 *
 *   (SELECT r.recording_id AS id, r.filename AS sort_key FROM recordings r
 *     WHERE r.site_id = 8412 AND r.archived_at IS NULL AND r.filename IS NOT NULL
 *     ORDER BY r.filename ASC <pg-native-placement>, r.recording_id ASC LIMIT k)
 *   UNION ALL
 *   (SELECT ... AND r.filename IS NULL
 *     ORDER BY r.filename ASC <pg-native-placement>, r.recording_id ASC LIMIT k)
 *
 * then `SELECT u.id FROM (<arms>) u ORDER BY u.sort_key ASC <mysql-placement>,
 * u.id ASC LIMIT <offset>, <limit>` (k = offset+limit).
 *
 * WHY TWO ARMS — the PG btree null-placement trap (measured on the live
 * leader, 2026-09-12): a plain PG btree orders NULLs LAST on ASC / FIRST on
 * DESC, and the planner will NOT use the index for the opposite placement —
 * `ORDER BY filename ASC NULLS FIRST` plans as a per-site full scan + sort
 * (19,120 rows/arm on the giant => the 950-arm union cancels at 15 s, vs 1.38 s
 * for the index-served shape). This bites through the translator's #1794
 * NULL-placement leg, which emits exactly the index-defeating placement for
 * nullable sort keys. The split makes placement INSIDE each arm irrelevant
 * (the value arm has no NULLs; the null arm's sort key is constant), so the
 * arms carry PG-NATIVE placement (ASC NULLS LAST / DESC NULLS FIRST) — which
 * doubles as a translate() passthrough marker (`_SORTKEY_RE` does not match
 * keys with explicit placement, so the #1794 leg cannot rewrite them). The
 * OUTER key carries the app-semantic placement (MySQL: NULLs FIRST on ASC,
 * LAST on DESC — PG needs it explicit; the outer is a small sort of
 * <= 2 x sites x k rows, not an index walk).
 *
 * NULL tie-band cost: the null arm must top-N the site's whole NULL band
 * (incremental sort over one tie group). Worst measured on the leader: a
 * 96,627-NULL site = 169.7 ms warm. The giant carries 131 NULLs across all
 * 950 sites. A pathological project (many sites x huge NULL bands) can still
 * exceed the statement timeout — same failure class as today, strictly rarer.
 *
 * MEASURED (2026-09-12, live cluster):
 *   puerto-rico (950 sites, k=10): PG leader 1,380 ms (cancels today);
 *   MariaDB master 0.3 s warm / 5.5 s cold (vs ~100.9 s today).
 *   mashpi (20 sites incl. 74k-97k NULL bands): PG leader ~1.1-1.3 s.
 *   Correctness on real data: union == plain ordered id list for
 *   ASC/DESC x pages 1-2 (mashpi, NULL band leading on ASC page 1).
 *
 * GATES (all must hold; the caller checks the structural ones):
 *   - 2..MAX_SITES sites (a 1-site project is already index-served; >2000 is
 *     the ~2-project tail whose SQL text would exceed ~700 KB — they keep the
 *     old shape, i.e. the accepted §270 giant-sort residual),
 *   - offset+limit <= MAX_WINDOW (per-arm k grows with the page; §270 owns
 *     deep-page cost),
 *   - a finite positive limit (the dump-everything path keeps the old shape).
 */
var MAX_SITES = 2000;
var MAX_WINDOW = 500;

function buildPerSiteSortSql(o) {
    if (!o || !o.expr) { return null; }
    var siteIds = (o.siteIds || []).map(function (s) { return parseInt(s, 10); })
        .filter(function (s) { return Number.isFinite(s); });
    if (siteIds.length < 2 || siteIds.length > MAX_SITES) { return null; }
    var limit = parseInt(o.limit, 10);
    var offset = Math.max(0, parseInt(o.offset, 10) || 0);
    if (!Number.isFinite(limit) || limit <= 0) { return null; }
    if (offset + limit > MAX_WINDOW) { return null; }

    var dir = o.sortRev ? 'DESC' : 'ASC';
    // Arm placement: PG-native (index-servable); semantically irrelevant inside
    // an arm (one arm is NULL-free, the other is NULL-only). Emitted ONLY on PG
    // — MariaDB rejects NULLS FIRST/LAST syntax, and its defaults are identical
    // for the same reason. On PG the explicit placement also immunises the arm
    // against the translator's NULL-placement leg (see module header).
    var armPlacement = (o.isPg && o.nullable) ? (o.sortRev ? ' NULLS FIRST' : ' NULLS LAST') : '';
    // Outer placement: the app's semantic (MySQL's): NULLs FIRST on ASC, LAST
    // on DESC. PG's default is the opposite, so PG needs it explicit; MariaDB's
    // default IS this, so nothing is emitted there.
    var outerPlacement = (o.isPg && o.nullable) ? (o.sortRev ? ' NULLS LAST' : ' NULLS FIRST') : '';
    var k = offset + limit;
    var scope = o.archiveScope ? (' AND ' + o.archiveScope) : '';

    var arms = [];
    siteIds.forEach(function (sid) {
        var base = '(SELECT r.recording_id AS id, ' + o.expr + ' AS sort_key ' +
            'FROM recordings r WHERE r.site_id = ' + sid + scope;
        var ord = ' ORDER BY ' + o.expr + ' ' + dir + armPlacement +
            ', r.recording_id ' + dir + ' LIMIT ' + k + ')';
        if (o.nullable) {
            arms.push(base + ' AND ' + o.expr + ' IS NOT NULL' + ord);
            arms.push(base + ' AND ' + o.expr + ' IS NULL' + ord);
        } else {
            arms.push(base + ord);
        }
    });
    return 'SELECT u.id FROM (\n' + arms.join('\nUNION ALL\n') + '\n) u\n' +
        'ORDER BY u.sort_key ' + dir + outerPlacement + ', u.id ' + dir + '\n' +
        (o.isPg ? ('LIMIT ' + limit + ' OFFSET ' + offset) : ('LIMIT ' + offset + ', ' + limit));
}

module.exports = {
    buildPerSiteSortSql: buildPerSiteSortSql,
    PERSITE_SORT_MAX_SITES: MAX_SITES,
    PERSITE_SORT_MAX_WINDOW: MAX_WINDOW
};
