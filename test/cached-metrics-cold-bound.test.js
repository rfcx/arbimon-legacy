/**
 * REGRESSION GUARD — the cached-metrics COLD path must never block the response
 * on an unbounded recalculation (P7 debt #9a, 2026-09-10).
 *
 * Before this fix, an ABSENT cache key made getCachedMetrics `await` the full
 * recalculation before res.json. On the PG leader `SELECT count(*) FROM
 * recordings` is 84-100 s (cancelled at the 8 s route timeout, failing open to
 * MariaDB's 16 s); the largest project's `-rec` count is 8.4 s. At P7 there is
 * no fail-open, so the cold path becomes a user-facing error.
 *
 * Two layers, deliberately:
 *   (1) source-shape guards (same style as test/500-guards.test.js D1b) -- fail
 *       on the pre-fix file even if the behavioural harness cannot load;
 *   (2) a behavioural harness with a stubbed model: a slow recalculation must
 *       answer inside the bound with the estimate/null, a fast one must answer
 *       with the exact value, and a late rejection must NOT be unhandled.
 *
 * Run standalone: node test/cached-metrics-cold-bound.test.js
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
eq('shape: the unbounded `await recalculateMetrics(..., insert=true)` before res.json is gone',
   /await recalculateMetrics\(k, v, params, insert=true\)/.test(code), false);
eq('shape: a COLD_KEY_BOUND_MS exists', /COLD_KEY_BOUND_MS/.test(code), true);
eq('shape: the cold recalc promise has a .catch attached (no unhandled rejection after the bound)',
   /recalc\.catch\(/.test(code), true);
eq('shape: the PG estimate is an engine branch on isPg, not a translator rule',
   /dbpoolPg\.isPg/.test(code), true);
eq('shape: the estimate never falls back to 0 for a non-global key',
   /return null\s*$/m.test(code) && !/res\.json\(0\)/.test(code), true);

// ---------------------------------------------------------------- (2) behaviour
// Load app/utils/cached-metrics.js with its requires stubbed (no DB, no config).
function loadWithStubs(stubs) {
    var origLoad = Module._load;
    Module._load = function (request, parent) {
        if (stubs.hasOwnProperty(request)) { return stubs[request]; }
        return origLoad.apply(this, arguments);
    };
    try {
        var p = path.join(ROOT, 'app/utils/cached-metrics.js');
        delete require.cache[require.resolve(p)];
        return require(p);
    } finally { Module._load = origLoad; }
}

function fakeRes() {
    var out = { sent: undefined, calls: 0 };
    out.type = function () { return out; };
    out.json = function (v) { out.sent = v; out.calls++; out.resolve && out.resolve(v); return out; };
    out.done = new Promise(function (r) { out.resolve = r; });
    return out;
}

function delay(ms, v) { return new Promise(function (r) { setTimeout(function () { r(v); }, ms); }); }

async function run() {
    process.env.METRICS_COLD_BOUND_MS = '60';
    var inserted = [];
    var rows = [];                       // getCachedMetrics returns this (empty = cold)
    var countDelayMs = 0, countValue = 0, countReject = null;
    var model = {
        projects: {
            getCachedMetrics: async function () { return rows; },
            insertCachedMetrics: async function (o) { inserted.push(o); return null; },
            updateCachedMetrics: async function () { return null; },
            updateExpirationDate: async function () { return null; },
            totalRecordings: async function () {
                if (countReject) { await delay(countDelayMs); throw countReject; }
                return delay(countDelayMs, countValue);
            },
            countAllProjects: async function () { return 1; },
        },
        recordings: { countAllRecordings: async function () { return delay(countDelayMs, countValue); } },
    };
    var estimateRows = [{ estimate: 306609408 }];
    var dbpoolStub = { query: async function (sql) { return /pg_class/.test(sql) ? estimateRows : []; } };
    var unhandled = [];
    process.on('unhandledRejection', function (e) { unhandled.push(e); });

    var cm = loadWithStubs({ '../model': model, './dbpool': dbpoolStub, './dbpool-pg': { isPg: true } });

    // A. FAST cold key -> exact value inside the bound
    countDelayMs = 5; countValue = 4242;
    var res = fakeRes();
    cm.getCachedMetrics({}, res, { 'project-recording-count': 'project-1-rec' }, 1, function (e) { throw e; });
    await res.done;
    eq('fast cold key: served the EXACT value', res.sent, 4242);
    await delay(20);
    eq('fast cold key: row inserted once', inserted.length, 1);

    // B. SLOW per-project cold key -> null (NOT 0) inside the bound; refresh continues and inserts later
    inserted.length = 0; countDelayMs = 200; countValue = 987654;
    res = fakeRes();
    var t0 = Date.now();
    cm.getCachedMetrics({}, res, { 'project-recording-count': 'project-2-rec' }, 2, function (e) { throw e; });
    await res.done;
    var elapsed = Date.now() - t0;
    eq('slow per-project cold key: served null (not 0, not the value)', res.sent, null);
    eq('slow per-project cold key: answered inside the bound (<150 ms)', elapsed < 150, true);
    eq('slow per-project cold key: nothing inserted yet at response time', inserted.length, 0);
    await delay(300);
    eq('slow per-project cold key: background refresh still landed the row', inserted.length === 1 && inserted[0].value === 987654, true);
    eq('slow per-project cold key: res.json called exactly once', res.calls, 1);

    // C. SLOW global recording-count on PG -> reltuples estimate
    inserted.length = 0; countDelayMs = 200; countValue = 1;
    res = fakeRes();
    cm.getCachedMetrics({}, res, { 'recording-count': 'recording-count' }, null, function (e) { throw e; });
    await res.done;
    eq('slow global count on pg: served the reltuples estimate', res.sent, 306609408);
    await delay(300);

    // D. late REJECTION after the bound -> logged, not unhandled, response already sent
    countDelayMs = 200; countReject = new Error('canceling statement due to statement timeout');
    var errLog = [];
    var origErr = console.error; console.error = function (m) { errLog.push(String(m)); };
    res = fakeRes();
    cm.getCachedMetrics({}, res, { 'project-recording-count': 'project-3-rec' }, 3, function (e) { throw e; });
    await res.done;
    await delay(300);
    console.error = origErr;
    eq('late rejection: response was sent (null)', res.sent, null);
    eq('late rejection: logged via console.error', errLog.some(function (l) { return /cold refresh failed/.test(l); }), true);
    eq('late rejection: NO unhandled rejection', unhandled.length, 0);
    countReject = null;

    // E. WARM path untouched: row present -> value served, no recalculation awaited
    rows = [{ key: 'project-4-rec', value: 77, expires_at: '2099-01-01 00:00:00' }];
    countDelayMs = 200;
    res = fakeRes();
    t0 = Date.now();
    cm.getCachedMetrics({}, res, { 'project-recording-count': 'project-4-rec' }, 4, function (e) { throw e; });
    await res.done;
    eq('warm key: served the cached value immediately', res.sent === 77 && (Date.now() - t0) < 100, true);

    console.log('\n' + (fails ? ('FAILED ' + fails + '/' + n) : ('ALL ' + n + ' PASS')));
    process.exit(fails ? 1 : 0);
}
run().catch(function (e) { console.log('HARNESS ERROR', e); process.exit(2); });