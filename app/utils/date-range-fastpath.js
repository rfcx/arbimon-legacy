/**
 * Eligibility gate for the recordings `date_range` fast path.
 *
 * Kept as a standalone, dependency-free module so it can be unit-tested without
 * booting the app's DB pool (requiring app/model/recordings.js pulls in the
 * whole connection stack).
 *
 * BACKGROUND
 * ----------
 * The project-wide date_range used to run:
 *
 *   SELECT MIN(r.datetime), MAX(r.datetime)
 *   FROM recordings r
 *   WHERE r.archived_at IS NULL AND r.site_id IN (...)
 *
 * which measured **154.5 s** on a 4M-recording project (318M-row table),
 * because no index covers (site_id, archived_at, datetime):
 *
 *   recs_active_by_site          (site_id, archived_at) -- no datetime
 *   recordings_site_datetime_idx (site_id, datetime)    -- no archived_at
 *
 * MariaDB has no partial indexes, so `archived_at IS NULL` cannot be indexed
 * directly. It is now answered with per-site index dives on the existing
 * (site_id, datetime) composite -- measured **0.004 s**, identical values.
 *
 * WHY THIS GATE EXISTS
 * --------------------
 * That rewrite is only EQUIVALENT for the UNFILTERED project-wide question.
 * Any additional predicate (explicit date range, years/months/days/hours,
 * validations, tags, playlists, classifications, soundscape composition, or an
 * explicit site selection) changes which rows the extremes are taken over.
 *
 * We therefore gate STRUCTURALLY on the query as actually built, rather than on
 * an enumerated list of filter names that would drift as filters are added. A
 * new filter appends a constraint (or a JOIN), which no longer matches the
 * expected shape, so the fast path disables itself and the original
 * correct-but-slow query runs. It fails CLOSED.
 */

/**
 * @param {Object} q
 * @param {Array}  q.tables        - FROM tables collected so far (base table only when eligible)
 * @param {Array}  q.constraints   - WHERE fragments collected so far
 * @param {String} q.archiveScope  - archive predicate ('' when scope is 'all')
 * @param {*}      q.explicitSites - truthy when the caller filtered to specific sites
 * @return {Boolean} true only when per-site index dives are provably equivalent
 */
function isDateRangeFastPathEligible (q) {
    q = q || {};
    var tables = q.tables || [];
    var constraints = q.constraints || [];

    // Any JOIN means extra filtering/fan-out -- not the plain question.
    if (tables.length !== 1) { return false; }

    // An explicit site selection is a different row set.
    if (q.explicitSites) { return false; }

    var expected = [];
    if (q.archiveScope) { expected.push(q.archiveScope); }
    expected.push('r.site_id IN (?)');

    if (constraints.length !== expected.length) { return false; }
    return constraints.every(function (c, i) { return c === expected[i]; });
}

module.exports = { isDateRangeFastPathEligible: isDateRangeFastPathEligible };
