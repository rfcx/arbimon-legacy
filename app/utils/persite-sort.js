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
 *   - 2..MAX_SITES sites take the UNION form (a 1-site project is already
 *     index-served). >MAX_SITES takes the PG-only LATERAL branch described
 *     below; on MariaDB >MAX_SITES keeps the old shape (MariaDB has no
 *     LATERAL, and the ~700 KB SQL-text bound still applies there),
 *   - offset+limit <= MAX_WINDOW (§270 owns the residual deep-page cost; see
 *     the MAX_WINDOW note below for why 20,000 and not 500),
 *   - a finite positive limit (the dump-everything path keeps the old shape).
 */
var MAX_SITES = 2000;

/**
 * THE >MAX_SITES LATERAL BRANCH (added 2026-09-17, seat
 * ms4-keyset-p1-verify-20260917; operator GO 04:33; rfcx-local evidence
 * `runbooks/evidence/keyset-p1-g1-refutation-2026-09-17.md`).
 *
 * WHY IT EXISTS: until today, >MAX_SITES was a GATE — the two biggest projects
 * were excluded from the fast path entirely, so ANY non-default sort on them
 * ran the global sort and timed out (measured on 3165
 * `plains-wanderer-queensland`, 2,473 sites: today's path hit a 120 s probe
 * cap with 0 rows, twice; in prod it dies at the 8 s routed-read cancel).
 * The union cannot serve them: at 2,473 sites its TEXT is ~465 KB, brushing
 * the ~700 KB generated-SQL bound MAX_SITES exists to enforce. The LATERAL
 * form's text is ~30 KB at 2,473 sites (the site list is one array literal,
 * not one arm per site), so the text bound disappears.
 *
 * WHY IT IS GATED TO >MAX_SITES — LATERAL IS NOT A REPLACEMENT FOR THE UNION.
 * The union plans as a Merge Append: arms arrive in index order, PG streams
 * them and STOPS at k (`actual rows == k` exactly). LATERAL has no early stop:
 * it materialises min(k, rows_in_site) per arm and sorts the lot. Measured on
 * the LIVE LEADER at the prod 8 s bound, 2026-09-16/17 (twice, incl. one
 * independent falsification pass):
 *   - dense giant 1989 (970 sites, ~11,588 rows/site), k=20,000:
 *     UNION 194-197 ms / 100 rows — LATERAL CANCELLED at 8.00 s, 0 rows,
 *     5 runs of 5 (true cost ~58.8 s under a 60 s cap).
 *   - => a blanket rewrite would have turned a working ~195 ms page into a
 *     fail-open that silently drops the user's chosen sort. The UNION stays
 *     the default for 2..MAX_SITES.
 *
 * WHY IT IS SAFE AT THE FULL MAX_WINDOW HERE (measured, leader, 8 s cap,
 * 2026-09-17): cost scales with per-site DENSITY x k, and the only estate
 * member of the >MAX_SITES class is SPARSE — 3165 carries 574,436 recordings
 * over 2,473 sites (avg 232, max 480 rows/site), so every arm saturates at
 * 480 rows and the ladder is FLAT:
 *   datetime DESC: 776 / 511 / 187 / 191 / 190 / 240 ms at k =
 *   100/500/2000/5000/10000/20000; filename DESC (2 arms/site, worst case):
 *   176 / 280 / 280 / 280 / 297 / 320 ms. All 12 runs returned 100 rows,
 *   zero errors, max 320 ms = a 25x margin under the 8 s routed-read bound.
 * ⚠️ DENSITY CAVEAT: a FUTURE >2000-site project with giant-class density
 * (~11k rows/site) would cancel at depth on this branch (that is exactly
 * what the giant does). The class is enumerable and has ONE member (the
 * runner-up, 2408, is 745 sites below the bar); if a dense project crosses
 * MAX_SITES, re-measure before trusting this branch at MAX_WINDOW depth —
 * the fall-through past the bound is the old shape, i.e. no worse than today.
 *
 * OUTPUT IDENTITY (the gate that matters): the LATERAL form below is
 * byte-order identical to the union form — 12/12 cases IDENTICAL id sequences
 * (projects 1989/3941/8869/35/3165 x datetime/filename/upload_time x k in
 * {100..20000}), incl. a NEGATIVE CONTROL that fires (flip the outer
 * tiebreaker and the harness names the first differing row). On 3165 the
 * oracle was a cap-bypassed union (today's global sort returns nothing):
 * 100/100 ids identical. The two-arm NULL split is preserved — one LATERAL
 * per band, unioned — for the same btree null-placement reason as above.
 */
