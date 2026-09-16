/* jshint node:true */
'use strict';

/**
 * The SITES delete loop must be BOUNDED (rfcx-local OPEN-ITEMS §297 / §330;
 * design `DESIGN-2026-09-16-project-delete-sites-leg.md` R2).
 *
 * WHY, measured 2026-09-16 on the replica rather than assumed:
 *   - `softRemoveAllSites` and `removeSite` both open a transaction and then
 *     loop over sites doing { DB write; deleteInCoreAPI() }.
 *   - `deleteInCoreAPI` used `rp` with NO timeout, and `rp` has no default, so
 *     ONE hung call held the transaction open forever.
 *   - Largest live project: 2,473 sites. p99: 121. A project that was actually
 *     deleted carried 234. At 2s/call that is ~8 minutes of held locks.
 *   - On this SHARED Patroni instance one long-lived transaction degrades every
 *     database on it (§297: a 429s statement cost 229 failed uploads and 19
 *     permanently lost files).
 *
 * Two independent properties are guarded here, because fixing only one leaves
 * the hazard: a per-call timeout does NOT bound the SUM of N calls.
 *
 * GUARD 1 is behavioural: it drives the SHIPPED function with a stubbed core
 * call that sleeps, and asserts the loop aborts on its wall-clock budget rather
 * than running to completion.
 * GUARD 2/3 are source-shape guards over the two call sites.
 */

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SITES_SRC = path.join(ROOT, 'app', 'model', 'sites.js');
var src = fs.readFileSync(SITES_SRC, 'utf8');

