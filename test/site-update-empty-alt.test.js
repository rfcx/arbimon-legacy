/**
 * REGRESSION GUARD — site edit with a blank Altitude must not 500 on PG
 * (rfcx-local FINDING-2026-10-23-site-edit-empty-altitude-pg-500).
 *
 * The site form sends `alt: ''` when the Altitude box is empty. `sites.update()` normalised
 * empty lat/lon to NULL but wrote alt verbatim: `alt = ''`. MariaDB (sql_mode='') coerced
 * that to 0; PG (write authority since 2026-09-12) rejects it — 22P02 invalid input syntax
 * for type double precision: "" — and the edit returns 500. 30/30 blank-alt edits failed in
 * 30 days (7 users); 13/13 with alt filled succeeded.
 *
 * Behavioural: drives the SHIPPED `update()` and inspects the SQL it would execute.
 * alt = 0 MUST survive (25,976 live sites legitimately store 0; the SPA pre-fills "0").
 *
 * Run standalone: node test/site-update-empty-alt.test.js
 */
var assert = require('assert');
var path = require('path');
var Module = require('module');

var SITES = path.join(__dirname, '..', 'app', 'model', 'sites.js');
var stubs = {
    'aws-sdk': { S3: function () {} },
    'joi': {},
    'q': {},
    'request': function () {},
    'tz-lookup': function () { return 'UTC'; },
    'jsonwebtoken': {},
    'moment': function () { return { format: function () { return '2026-10-23 00:00:00'; } }; },
    '../config': function () { return {}; },
    '../utils/dbpool': {
        // mysql-style escape: strings quoted, null -> NULL, numbers bare
        escape: function (v) { return v === null || v === undefined ? 'NULL' : (typeof v === 'number' ? String(v) : "'" + String(v) + "'"); },
        escapeId: function (v) { return v; }
    },
    './site-rec-count': {},
    './playlist-rec-count': {},
    '../utils/sqlutil': {},
    '../utils/apierror': function () {},
    '../utils/core-api-url': { coreApiBaseUrl: function () { return 'http://core'; } },
    './projects': {}
};
stubs.moment.utc = stubs.moment;
var origLoad = Module._load;
Module._load = function (request) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return origLoad.apply(this, arguments);
};
var sites;
try { sites = require(SITES); } catch (e) { console.log('CANNOT LOAD sites.js: ' + e.message); process.exit(2); }
finally { Module._load = origLoad; }

function sqlFor (site) {
    var captured = null;
    sites.update(site, { query: function (q, cb) { captured = q; cb(null, {}); } }, function () {});
    return captured;
}
function altClause (sql) {
    var m = /\balt = ([^,\n]+)/.exec(sql || '');
    return m ? m[1].trim() : '(absent)';
}

var n = 0, fails = 0;
function eq (name, got, want) {
    n++;
    try { assert.deepStrictEqual(got, want); console.log('ok   ' + name); }
    catch (e) { fails++; console.log('FAIL ' + name + '  (got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want) + ')'); }
}

// control: the harness must see a normal edit at all (a vacuous harness would pass everything)
var control = sqlFor({ site_id: 1, name: 'x', lat: '-37.69', lon: '147.40', alt: '12.5' });
eq('control: harness captures an UPDATE', /^UPDATE sites/.test(control || ''), true);
eq('control: filled alt written verbatim', altClause(control), "'12.5'");

eq("alt '' -> NULL (was '' -> PG 22P02 -> 500)", altClause(sqlFor({ site_id: 1, name: 'x', lat: '-37.69', lon: '147.40', alt: '' })), 'NULL');
eq("alt '   ' -> NULL", altClause(sqlFor({ site_id: 1, name: 'x', lat: '-37.69', lon: '147.40', alt: '   ' })), 'NULL');
eq('alt null -> NULL', altClause(sqlFor({ site_id: 1, name: 'x', alt: null })), 'NULL');
eq('alt 0 (number) KEPT as 0', altClause(sqlFor({ site_id: 1, name: 'x', alt: 0 })), '0');
eq("alt '0' (string) KEPT as 0", altClause(sqlFor({ site_id: 1, name: 'x', alt: '0' })), "'0'");
eq('alt absent -> not written', altClause(sqlFor({ site_id: 1, name: 'x' })), '(absent)');

console.log(n + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);