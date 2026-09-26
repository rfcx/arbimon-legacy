var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

// Pure-function tests; the model itself cannot be loaded without the DB stack
// (same approach as recordings-date-range-fastpath.test.js).
var resolve = require('../app/utils/site-selection').resolveSiteSelection;

/**
 * REGRESSION GUARD (2026-09-26).
 *
 * The SPA's recordings page restores filters from the URL. A reloaded/shared
 * `?f.sites=88030` sends `sites_ids=88030` WITHOUT `sites` (names), and the
 * search route used to key its site filter on the NAMES, so the ids were
 * silently ignored: the page said "Filters applied" over the UNFILTERED list.
 * Measured on prod: Apply -> 90 rows; reload of the identical URL -> 405.
 */
var SITE_DATA = {
    10: { site_id: 10, name: 'Site A', project_id: 1 },
    11: { site_id: 11, name: 'Site B', project_id: 1 },
    12: { site_id: 12, name: 'Shared', project_id: 2 }   // imported site
};

describe('recordings/search site selection', function () {

    it('no site params -> not explicit, every project site', function () {
        var r = resolve(SITE_DATA, undefined, undefined);
        expect(r.explicit).to.equal(false);
        expect(r.ids.sort()).to.deep.equal([10, 11, 12]);
    });

    it('THE BUG: sites_ids WITHOUT names is honoured (URL-restored filter)', function () {
        var r = resolve(SITE_DATA, [11], undefined);
        expect(r).to.deep.equal({ explicit: true, ids: [11] });
    });

    it('a single (non-array) sites_ids value is honoured', function () {
        expect(resolve(SITE_DATA, 11, undefined)).to.deep.equal({ explicit: true, ids: [11] });
    });

    it('sites_ids + names (the Apply-click shape) -> ids win', function () {
        expect(resolve(SITE_DATA, [10], ['Site B'])).to.deep.equal({ explicit: true, ids: [10] });
    });

    it('names only (legacy callers) resolve through the project site set', function () {
        expect(resolve(SITE_DATA, undefined, ['Site B', 'Nope'])).to.deep.equal({ explicit: true, ids: [11] });
        expect(resolve(SITE_DATA, undefined, 'Site A')).to.deep.equal({ explicit: true, ids: [10] });
    });

    it('imported sites are selectable', function () {
        expect(resolve(SITE_DATA, [12], undefined)).to.deep.equal({ explicit: true, ids: [12] });
    });

    it('a foreign site id can never widen the scope', function () {
        expect(resolve(SITE_DATA, [10, 999], undefined)).to.deep.equal({ explicit: true, ids: [10] });
    });

    it('an explicit selection matching nothing stays explicit and EMPTY (never "all sites")', function () {
        expect(resolve(SITE_DATA, [999], undefined)).to.deep.equal({ explicit: true, ids: [] });
        expect(resolve(SITE_DATA, undefined, ['Nope'])).to.deep.equal({ explicit: true, ids: [] });
    });

    it('empty arrays are the same as absent', function () {
        expect(resolve(SITE_DATA, [], []).explicit).to.equal(false);
    });

    it('duplicates are collapsed', function () {
        expect(resolve(SITE_DATA, [11, 11, 10], undefined).ids).to.deep.equal([11, 10]);
    });

    it('findProjectRecordings is wired through the resolver (no names-keyed site branch left)', function () {
        var src = fs.readFileSync(path.join(__dirname, '..', 'app/model/recordings.js'), 'utf8');
        var i = src.indexOf('findProjectRecordings: function');
        var end = src.indexOf('buildSearchQuery: function', i);
        expect(i).to.be.greaterThan(-1);
        expect(end).to.be.greaterThan(i);
        var fn = src.slice(i, end);
        expect(fn).to.contain('siteSelectionUtil.resolveSiteSelection(');
        expect(fn).to.contain('explicitSites: siteSelection.explicit');
        expect(fn).to.not.contain('if (!parameters.sites)');
        expect(fn).to.not.contain('if (parameters.sites)');
        expect(fn).to.not.contain('data.push(parameters.sites_ids)');
        // The explicit-selection shape must stay JOIN sites + s.site_id IN:
        // the flat r.site_id IN (a,b) form makes MIN/MAX(datetime) cancel at
        // the PG statement_timeout (measured 2026-09-26).
        var sel = fn.slice(fn.indexOf('siteSelectionUtil.resolveSiteSelection('), fn.indexOf('if(parameters.range)'));
        expect(sel).to.contain('tables.push("JOIN sites AS s ON s.site_id = r.site_id")');
        expect(sel).to.contain("constraints.push('s.site_id IN (?)')");
        expect(sel).to.contain('data.push(siteSelection.ids)');
    });
});