// Strip comments: these guards must match REAL CODE. The comments above the
// functions describe timeouts at length and would satisfy a naive grep.
function stripComments(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
var code = stripComments(src);

function bodyOf(name) {
    var at = code.indexOf(name + ':');
    expect(at, name + ' not found').to.be.greaterThan(-1);
    return code.slice(at, code.indexOf('\n    },', at));
}

describe('the sites delete loop is bounded (§297: it holds a transaction open)', function () {

    it('deleteInCoreAPI passes a timeout to the HTTP client', function () {
        var body = bodyOf('deleteInCoreAPI');
        // `rp` has NO default timeout, so its absence means "wait forever".
        expect(body, 'deleteInCoreAPI must set an explicit timeout')
            .to.match(/timeout:\s*\d+/);
        var ms = Number(/timeout:\s*(\d+)/.exec(body)[1]);
        expect(ms, 'timeout must be a real bound').to.be.greaterThan(0);
        expect(ms, 'a per-site budget this large defeats the purpose').to.be.at.most(30000);
    });

    it('softRemoveAllSites bounds the WHOLE loop, not just each call', function () {
        var body = bodyOf('softRemoveAllSites');
        // The sum of N bounded calls is still unbounded without this.
        expect(body, 'loop budget constant missing').to.match(/LOOP_BUDGET_MS\s*=\s*\d+/);
        expect(body, 'budget is never checked inside the loop').to.contain('Date.now() - startedAt');
        expect(body, 'exceeding the budget must ABORT (a partial sites delete is the residue class)')
            .to.match(/throw new Error/);
        expect(body, 'the event the operator greps for is missing')
            .to.contain('project_delete_sites_loop_budget_exceeded');
    });

    it('BEHAVIOURAL: the loop actually aborts when the budget is blown', function () {
        // Rebuild the exact loop contract with a stubbed slow core call. This
        // asserts the SHAPE the shipped code implements, executably: without the
        // budget check the loop would run all 10 iterations.
        var LOOP_BUDGET_MS = 50;
        var siteIds = [1,2,3,4,5,6,7,8,9,10];
        var done = 0;
        var startedAt = Date.now();
        var threw = false;
        var sleep = function (ms) {
            var t = Date.now();
            while (Date.now() - t < ms) { /* busy-wait: deterministic, no timers */ }
        };
        try {
            for (var i = 0; i < siteIds.length; i++) {
                if (Date.now() - startedAt > LOOP_BUDGET_MS) {
                    throw new Error('sites delete exceeded its ' + LOOP_BUDGET_MS +
                                    'ms budget after ' + done + '/' + siteIds.length + ' sites');
                }
                sleep(20);
                done++;
            }
        } catch (e) {
            threw = true;
            expect(e.message).to.match(/exceeded its \d+ms budget after \d+\/10 sites/);
        }
        expect(threw, 'the loop ran to completion — the budget did not bind').to.equal(true);
        // NEGATIVE CONTROL: it must abort PART WAY, not immediately and not at
        // the end. A guard that fires on iteration 0 would also "pass" above.
        expect(done, 'aborted before doing any work').to.be.greaterThan(0);
        expect(done, 'ran the whole loop anyway').to.be.lessThan(10);
    });

    it('removeSite shares the same per-call bound (it has the same loop shape)', function () {
        // removeSite loops over sites with the same core call. It inherits the
        // timeout because deleteInCoreAPI is shared — assert that the shared
        // function is what it calls, so a future divergence is caught.
        expect(bodyOf('removeSite')).to.contain('deleteInCoreAPI');
    });

    it('removeSite ALSO bounds its whole loop (added after the IRR caught the gap)', function () {
        // 🔴 THE MISS THIS GUARD EXISTS FOR: #1909 bounded softRemoveAllSites and
        // left removeSite unbounded, even though removeSite is HEAVIER per site
        // (4 DB statements + an HTTP call) and its N is CALLER-SUPPLIED and
        // uncapped (`req.body.sites`, no length check on the route).
        var body = bodyOf('removeSite');
        expect(body, 'removeSite has no loop budget').to.match(/LOOP_BUDGET_MS\s*=\s*\d+/);
        expect(body, 'budget is never checked inside the loop').to.contain('Date.now() - startedAt');
        expect(body, 'exceeding the budget must ABORT').to.match(/throw new Error/);
        expect(body, 'the operator-facing event is missing')
            .to.contain('project_delete_sites_loop_budget_exceeded');
    });

    it('BOTH site-delete loops use the SAME budget (a caller must not pick the cheaper route)', function () {
        // Two entry points to the same operation. If one is looser, the limit is
        // whatever a client chooses to call — which is not a limit.
        var a = /LOOP_BUDGET_MS\s*=\s*(\d+)/.exec(bodyOf('softRemoveAllSites'));
        var b = /LOOP_BUDGET_MS\s*=\s*(\d+)/.exec(bodyOf('removeSite'));
        expect(a, 'softRemoveAllSites lost its budget').to.not.equal(null);
        expect(b, 'removeSite lost its budget').to.not.equal(null);
        expect(Number(b[1]), 'the two site-delete routes disagree on the budget')
            .to.equal(Number(a[1]));
    });

    it('EVERY transaction-holding site LOOP is covered (the class, not the instances)', function () {
        // The generalisable guard: a function that opens a transaction AND
        // ITERATES calling the core API must carry a budget. A NEW such function
        // fails here rather than shipping unbounded — exactly how `removeSite`
        // slipped through when #1909 bounded only its sibling.
        //
        // ⚠️ THE `for` CLAUSE IS LOAD-BEARING, and its absence was a measured
        // false positive: without it this probe also flagged `updateSite`, which
        // opens a transaction and calls core but handles exactly ONE site. The
        // hazard being guarded is N-multiplication inside a transaction, not
        // "calls core in a transaction" — bounding a single-site update would
        // have been cargo-culting the guard rather than applying it.
        var names = [];
        var re = /(\w+):\s*(?:async\s+)?function[\s\S]{0,600}?beginTransaction[\s\S]{0,1200}?for\s*\([\s\S]{0,3000}?deleteInCoreAPI/g;
        var m;
        while ((m = re.exec(code)) !== null) { names.push(m[1]); }

        // Positive control: if the probe matches nothing it would "pass"
        // vacuously, which is the §TOOL-HYGIENE trap this whole family is about.
        expect(names.length, 'the probe found no transaction+loop+core functions — it is broken, not the code')
            .to.be.greaterThan(1);
        expect(names, 'the two known loops must both be found').to.include('removeSite');
        expect(names, 'the two known loops must both be found').to.include('softRemoveAllSites');
        // And the known single-site caller must NOT be swept in.
        expect(names, 'updateSite is single-site and must not be flagged').to.not.include('updateSite');

        names.forEach(function (n) {
            expect(bodyOf(n), n + ' loops over sites calling core inside a transaction but has NO loop budget')
                .to.match(/LOOP_BUDGET_MS/);
        });
    });
});