/**
 * REGRESSION GUARD — the public "countries & territories" metric (rfcx-local
 * OPEN-ITEMS §493, operator rulings 2026-10-23 17:41/17:43).
 *
 * `sites.country_code` is recomputed nightly from the coordinates by rfcx-local's
 * count-repair-plane (offline Natural Earth MAP UNITS, so PR != US), and the same
 * plane writes `cached_metrics.country-count`. The app serves that row and never
 * recomputes it (UNWINNABLE_WARM_REFRESH_KEYS) — not because the query is slow
 * (~30 ms) but so the tile and the column move together once a day.
 *
 * SOURCE-SHAPE guards, same layer as test/cached-metrics-recording-minutes.test.js
 * (the module's `model` binding is closure-scoped; a from-outside drive would test a
 * stub). They fail on the pre-change tree and pin the four properties the tile needs.
 *
 * Run standalone: node test/cached-metrics-country-count.test.js
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

var sitesSrc = fs.readFileSync(path.join(ROOT, 'app/model/sites.js'), 'utf8');
var metricsSrc = fs.readFileSync(path.join(ROOT, 'app/utils/cached-metrics.js'), 'utf8');
var routesSrc = fs.readFileSync(path.join(ROOT, 'app/routes/index.js'), 'utf8');
var strip = function (s) { return s.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n'); };
var sitesCode = strip(sitesSrc), metricsCode = strip(metricsSrc), routesCode = strip(routesSrc);

// ---- the model function -------------------------------------------------
ok('model: countAllCountries exists', /countAllCountries:\s*function/.test(sitesCode));
var fn = (sitesCode.match(/countAllCountries:\s*function[\s\S]{0,700}?\n    \},/) || [''])[0];
ok('model: counts DISTINCT country_code', /count\(DISTINCT s\.country_code\)/.test(fn));
ok('model: excludes NULL country (invalid coordinates have no country)', /country_code IS NOT NULL/.test(fn));
ok('model: live sites with data only (deleted_at IS NULL AND rec_count > 0)', /s\.deleted_at IS NULL AND s\.rec_count > 0/.test(fn));
ok('model: live projects only (deleted-projects ruling)', /JOIN projects p[\s\S]{0,200}?p\.deleted_at IS NULL/.test(fn));

// ---- the cached-metrics wiring ------------------------------------------
ok('metrics: country-count case routes to sites.countAllCountries',
   /case 'country-count':[\s\S]{0,200}?model\.sites\.countAllCountries\(\)/.test(metricsCode));
ok('metrics: country-count is in UNWINNABLE_WARM_REFRESH_KEYS (plane-owned)',
   /UNWINNABLE_WARM_REFRESH_KEYS\s*=\s*\{[^}]*'country-count':\s*true/.test(metricsSrc));
// negative controls: the two existing unwinnable keys are still there
ok('metrics: recording-count still unwinnable', /UNWINNABLE_WARM_REFRESH_KEYS\s*=\s*\{[^}]*'recording-count':\s*true/.test(metricsSrc));
ok('metrics: recording-minutes still unwinnable', /UNWINNABLE_WARM_REFRESH_KEYS\s*=\s*\{[^}]*'recording-minutes':\s*true/.test(metricsSrc));

// ---- the route ----------------------------------------------------------
var routeIdx = routesCode.indexOf("'/legacy-api/countries-count'");
ok('route: GET /legacy-api/countries-count exists', routeIdx > 0);
ok('route: serves key country-count (singular key, plural path — like recordings-count)',
   /'\/legacy-api\/countries-count'[\s\S]{0,200}?\{ 'country-count': 'country-count' \}/.test(routesCode));
// public: registered ABOVE the login gate, like the other landing metrics
var loginIdx = routesCode.indexOf("router.use('/', parseTokenData(), login)");
ok('route: registered above the login gate (public)', loginIdx > routeIdx);

console.log('\n' + (n - fails) + '/' + n + ' passed');
if (fails) process.exit(1);