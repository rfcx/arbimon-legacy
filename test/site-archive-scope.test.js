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