/**
 * REGRESSION GUARD — the public "minutes of audio" metric (§315, Option 1 ruled
 * 2026-09-17; prompt runbooks/session-prompts/TILE-MINUTES-METRIC-2026-09-17.md).
 *
 * The metric is a `sum(duration)` over ~306 M rows — a 4-worker parallel
 * aggregate measured at ~55 s on the prod leader (2026-09-17, §297 victims 0).
 * That is UNWINNABLE in the request path, exactly like `recording-count`
 * (§314/#1879). These are SOURCE-SHAPE guards (the same layer as
 * test/cached-metrics-unwinnable-refresh.test.js §1): they fail on the
 * pre-change file, and they pin the three properties the feature depends on.
 *
 * The module's `model` binding is closure-scoped and not injectable without a
 * loader hook, so a from-outside behavioural drive would be a tautology (it
 * would test a stub, not the code). The shape guards ARE the §297 contract:
 * they assert the code paths that keep the 55 s scan out of the request.
 *
 * Run standalone: node test/cached-metrics-recording-minutes.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var n = 0, fails = 0;
function eq(name, a, b) {
    n++;
    try { assert.deepStrictEqual(a, b); console.log('ok   ' + name); }
    catch (e) { fails++; console.log('FAIL ' + name + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
}
function ok(name, cond) { eq(name, !!cond, true); }

var modelSrc = fs.readFileSync(path.join(ROOT, 'app/model/recordings.js'), 'utf8');
var metricsSrc = fs.readFileSync(path.join(ROOT, 'app/utils/cached-metrics.js'), 'utf8');
var routesSrc = fs.readFileSync(path.join(ROOT, 'app/routes/index.js'), 'utf8');

// ---- the model function -------------------------------------------------
ok('model: sumAllRecordingMinutes exists', /sumAllRecordingMinutes:\s*function/.test(modelSrc));
ok('model: sums duration as double precision (float4-sum drift guard)',
   /sum\(duration::double precision\)/.test(modelSrc));
ok('model: converts seconds to minutes (/ 60.0)', /\/\s*60\.0/.test(modelSrc));
ok('model: excludes null/zero duration', /duration IS NOT NULL AND duration > 0/.test(modelSrc));
// Option-1 corpus: the minutes set must match the count set — no
// archived_at / deleted_at / project filter inside the function.
ok('model: same corpus as count (no archived filter in the minutes function)',
   !/sumAllRecordingMinutes[\s\S]{0,500}?archived_at/.test(modelSrc));

// ---- the cached-metrics wiring ------------------------------------------
var metricsCode = metricsSrc.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n');

// ---- the cached-metrics wiring (comment-stripped, so comment length between the
// `case` and the call does not break the match) ------------------------------
ok('metrics: recording-minutes case routes to sumAllRecordingMinutes',
   /case 'recording-minutes':[\s\S]{0,200}?sumAllRecordingMinutes\(\)/.test(metricsCode));
ok('metrics: recording-minutes is in UNWINNABLE_WARM_REFRESH_KEYS',
   /UNWINNABLE_WARM_REFRESH_KEYS\s*=\s*\{[^}]*'recording-minutes':\s*true/.test(metricsSrc));
// §297: the COLD path must skip launching the scan for unwinnable keys too —
// a bounded wait still STARTS the work. Assert the skip branch exists.
ok('metrics: cold path skips recalc for unwinnable keys (refresh left to out-of-band)',
   /isUnwinnableRefresh\(k\)[\s\S]{0,400}?refresh left to out-of-band/.test(metricsSrc));
// negative control: recording-count must still be unwinnable (no regression).
ok('metrics: recording-count still unwinnable (no regression)',
   /UNWINNABLE_WARM_REFRESH_KEYS\s*=\s*\{[^}]*'recording-count':\s*true/.test(metricsSrc));

// ---- the route ----------------------------------------------------------
ok('route: /legacy-api/recordings-minutes exists', /recordings-minutes/.test(routesSrc));
ok('route: minutes route is above the login gate (public, like the count)',
   routesSrc.indexOf('recordings-minutes') !== -1 &&
   routesSrc.indexOf('recordings-minutes') < routesSrc.indexOf("router.use('/', parseTokenData(), login)"));
ok('route: minutes route passes the recording-minutes key to getCachedMetrics',
   /recordings-minutes[\s\S]{0,300}?'recording-minutes':\s*'recording-minutes'/.test(routesSrc));

console.log('\n' + (n - fails) + '/' + n + ' passed');
process.exit(fails === 0 ? 0 : 1);
