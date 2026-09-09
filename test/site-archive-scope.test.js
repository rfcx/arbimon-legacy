var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');
var sqlutil = require('../app/utils/sqlutil');

/**
 * `sites.deleted_at` IS AN ARCHIVE FLAG (2026-09-09).
 *
 * Nothing in the app destroys a site: removal is
 * `UPDATE sites SET deleted_at = NOW(), published = 0`. The site row, its
 * recordings and their analysis results all survive, and 19 read paths treat
 * the column as "hide this". The name is a historical misnomer.
 *
 * Rather than rename the column -- a cross-engine migration touching legacy,
 * the mysql2pg sync and bio-api at once, deliberately deferred to its own arc
 * post-P7 -- `sqlutil.siteArchiveScope()` names the CONCEPT correctly and gives
 * the rule one home, mirroring `recordingArchiveScope()` exactly so the two
 * compose.
 *
 * WHY IT MATTERS (measured on live data): 5,713,205 recordings on 9,903
 * removed sites are hidden by THIS flag while `recordings.archived_at IS
 * NULL`. Two parallel hiding mechanisms exist, so a recording read that
 * applies only the recording scope can serve recordings from a removed site.
 */

describe('siteArchiveScope — the site mirror of recordingArchiveScope', function () {

    it('defaults to the ACTIVE tier (fail-safe on unknown input)', function () {
        expect(sqlutil.siteArchiveScope('s')).to.equal('s.deleted_at IS NULL');
        expect(sqlutil.siteArchiveScope('s', 'nonsense')).to.equal('s.deleted_at IS NULL');
        expect(sqlutil.siteArchiveScope('s', undefined)).to.equal('s.deleted_at IS NULL');
    });

    it('supports the archived and all tiers', function () {
        expect(sqlutil.siteArchiveScope('s', 'archived')).to.equal('s.deleted_at IS NOT NULL');
        expect(sqlutil.siteArchiveScope('s', 'all')).to.equal('');
    });

    it('handles an empty alias (unqualified column)', function () {
        expect(sqlutil.siteArchiveScope('', 'active')).to.equal('deleted_at IS NULL');
    });

    it('mirrors recordingArchiveScope mode-for-mode, so the two compose', function () {
        ['active', 'archived', 'all', undefined].forEach(function (mode) {
            var rec = sqlutil.recordingArchiveScope('r', mode);
            var site = sqlutil.siteArchiveScope('s', mode);
            // same emptiness semantics for 'all'; same NULL/NOT NULL polarity otherwise
            expect(rec === '').to.equal(site === '', 'mode ' + mode + ' disagrees on empty');
            if (rec !== '') {
                expect(rec.indexOf('IS NOT NULL') > -1).to.equal(
                    site.indexOf('IS NOT NULL') > -1,
                    'mode ' + mode + ' disagrees on polarity'
                );
            }
        });
    });
});

describe('findProjectRecordings — the imported-sites precedence trap', function () {

    var src = fs.readFileSync(
        path.join(__dirname, '..', 'app/model/recordings.js'), 'utf8');
    // Bound by the NEXT top-level method, not by the first `.then(` -- the
    // first `.then` occurs BEFORE the SQL we are asserting on, which made an
    // earlier version of this test fail against correct code.
    var i = src.indexOf('findProjectRecordings: function');
    var end = src.indexOf('\n    countProjectRecordings', i);
    if (end === -1) { end = i + 6000; }
    var fn = src.slice(i, end);

    it('parenthesises the project-OR-imported branches', function () {
        // The bug: `WHERE s.project_id = ? AND s.deleted_at is null OR s.site_id in (...)`
        // binds as (project AND not-removed) OR (imported) -- the imported
        // branch carried NO archive predicate, so a REMOVED site shared into
        // another project would still be listed. Proven on live data by
        // simulation: old shape admits it (1), new shape blocks it (0).
        expect(fn).to.contain('WHERE (');
        expect(fn).to.not.match(/s\.project_id = \? AND s\.deleted_at is null\s*\\n"\s*\+\s*"OR/);
    });

    it('applies the site archive scope through sqlutil, not an inline literal', function () {
        expect(fn).to.contain('siteArchiveScope');
    });

    it('still selects the imported sites (the OR branch survives)', function () {
        expect(fn).to.contain('project_imported_sites');
    });
});

describe('findByUrlMatch — the project-wide site UNION', function () {

    var src = fs.readFileSync(
        path.join(__dirname, '..', 'app/model/recordings.js'), 'utf8');
    var i = src.indexOf('findByUrlMatch: function');
    var end = src.indexOf('\n    countProjectRecordings', i);
    if (end === -1) { end = src.indexOf('\n    fetchNext', i); }
    if (end === -1) { end = i + 12000; }
    var fn = src.slice(i, end);

    it('scopes BOTH union branches to live sites', function () {
        // The union had no deleted_at predicate on either branch, so a
        // project-wide LIST returned recordings from REMOVED sites: 9,903 such
        // sites across 959 projects, holding 5,713,205 unarchived recordings.
        var union = fn.slice(fn.indexOf('SELECT site_id FROM sites WHERE project_id'));
        union = union.slice(0, union.indexOf('[project_id, project_id]'));

        // Assert EACH BRANCH SEPARATELY. An earlier version of this test only
        // checked that a scope appeared SOMEWHERE in the union, which the
        // imported branch alone satisfied -- so reverting the own-sites branch
        // to unscoped passed. Caught by mutation testing (M1 survived); split
        // the assertion rather than trusting one substring.
        var ownBranch = union.slice(0, union.indexOf('UNION'));
        var importedBranch = union.slice(union.indexOf('UNION'));

        expect(ownBranch, 'own-sites branch is unscoped').to.contain('_siteActive');
        expect(importedBranch, 'imported branch is unscoped').to.contain('siteArchiveScope');
        // the imported branch must JOIN sites to be able to filter at all
        expect(importedBranch).to.contain('JOIN sites');
    });

    it('leaves BY-ID lookups unscoped (playlists/PM/training sets must keep working)', function () {
        // 2,290,255 playlist rows, 861,150 PM ROIs and 434 training-set ROIs
        // reference recordings on removed sites. They all resolve BY ID, and
        // the by-id path must skip both the archive scope and the union --
        // otherwise this fix silently breaks live features.
        expect(fn).to.contain('!urlquery.id && !urlquery.site');
        expect(fn).to.contain('!urlquery.id && !options.recording_id');
    });
});