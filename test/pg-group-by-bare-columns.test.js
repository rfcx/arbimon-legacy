/* jshint node:true */
'use strict';

/**
 * REGRESSION GUARD — MySQL-permissive `GROUP BY` (bare non-aggregated columns
 * in the select list) is a hard error on PostgreSQL: 42803,
 * "column X must appear in the GROUP BY clause or be used in an aggregate
 * function". Any route emitting one 500s on every call under DB_ENGINE=pg.
 *
 * Measured in prod 2026-09-14 (rfcx-local
 * runbooks/evidence/300d2-finding-legacy-projectlist-pg-dialect-2026-09-14.md):
 *
 *     GET /legacy-api/user/projectlist   ->  HTTP 500
 *     SELECT project_id, lat, lon, MAX(site_id) as maxSiteId
 *       FROM sites GROUP BY project_id
 *
 * Two call sites carried it: model/users.js projectList() (the non-super
 * branch) and model/projects.js find() (the include_location=true path, which
 * is how the super branch reaches it). Both now use DISTINCT ON.
 *
 * 🔑 WHY DISTINCT ON AND NOT MAX(lat)/MAX(lon) — the trap this guard exists to
 * prevent someone "simplifying" into: MAX(lat)/MAX(lon) also parses, but it
 * returns the greatest latitude and the greatest longitude INDEPENDENTLY,
 * which is not a real location. The `maxSiteId` alias shows the intent is the
 * newest site's coordinates. Measured on prod: the two forms disagree for
 * 2,363 of 5,801 projects. DISTINCT ON (project_id) ... ORDER BY project_id,
 * site_id DESC reproduces the original semantics exactly (verified: 0 wrong
 * sites, 0 wrong coordinates across all 5,801).
 */

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var MODEL_DIR = path.join(ROOT, 'app', 'model');

// Comments explain the defect on purpose; strip them so the guard matches SQL.
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

describe('PostgreSQL rejects bare non-aggregated columns under GROUP BY (42803)', function () {

    it('no model file selects bare lat/lon alongside MAX(site_id) GROUP BY project_id', function () {
        var offenders = [];

        fs.readdirSync(MODEL_DIR).forEach(function (f) {
            if (!/\.js$/.test(f)) { return; }
            var src = stripComments(fs.readFileSync(path.join(MODEL_DIR, f), 'utf8'));
            if (/SELECT\s+project_id,\s*lat,\s*lon,\s*MAX\(site_id\)[\s\S]{0,80}?GROUP BY\s+project_id/i.test(src)) {
                offenders.push(f);
            }
        });

        expect(offenders,
            'this subquery is a 42803 parse error on PostgreSQL; use ' +
            'DISTINCT ON (project_id) ... ORDER BY project_id, site_id DESC')
            .to.deep.equal([]);
    });

    it('both call sites use the semantics-preserving DISTINCT ON form', function () {
        var users = fs.readFileSync(path.join(MODEL_DIR, 'users.js'), 'utf8');
        var projects = fs.readFileSync(path.join(MODEL_DIR, 'projects.js'), 'utf8');
        var re = /DISTINCT ON \(project_id\) project_id, lat, lon, site_id AS maxSiteId/;

        expect(re.test(users), 'model/users.js projectList() must use DISTINCT ON').to.equal(true);
        expect(re.test(projects), 'model/projects.js find() must use DISTINCT ON').to.equal(true);
    });

    it('neither call site uses MAX(lat)/MAX(lon), which parses but changes 2,363 projects', function () {
        ['users.js', 'projects.js'].forEach(function (f) {
            var src = stripComments(fs.readFileSync(path.join(MODEL_DIR, f), 'utf8'));
            expect(/MAX\(lat\)|MAX\(lon\)/i.test(src),
                f + ': MAX(lat)/MAX(lon) returns the greatest latitude and greatest ' +
                'longitude independently — not a real location').to.equal(false);
        });
    });
});