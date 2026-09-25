var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');
var vm = require('vm');

/**
 * Legacy visualizer, browse-by-playlist page menu (user report,
 * wendy.schackwitz@gmail.com 2026-09-10): stepping with ">|" from page 112 to
 * 113 left the menu on 106-112; it only moved (to 113-119) at page 116.
 *
 * Cause: a2Pager.set_page with block_tracks_page chose the ALIGNED block that
 * holds page-3 (BlockSize 7), so for three pages after each block boundary the
 * current page was not in the menu at all. Fix: a window centred on the
 * current page, clamped to [0, last_page].
 *
 * The factory is loaded from the SHIPPED file (no copy), with a stub angular
 * module that captures the a2Pager factory.
 */
function loadPager() {
    var src = fs.readFileSync(path.join(__dirname, '..', 'assets/app/app/visualizer/browser/recordings/by-playlist/recordings_by_playlist.js'), 'utf8');
    var factories = {};
    var mod = {
        factory: function (name, fn) { factories[name] = fn; return mod; },
        controller: function () { return mod; },
        directive: function () { return mod; },
        service: function () { return mod; },
        config: function () { return mod; },
        run: function () { return mod; },
        value: function () { return mod; },
        constant: function () { return mod; }
    };
    // The app's REAL makeClass (assets/app/services/a2utils.js 'a2.classy'),
    // loaded the same way, so the test exercises the shipped class machinery.
    var utilsSrc = fs.readFileSync(path.join(__dirname, '..', 'assets/app/services/a2utils.js'), 'utf8');
    var utilFactories = {};
    var utilMod = new Proxy({}, { get: function (_t, k) {
        return function (name, fn) { if (k === 'factory' || k === 'value') utilFactories[name] = fn; return utilMod; };
    } });
    var extend = function (dst) { for (var i = 1; i < arguments.length; i++) { var o = arguments[i]; if (o) Object.keys(o).forEach(function (k) { dst[k] = o[k]; }); } return dst; };
    vm.runInNewContext(utilsSrc, { angular: { module: function () { return utilMod; }, extend: extend }, window: {} });
    expect(utilFactories.makeClass, 'makeClass factory not found').to.be.a('function');
    var makeClass = utilFactories.makeClass(utilFactories.$inheritFrom);
    var sandbox = { angular: { module: function () { return mod; } }, console: { log: function () {} }, window: {} };
    vm.runInNewContext(src, sandbox);
    expect(factories.a2Pager, 'a2Pager factory not found').to.be.a('function');
    var Pager = factories.a2Pager(makeClass);
    // the pager checks `on_page instanceof Function` with the SANDBOX's Function;
    // a callback created in this realm would fail that check (a harness artefact,
    // not app behaviour), so callers wrap callbacks with Pager.fn().
    Pager.fn = vm.runInNewContext('(function (f) { return function () { return f.apply(this, arguments); }; })', sandbox);
    return Pager;
}

function menu(Pager, itemCount, uiPage) {
    var p = new Pager({ item_count: itemCount, page_size: 10, block_size: 7, block_tracks_page: true });
    p.set_page(uiPage - 1);
    return p.block.map(function (i) { return i + 1; }); // UI numbering
}

describe('legacy visualizer playlist page menu (a2Pager)', function () {
    var Pager;
    before(function () { Pager = loadPager(); });

    it('the report: after >| from 112 to 113 the menu contains 113 (was 106-112)', function () {
        var m = menu(Pager, 2000, 113);
        expect(m).to.include(113);
        expect(m).to.have.length(7);
    });

    it('the current page is in the menu on EVERY page (was missing on 3 of every 7)', function () {
        var pages = 200; // last UI page
        for (var ui = 1; ui <= pages; ui++) {
            var m = menu(Pager, pages * 10, ui);
            expect(m, 'page ' + ui).to.include(ui);
            expect(m[0], 'page ' + ui).to.be.at.least(1);
            expect(m[m.length - 1], 'page ' + ui).to.be.at.most(pages);
            expect(m.length, 'page ' + ui).to.equal(7);
        }
    });

    it('centres the window, and clamps it at both ends', function () {
        expect(menu(Pager, 2000, 113)).to.deep.equal([110, 111, 112, 113, 114, 115, 116]);
        expect(menu(Pager, 2000, 1)).to.deep.equal([1, 2, 3, 4, 5, 6, 7]);
        expect(menu(Pager, 2000, 2)).to.deep.equal([1, 2, 3, 4, 5, 6, 7]);
        expect(menu(Pager, 2000, 200)).to.deep.equal([194, 195, 196, 197, 198, 199, 200]);
    });

    it('a playlist with fewer pages than the block shows every page', function () {
        expect(menu(Pager, 35, 3)).to.deep.equal([1, 2, 3, 4]);
        expect(menu(Pager, 5, 1)).to.deep.equal([1]);
    });

    it('still loads the right page (offset unchanged)', function () {
        var seen = null;
        var p = new Pager({ item_count: 2000, page_size: 10, block_size: 7, block_tracks_page: true, on_page: Pager.fn(function (e) { seen = e; }) });
        p.set_page(112);
        expect(seen.page).to.equal(112);
        expect(seen.offset).to.equal(1120);
        expect(p.is_at_first_page).to.equal(false);
        expect(p.is_at_last_page).to.equal(false);
    });
});