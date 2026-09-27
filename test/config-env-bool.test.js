/* jshint node:true */
'use strict';

// Env overrides of BOOLEAN config keys must become booleans, not truthy strings.
// Run: node test/config-env-bool.test.js
//
// Live defect 2026-09-27: RFCX_COREAPIENABLED=false left rfcxConfig.coreAPIEnabled
// as the STRING "false" (truthy), so every `if (rfcxConfig.coreAPIEnabled)` core
// write still fired. These tests exercise the REAL app/config.js, both through
// the exported coercer and end-to-end through the loader with a real env var on
// the real config/rfcx.json (whose coreAPIEnabled default is the boolean true).

const assert = require('assert');
const path = require('path');

let failed = 0;
function test(name, fn) {
    try { fn(); console.log('ok   ' + name); }
    catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); }
}

// Fresh require so the loader's module-level cache cannot leak between cases.
function freshConfig() {
    const p = path.resolve(__dirname, '..', 'app', 'config.js');
    delete require.cache[require.resolve(p)];
    return require(p);
}

// The loader is the module itself (module.exports = function(config_file)); the
// E2E cases below use ONLY that, so they are meaningful against old code too.
const coerce = freshConfig()._coerceEnvOverride || (() => { throw new Error('_coerceEnvOverride not exported'); });
const origWarn = console.warn;
let warnings = [];
console.warn = (m) => { warnings.push(String(m)); };

test('bool default + "false" -> false', () => assert.strictEqual(coerce(true, 'false', 'X_A'), false));
test('bool default + "FALSE " (case/space) -> false', () => assert.strictEqual(coerce(true, 'FALSE ', 'X_B'), false));
test('bool default + "0"/"no"/"off" -> false', () => {
    ['0', 'no', 'off'].forEach(v => assert.strictEqual(coerce(true, v, 'X_C' + v), false));
});
test('bool default + "true"/"1"/"yes"/"on" -> true', () => {
    ['true', '1', 'yes', 'on'].forEach(v => assert.strictEqual(coerce(false, v, 'X_D' + v), true));
});
test('bool default + unrecognised "maybe" -> raw string kept, ONE warning', () => {
    warnings = [];
    assert.strictEqual(coerce(true, 'maybe', 'X_E'), 'maybe');
    assert.strictEqual(coerce(true, 'maybe', 'X_E'), 'maybe');
    assert.strictEqual(warnings.length, 1);
});
test('string default is NEVER coerced ("false" stays a string)', () => assert.strictEqual(coerce('', 'false', 'X_F'), 'false'));
test('number default is NEVER coerced ("0" stays a string, as before)', () => assert.strictEqual(coerce(0, '0', 'X_G'), '0'));

// End-to-end through the real loader + real config/rfcx.json (coreAPIEnabled: true)
test('E2E: RFCX_COREAPIENABLED=false -> coreAPIEnabled === false (was the truthy string)', () => {
    process.env.RFCX_COREAPIENABLED = 'false';
    const cfg = freshConfig()('rfcx');
    assert.strictEqual(cfg.coreAPIEnabled, false);
    delete process.env.RFCX_COREAPIENABLED;
});
test('E2E: RFCX_COREAPIENABLED=true -> coreAPIEnabled === true (prod value; behaviour unchanged)', () => {
    process.env.RFCX_COREAPIENABLED = 'true';
    const cfg = freshConfig()('rfcx');
    assert.strictEqual(cfg.coreAPIEnabled, true);
    delete process.env.RFCX_COREAPIENABLED;
});
test('E2E: a STRING key (RFCX_APIBASEURL) is passed through untouched', () => {
    process.env.RFCX_APIBASEURL = 'http://example.invalid';
    const cfg = freshConfig()('rfcx');
    assert.strictEqual(cfg.apiBaseUrl, 'http://example.invalid');
    delete process.env.RFCX_APIBASEURL;
});

console.warn = origWarn;
if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('all passed');
process.exit(0);