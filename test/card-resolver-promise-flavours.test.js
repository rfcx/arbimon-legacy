/* jshint node:true */
'use strict';

// card-resolver must return a Q promise even when a card function returns a
// NATIVE promise. Run: node test/card-resolver-promise-flavours.test.js
//
// Live defect 2026-09-27: §391 (project-scope.js, deliberately zero-dep
// native-Promise) made resource-cards/visualizer.js return a native promise;
// card-resolver returned it raw and both callers (routes/project.js:141,
// routes/citizen-scientist.js:106) call the Q-only `.nodeify` on the result.
// Every cold /project/<slug>/visualizer/rec/<id> load threw
// `TypeError: ...nodeify is not a function`, caught by the pod-kill net
// (UNHANDLED_ERROR_NET, survivable:false) -> process exit -> pod restart.
//
// These tests exercise the REAL app/utils/card-resolver.js, so a regression
// in the real file fails them.

const assert = require('assert');
const Q = require('q');
const CardResolver = require('../app/utils/card-resolver');

let pass = 0;
let fail = 0;
function ok (label, cond) {
    if (cond) { console.log('  ok   ' + label); pass++; }
    else { console.log('  FAIL ' + label); fail++; }
}

const project = { project_id: 1 };
const appUrl = 'https://example.org/project/x/';

// card stack with one function card at visualizer/rec, like the real one
function makeStack (cardFn) {
    return { visualizer: { rec: cardFn } };
}

const jobs = [];

// 1. native-Promise card: nodeify must exist and resolve with the card
(function () {
    const resolver = CardResolver(makeStack(function () {
        return Promise.resolve({ name: 'native card' });
    }));
    const d = Q.defer();
    jobs.push(d.promise);
    let thunk;
    try {
        thunk = resolver.getCardFor(project, appUrl, 'visualizer/rec/123');
    } catch (e) {
        ok('native-promise card: getCardFor does not throw synchronously', false);
        d.resolve(); return;
    }
    ok('native-promise card: getCardFor does not throw synchronously', true);
    ok('native-promise card: result has .nodeify', typeof thunk.nodeify === 'function');
    thunk.nodeify(function (err, card) {
        ok('native-promise card: resolves, no err', !err);
        ok('native-promise card: card passed through', !!card && card.name === 'native card');
        d.resolve();
    });
})();

// 2. Q-promise card (the pre-§391 shape): unchanged behaviour
(function () {
    const resolver = CardResolver(makeStack(function () {
        return Q.resolve({ name: 'q card' });
    }));
    const d = Q.defer();
    jobs.push(d.promise);
    resolver.getCardFor(project, appUrl, 'visualizer/rec/123').nodeify(function (err, card) {
        ok('q card: resolves, no err', !err);
        ok('q card: card passed through', !!card && card.name === 'q card');
        d.resolve();
    });
})();

// 3. native-Promise REJECTION: must reach the nodeify callback as err
//    (today callers render the app shell without a card on err)
(function () {
    const resolver = CardResolver(makeStack(function () {
        return Promise.reject(new Error('db gone'));
    }));
    const d = Q.defer();
    jobs.push(d.promise);
    resolver.getCardFor(project, appUrl, 'visualizer/rec/123').nodeify(function (err) {
        ok('native rejection: err delivered to callback', !!err && /db gone/.test(err.message));
        d.resolve();
    });
})();

// 4. no matching card (unknown path): resolves undefined, no throw
(function () {
    const resolver = CardResolver(makeStack(function () {
        return Promise.resolve({ name: 'unused' });
    }));
    const d = Q.defer();
    jobs.push(d.promise);
    resolver.getCardFor(project, appUrl, 'unknown/path/here').nodeify(function (err, card) {
        ok('no-card path: no err', !err);
        ok('no-card path: card is undefined', card === undefined);
        d.resolve();
    });
})();

// 5. synchronous throw inside the card function still propagates
//    synchronously (behaviour unchanged by the assimilation wrap)
(function () {
    const resolver = CardResolver(makeStack(function () {
        throw new Error('sync boom');
    }));
    let threw = false;
    try {
        resolver.getCardFor(project, appUrl, 'visualizer/rec/123');
    } catch (e) {
        threw = /sync boom/.test(e.message);
    }
    ok('sync-throwing card: throws synchronously', threw);
})();

// 6. prototype members are NOT cards: 'constructor' is an inherited Function
//    and must not be invoked (CodeQL js/unsafe-dynamic-method-access);
//    the walk must treat it as an unknown path and resolve undefined
(function () {
    const resolver = CardResolver(makeStack(function () {
        return Promise.resolve({ name: 'unused' });
    }));
    const d = Q.defer();
    jobs.push(d.promise);
    resolver.getCardFor(project, appUrl, 'visualizer/constructor/123').nodeify(function (err, card) {
        ok('prototype member: no err', !err);
        ok('prototype member: not invoked, card undefined', card === undefined);
        d.resolve();
    });
})();

Q.all(jobs).then(function () {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
}, function (e) {
    console.log('\nharness error: ' + (e && e.stack || e));
    process.exit(2);
});
