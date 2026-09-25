/* jshint node:true */
'use strict';
/**
 * project-scope — ONE answer to "does entity <id> belong to the project in the URL?"
 *
 * WHY THIS FILE EXISTS (rfcx-local OPEN-ITEMS §391, 2026-09-25; the durable fix
 * for the §291 -> §292 -> §391 class).
 * --------------------------------------------------------------------------
 * Every route under /legacy-api/project/:projectUrl/... is authorised against
 * the project in the URL (index.js `router.param('projectUrl')`). An id in the
 * REST of the path was then resolved by id alone, so any logged-in user could
 * read another project's entity by quoting its id under a project they can
 * open (922 public projects make that "any user"). Three audits fixed the
 * routes each one read (§291 classifications/PM/templates, §292 jobs/tags/
 * soundscape-composition, §391 recordings + the sites.js `siteid` param), and
 * each next audit found more. Measured over HTTP on 2026-09-25 as a NON-super
 * user: `/project/<public-member-project>/recordings/info/<private-project-rec>`
 * returned 200 with the full record.
 *
 * So the check lives in ONE place, and `build/check-project-scope.js` (a
 * required PR check) refuses any id route/param under
 * app/routes/data-api/project/ that is not bound to it (or to a model call that
 * takes the project, or to a commented allow-list entry).
 *
 * THE OWNERSHIP RULE (the same set the recordings LIST has always used):
 *   an entity belongs to project P if its site is
 *     - one of P's own sites (`sites.project_id = P`), OR
 *     - a site imported into P (`project_imported_sites.project_id = P`).
 *   REMOVED sites (`deleted_at` set) still count: playlists/PM ROIs reference
 *   2.29 M rows on removed sites and the visualizer must still open them from
 *   inside their own project. This rule deliberately does NOT filter
 *   deleted_at — it answers "whose is it", not "is it listed".
 *
 * NO EXISTENCE ORACLE: callers must answer a `false` with EXACTLY the response
 * they give an unknown id (same status, same body). Foreign and missing are
 * indistinguishable by construction because both are `false` here.
 *
 * What this module deliberately does NOT do: scope `recordings.findByUrlMatch`
 * itself. Its model-internal callers pass project null/0 ON PURPOSE
 * (playlists.js, templates.js, training_sets.js — templates carry
 * source_project_id, playlist items may sit on removed sites). The guard sits
 * at the ROUTE layer, where "the project in the URL" is actually known.
 *
 * DB-only on purpose (requires dbpool, nothing from app/model): it is reached
 * from routes only, and keeping it free of model requires keeps it out of the
 * job-stage require() closure (build/check-stage-copy-closure.js).
 *
 * ZERO npm dependencies and native Promises on purpose: the PR gate runs this
 * module's self-test (build/check-project-scope.selftest.js) on a bare
 * `node` with no `npm install`. Callers' q promises (dbpool.query,
 * parseUrlQuery) are assimilated by Promise.resolve.
 */

var OWNED_SQL = {
    // One indexed probe each: recordings PK -> sites PK -> project_imported_sites
    // PK (site_id, project_id). LIMIT 1, no row data returned.
    recording:
        'SELECT 1 AS owned FROM recordings r JOIN sites s ON s.site_id = r.site_id ' +
        'WHERE r.recording_id = ? AND (s.project_id = ? OR EXISTS (' +
        'SELECT 1 FROM project_imported_sites pis WHERE pis.site_id = r.site_id AND pis.project_id = ?' +
        ')) LIMIT 1',
    site:
        'SELECT 1 AS owned FROM sites s ' +
        'WHERE s.site_id = ? AND (s.project_id = ? OR EXISTS (' +
        'SELECT 1 FROM project_imported_sites pis WHERE pis.site_id = s.site_id AND pis.project_id = ?' +
        ')) LIMIT 1'
};

/** Strictly a positive integer id (number or all-digit string). Anything else
 *  can never name a real row, so it is answered `false` without a query. */
function asId(v) {
    if (typeof v === 'number') { return (isFinite(v) && v > 0 && Math.floor(v) === v) ? v : null; }
    if (typeof v === 'string' && /^\d{1,19}$/.test(v.trim())) {
        var n = Number(v.trim());
        return n > 0 ? n : null;
    }
    return null;
}

