'use strict';

/**
 * Resolve the site filter of /project/:url/recordings/search.
 *
 * WHY THIS EXISTS (2026-09-26). The SPA recordings page reflects filters in
 * the URL (`?f.sites=88030`) and sends `sites_ids` ONLY on a cold load: site
 * NAMES are deliberately not carried in the URL (a rename must not produce a
 * link that disagrees with itself). The filter panel re-derives names, so the
 * "Apply filters" click sends BOTH `sites` and `sites_ids`.
 *
 * `findProjectRecordings` used to key the site filter on the PRESENCE OF THE
 * NAMES and then filter by the ids:
 *
 *     if (!parameters.sites) r.site_id IN (<every project site>)
 *     if ( parameters.sites) s.site_id IN (parameters.sites_ids)
 *
 * so `sites_ids` without `sites` was SILENTLY IGNORED — a shared/bookmarked/
 * reloaded filtered link showed "Filters applied" over the UNFILTERED list
 * (measured on prod: Apply -> 90 rows, reload of the identical URL -> 405).
 * And the names branch dropped the project scope entirely, trusting whatever
 * ids the caller sent. The export builder (`buildSearchQuery`) already treats
 * `sites_ids` as authoritative; this makes the search route agree with it.
 *
 * CONTRACT
 *  - `sites_ids` present (non-empty)  -> authoritative; names are ignored.
 *  - only `sites` (names) present     -> resolved to ids via the project's
 *                                        own sites (legacy callers).
 *  - neither                          -> not explicit; every project site.
 *  - Either way the selection is INTERSECTED with the project's site set, so
 *    a foreign id can never widen the scope. An explicit selection that
 *    resolves to nothing stays explicit and matches NOTHING (it must never
 *    fall back to "all sites" — that is the silent-unfiltered failure again).
 *
 * @param {Object<string,{site_id:number,name:string}>} siteData - the project's
 *        in-scope sites (own + imported, active), keyed by site_id
 * @param {*} sitesIds - joi-validated `sites_ids` (number | number[] | undefined)
 * @param {*} siteNames - joi-validated `sites` (string | string[] | undefined)
 * @return {{explicit: boolean, ids: number[]}}
 */
function resolveSiteSelection (siteData, sitesIds, siteNames) {
    var sites = Object.values(siteData || {});
    var projectIds = sites.map(function (s) { return Number(s.site_id); });

    var toList = function (v) {
        if (v === undefined || v === null || v === '') { return []; }
        return Array.isArray(v) ? v : [v];
    };

    var ids = toList(sitesIds)
        .map(Number)
        .filter(function (n) { return Number.isFinite(n); });
    var names = toList(siteNames).map(String);

    if (!ids.length && !names.length) {
        return { explicit: false, ids: projectIds };
    }

    var wanted;
    if (ids.length) {
        var inProject = {};
        projectIds.forEach(function (id) { inProject[id] = true; });
        wanted = ids.filter(function (id) { return inProject[id] === true; });
    } else {
        var byName = {};
        names.forEach(function (n) { byName[n] = true; });
        wanted = sites
            .filter(function (s) { return byName[s.name] === true; })
            .map(function (s) { return Number(s.site_id); });
    }

    // de-duplicate, keep first-seen order
    var seen = {};
    wanted = wanted.filter(function (id) {
        if (seen[id]) { return false; }
        seen[id] = true;
        return true;
    });

    return { explicit: true, ids: wanted };
}

module.exports = { resolveSiteSelection: resolveSiteSelection };
