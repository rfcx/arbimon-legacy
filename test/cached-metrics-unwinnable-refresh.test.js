/**
 * REGRESSION GUARD — the WARM path must not schedule a refresh that provably
 * cannot complete (§300 item F, 2026-09-14).
 *
 * getCachedMetrics serves the cached value BEFORE refreshing, so a refresh that
 * always dies is invisible to callers. That is why `recording-count` burned the
 * PG leader unnoticed: `SELECT count(*) FROM recordings` (~305 M rows) takes
 * 69-74 s against a routed-read statement_timeout of 8 s, so EVERY attempt was
 * cancelled. Measured on the leader: zero successful updates in 3 days of log;
 * 20 of 20 cancels in 2026-09-14T04:55-09:50Z were this one statement.
 *
 * Two layers, matching test/cached-metrics-cold-bound.test.js:
 *   (1) source-shape guards -- fail on the pre-fix file even if the behavioural
 *       harness cannot load;
 *   (2) a behavioural harness with a stubbed model: an expired unwinnable key
 *       must still SERVE its cached value and must NOT call the recalculation,
 *       while an expired ordinary key MUST still recalculate (the negative
 *       control that stops this becoming a blanket "never refresh" switch).
 *
 * Run standalone: node test/cached-metrics-unwinnable-refresh.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var Module = require('module');

var ROOT = path.join(__dirname, '..');
var n = 0, fails = 0;
function eq(name, a, b) {
    n++;
    try { assert.deepStrictEqual(a, b); console.log('ok   ' + name); }
    catch (e) { fails++; console.log('FAIL ' + name + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
}

// ---------------------------------------------------------------- (1) shape
var src = fs.readFileSync(path.join(ROOT, 'app/utils/cached-metrics.js'), 'utf8');
var code = src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n');

eq('shape: an unwinnable-refresh key set exists',
   /UNWINNABLE_WARM_REFRESH_KEYS/.test(code), true);
eq('shape: recording-count is in it',
   /UNWINNABLE_WARM_REFRESH_KEYS\s*=\s*\{[^}]*'recording-count'\s*:\s*true/.test(code), true);
eq('shape: the warm-path refresh is guarded before recalculateMetrics',
   /isUnwinnableRefresh\(k\)/.test(code), true);

// The accuracy comment (item 1) must not carry the false 0.003 % figure.
eq('shape: the false "0.003 %" reltuples accuracy claim is gone',
   /0\.003\s*%/.test(src), false);
eq('shape: the corrected +0.521 % figure is recorded',
   /0\.521\s*%/.test(src), true);

// Scope guard: this must NOT have become a blanket suppression.
eq('shape: suppression is key-scoped, not applied to every slow key',
   /UNWINNABLE_WARM_REFRESH_KEYS\[k\]\s*===\s*true/.test(code), true);

// ---------------------------------------------------------- (2) behavioural
// Inject a stub `../model` + dbpool into the require cache, then exercise the
// warm path. (rewire cannot rebind a `const` destructure; require-cache
// injection is the shape that works here -- see the 09-12 export-slash session.)
var recalcCalls = [];
var served = [];

function loadWithStubs(cachedRow) {
    var utilsDir = path.join(ROOT, 'app/utils');
    var modelPath = require.resolve(path.join(ROOT, 'app/model'));
    var dbpoolPath = require.resolve(path.join(utilsDir, 'dbpool'));
    var dbpoolPgPath = require.resolve(path.join(utilsDir, 'dbpool-pg'));
    var targetPath = require.resolve(path.join(utilsDir, 'cached-metrics'));

    [modelPath, dbpoolPath, dbpoolPgPath, targetPath].forEach(function (p) {
        delete require.cache[p];
    });

    function stub(p, exports) {
        var m = new Module(p, null);
        m.filename = p; m.loaded = true; m.exports = exports;
        require.cache[p] = m;
    }

    stub(modelPath, {
        projects: {
            getCachedMetrics: function () { return Promise.resolve(cachedRow ? [cachedRow] : []); },
            updateExpirationDate: function () { return Promise.resolve(); },
            updateCachedMetrics: function (o) { recalcCalls.push('update:' + o.key); return Promise.resolve(); },
            insertCachedMetrics: function (o) { recalcCalls.push('insert:' + o.key); return Promise.resolve(); },
            countAllProjects: function () { recalcCalls.push('count:project'); return Promise.resolve(42); }
        },
        recordings: {
            countAllRecordings: function () {
                recalcCalls.push('count:recordings');   // the expensive one
                return Promise.resolve(305018868);
            }
        },
        jobs: {}, species: {}, sites: {}, playlists: {}, patternMatchings: {}
    });
    stub(dbpoolPath, { query: function () { return Promise.resolve([]); } });
    stub(dbpoolPgPath, { isPg: true });

    return require(targetPath);
}

function fakeRes() {
    return { json: function (v) { served.push(v); return v; } };
}

// An EXPIRED row -> the warm path would normally refresh.
var expired = { value: 304983439, expires_at: '2000-01-01 00:00:00' };

function run() {
    // --- case A: the unwinnable key ---------------------------------------
    recalcCalls = []; served = [];
    var cm = loadWithStubs(expired);
    return Promise.resolve()
        .then(function () {
            return new Promise(function (resolve) {
                cm.getCachedMetrics({}, fakeRes(), { 'recording-count': 'recording-count' }, null, function () {});
                setTimeout(resolve, 50);
            });
        })
        .then(function () {
            eq('A: the cached value is still served for an expired unwinnable key',
               served, [304983439]);
            eq('A: NO recalculation was scheduled (this is the whole fix)',
               recalcCalls, []);

            // --- case B: negative control -- an ordinary key still refreshes
            recalcCalls = []; served = [];
            var cm2 = loadWithStubs(expired);
            return new Promise(function (resolve) {
                cm2.getCachedMetrics({}, fakeRes(), { 'project-count': 'project-count' }, null, function () {});
                setTimeout(resolve, 50);
            });
        })
        .then(function () {
            eq('B: an ordinary expired key STILL serves its cached value',
               served, [304983439]);
            eq('B: an ordinary expired key STILL recalculates (not a blanket switch)',
               recalcCalls.indexOf('count:project') !== -1, true);
        });
}

run().then(function () {
    console.log('\n' + (n - fails) + '/' + n + ' passed');
    if (fails) { process.exit(1); }
}).catch(function (e) {
    console.log('HARNESS ERROR: ' + (e && e.stack || e));
    process.exit(1);
});