function buildLateralSortSql(siteIds, o, dir, k, scope, limit, offset) {
    // PG-only caller. Placement rules are the union's, restated for one arm:
    // PG-native INSIDE each LATERAL (index-servable; placement irrelevant
    // within a band), app-semantic on the OUTER (small sort, not an index
    // walk). Same translate() passthrough property: explicit placement on the
    // arm keys keeps the #1794 NULL-placement leg from rewriting them.
    var armPlacement = o.nullable ? (o.sortRev ? ' NULLS FIRST' : ' NULLS LAST') : '';
    var outerPlacement = o.nullable ? (o.sortRev ? ' NULLS LAST' : ' NULLS FIRST') : '';
    var arr = 'ARRAY[' + siteIds.join(',') + ']::bigint[]';
    var arm = function (nullpred) {
        return 'SELECT x.id, x.sort_key FROM unnest(' + arr + ') AS t(site_id)\n' +
            'CROSS JOIN LATERAL (\n' +
            '  SELECT r.recording_id AS id, ' + o.expr + ' AS sort_key\n' +
            '  FROM recordings r\n' +
            '  WHERE r.site_id = t.site_id' + scope + nullpred + '\n' +
            '  ORDER BY ' + o.expr + ' ' + dir + armPlacement +
            ', r.recording_id ' + dir + '\n' +
            '  LIMIT ' + k + '\n) x';
    };
    var inner = o.nullable
        ? arm(' AND ' + o.expr + ' IS NOT NULL') + '\nUNION ALL\n' + arm(' AND ' + o.expr + ' IS NULL')
        : arm('');
    return 'SELECT u.id FROM (\n' + inner + '\n) u\n' +
        'ORDER BY u.sort_key ' + dir + outerPlacement + ', u.id ' + dir + '\n' +
        'LIMIT ' + limit + ' OFFSET ' + offset;
}

/**
 * Deepest `offset+limit` this shape will serve. **500 -> 20000 on 2026-09-16**
 * (operator goifirr 21:54), after measuring that the original bound was far
 * more conservative than the physics requires.
 *
 * THE ORIGINAL REASONING WAS THAT PER-ARM k GROWS WITH THE PAGE, so a deep
 * page would make each of the ~970 arms return k rows and the union would
 * degenerate into a full read. **That is not what the planner does.** The arms
 * are each already in index order, so PG plans the union as a **Merge Append**,
 * which streams them in globally sorted order and STOPS after k rows.
 *
 * Measured on `puerto-rico-island-wide` (970 sites / 11,240,229 rows,
 * postgres-1-0, two runs per k to control for cache):
 *
 *   k=    500   5,877 / 5,369 ms   Merge Append actual rows =    500
 *   k=  5,000   7,751 / 7,313 ms   Merge Append actual rows =  5,000
 *   k= 20,000   7,758 / 7,463 ms   Merge Append actual rows = 20,000
 *
 * `actual rows == k` at every k -- the eye-watering `rows=18568826` in the
 * plan is the planner's ESTIMATE, not what ran. Cost is dominated by OPENING
 * ~970 index scans (the fixed ~5-7 s), not by k, so raising the bound is
 * close to free.
 *
 * WHAT THIS BUYS: at limit=100 the fast path reached page 5; it now reaches
 * page 200. Past the bound the caller falls back to the global sort, which on
 * this project scans all 11.2M rows and costs 10.9 s (datetime) to 13.6 s
 * (filename) at ANY page -- i.e. the bound was a cliff, not a gradient.
 *
 * WHAT IT DOES NOT BUY: the giant project is still ~5-8 s on this shape. The
 * ~970-arm fixed cost is the reason, and only a different access pattern
 * (keyset/seek, §270 option 1) removes it. This raise moves the cliff; it does
 * not make the giant fast.
 *
 * ⚠️ The MAX_SITES interaction CHANGED on 2026-09-17: >MAX_SITES no longer
 * keeps the old shape on PG — it takes the LATERAL branch above, which is
 * measured flat to this same 20,000 bound on the only estate member (3165;
 * see the branch header). On MariaDB the old gate still applies.
 */
var MAX_WINDOW = 20000;

function buildPerSiteSortSql(o) {
    if (!o || !o.expr) { return null; }
    var siteIds = (o.siteIds || []).map(function (s) { return parseInt(s, 10); })
        .filter(function (s) { return Number.isFinite(s); });
    if (siteIds.length < 2) { return null; }
    var limit = parseInt(o.limit, 10);
    var offset = Math.max(0, parseInt(o.offset, 10) || 0);
    if (!Number.isFinite(limit) || limit <= 0) { return null; }
    if (offset + limit > MAX_WINDOW) { return null; }

    var dir = o.sortRev ? 'DESC' : 'ASC';
    var k = offset + limit;
    var scope = o.archiveScope ? (' AND ' + o.archiveScope) : '';

    // >MAX_SITES: the union's TEXT would exceed the ~700 KB generated-SQL
    // bound. PG takes the LATERAL branch (measured + identity-proven — see the
    // branch header); MariaDB has no LATERAL and keeps the old shape.
    if (siteIds.length > MAX_SITES) {
        return o.isPg ? buildLateralSortSql(siteIds, o, dir, k, scope, limit, offset) : null;
    }

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