/** The canonical selector that findByUrlMatch resolves to NO rows without a DB
 *  lookup: parseUrl passes objects through, parseQueryItem returns the object,
 *  and findByUrlMatch's site branch emits `1 = 0` for a non-numeric operand. It
 *  takes exactly the path an unknown `!q:<site>` takes, so a denied list/count
 *  request returns the same empty shape an unknown site does. */
var NO_MATCH_SELECTOR = Object.freeze({ site: Object.freeze({ no_match: true }) });

function makeProjectScope(query) {
    if (typeof query !== 'function') { throw new Error('project-scope: query function required'); }

    /**
     * @param {'recording'|'site'} kind
     * @param {number|string} id
     * @param {number} projectId  req.project.project_id
     * @return {Promise<boolean>}  true only when a row proves ownership
     */
    function ownedByProject(kind, id, projectId) {
        var sql = OWNED_SQL[kind];
        if (!sql) { return Promise.reject(new Error('project-scope: unknown kind ' + kind)); }
        var eid = asId(id), pid = asId(projectId);
        if (eid === null || pid === null) { return Promise.resolve(false); }
        return Promise.resolve(query(sql, [eid, pid, pid])).then(function (rows) {
            return !!(rows && rows.length);
        });
    }

    /**
     * Verdict for a PARSED recordings URL selector (the object
     * `recordings.parseUrlQuery` returns). Mirrors findByUrlMatch's branches:
     *   - neither id nor site  -> project-wide; findByUrlMatch applies its own
     *                             project union, so ALLOW.
     *   - id                   -> every id must be an owned recording.
     *   - site                 -> must be a single numeric site id that is owned.
     *                             Any other site shape (IN list, name, no_match)
     *                             already resolves to no rows in the model, so
     *                             denying it cannot change what a user sees.
     * Fails closed on any shape it does not recognise.
     */
    function selectorOwned(urlquery, projectId) {
        if (!urlquery || typeof urlquery !== 'object') { return Promise.resolve(false); }
        var hasId = urlquery.id !== undefined && urlquery.id !== null;
        var hasSite = urlquery.site !== undefined && urlquery.site !== null;
        if (!hasId && !hasSite) { return Promise.resolve(true); }
        if (hasId && hasSite) { return Promise.resolve(false); }
        var item = hasId ? urlquery.id : urlquery.site;
        var vals;
        if (item['='] !== undefined) { vals = [item['=']]; }
        else if (hasId && item.IN !== undefined) { vals = [].concat(item.IN); }
        else { return Promise.resolve(false); }
        if (!vals.length) { return Promise.resolve(false); }
        return Promise.all(vals.map(function (v) {
            return ownedByProject(hasId ? 'recording' : 'site', v, projectId);
        })).then(function (verdicts) {
            return verdicts.every(Boolean);
        });
    }

    /**
     * Verdict for a RAW recordings URL (`123`, `123.flac`, `!q:59`, `59-2020-01`, …).
     * `recordingsModel` is passed in (not required here) so this module stays
     * out of the job-stage require() closure.
     */
    function recordingUrlOwned(recordingsModel, recordingUrl, projectId) {
        return Promise.resolve(recordingsModel.parseUrlQuery(recordingUrl)).then(function (urlquery) {
            return selectorOwned(urlquery, projectId);
        });
    }

    return {
        ownedByProject: ownedByProject,
        selectorOwned: selectorOwned,
        recordingUrlOwned: recordingUrlOwned,
        NO_MATCH_SELECTOR: NO_MATCH_SELECTOR,
        _sql: OWNED_SQL
    };
}

var defaultInstance = null;
function instance() {
    if (!defaultInstance) {
        // Lazy: tests build their own instance with a fake query function and
        // never load the real pool.
        var dbpool = require('./dbpool');
        defaultInstance = makeProjectScope(function (sql, params) { return dbpool.query(sql, params); });
    }
    return defaultInstance;
}

module.exports = {
    makeProjectScope: makeProjectScope,
    NO_MATCH_SELECTOR: NO_MATCH_SELECTOR,
    ownedByProject: function (kind, id, projectId) { return instance().ownedByProject(kind, id, projectId); },
    selectorOwned: function (urlquery, projectId) { return instance().selectorOwned(urlquery, projectId); },
    recordingUrlOwned: function (m, url, projectId) { return instance().recordingUrlOwned(m, url, projectId); }
};
