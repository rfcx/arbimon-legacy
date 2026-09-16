// Guard: DB_ENGINE=pg must NOT silently fall back to the read-only arbimon_ro
// role. Regression test for the 2026-09-12 flip-day window (149 x 42501 in one
// 6 h bucket: cached_metrics 124, audio_event_detections_clustering 22, jobs 3).
//
// NEGATIVE-CONTROL CONTRACT (#1866): tests 1 and 2 FAIL on the pre-fix module
// (it returns a config with user='arbimon_ro' instead of throwing). Tests 3-5
// PASS before AND after -- they pin the behaviour the guard must NOT break,
// which is the half that makes this safe to ship.
//
// Run standalone:  node test/pg-shadow-user-guard.test.js
'use strict';

var assert = require('assert');
var path = require('path');

var MODULE = path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js');

function freshLoad(env) {
    // dbpool-pg reads process.env at module scope (ENGINE), so each case needs
    // a clean require cache AND a restored environment.
    var saved = {};
    ['DB_ENGINE', 'PG_SHADOW_USER'].forEach(function (k) { saved[k] = process.env[k]; });
    Object.keys(env).forEach(function (k) {
        if (env[k] === undefined) { delete process.env[k]; } else { process.env[k] = env[k]; }
    });
    delete require.cache[require.resolve(MODULE)];
    try {
        return { mod: require(MODULE), err: null };
    } catch (e) {
        return { mod: null, err: e };
    } finally {
        Object.keys(saved).forEach(function (k) {
            if (saved[k] === undefined) { delete process.env[k]; } else { process.env[k] = saved[k]; }
        });
        delete require.cache[require.resolve(MODULE)];
    }
}

var pass = 0, fail = 0;
function check(name, fn) {
    try { fn(); console.log('ok   - ' + name); pass++; }
    catch (e) { console.log('FAIL - ' + name + '\n       ' + e.message); fail++; }
}

// 1. THE DEFECT ITSELF: pg + no PG_SHADOW_USER must throw, not silently use arbimon_ro.
check('pg without PG_SHADOW_USER throws (does not fall back to arbimon_ro)', function () {
    var r = freshLoad({ DB_ENGINE: 'pg', PG_SHADOW_USER: undefined });
    assert.strictEqual(r.err, null, 'module must LOAD (the guard is lazy, not module-level)');
    assert.throws(function () { r.mod.getWriteConnection; r.mod._forcePgConf ? r.mod._forcePgConf() : pgConfViaPool(r.mod); },
        /PG_SHADOW_USER/,
        'expected a throw naming PG_SHADOW_USER');
});

// Reaching pgConf() without a live DB: creating the pool calls it.
function pgConfViaPool(mod) {
    // pgPool() is internal; the public surface that reaches it is a routed read.
    // Calling it with no DB present still runs pgConf() FIRST, which is where the
    // guard lives -- so the guard's error surfaces before any connection attempt.
    return mod.pgReadQuery && mod.pgReadQuery('SELECT 1', []);
}

// 2. The error must be actionable, not generic.
check('the error explains the 42501 consequence', function () {
    var r = freshLoad({ DB_ENGINE: 'pg', PG_SHADOW_USER: undefined });
    var msg = '';
    try { pgConfViaPool(r.mod); } catch (e) { msg = e.message; }
    assert.ok(/42501/.test(msg), 'error should cite 42501');
    assert.ok(/arbimon_ro/.test(msg), 'error should name the role it refuses to use');
});

// 3. CONTROL (passes before AND after): shadow keeps the read-only default.
check('CONTROL shadow mode still defaults to arbimon_ro without throwing', function () {
    var r = freshLoad({ DB_ENGINE: 'shadow', PG_SHADOW_USER: undefined });
    assert.strictEqual(r.err, null, 'shadow must load');
    assert.strictEqual(r.mod.isShadow, true);
    assert.strictEqual(r.mod.isPg, false);
});

// 4. CONTROL: pg WITH the env set is unaffected.
check('CONTROL pg with PG_SHADOW_USER set loads and reports isPg', function () {
    var r = freshLoad({ DB_ENGINE: 'pg', PG_SHADOW_USER: 'arbimon_worker' });
    assert.strictEqual(r.err, null);
    assert.strictEqual(r.mod.isPg, true);
});

// 5. CONTROL -- THE ONE THAT PROTECTS THE INERT CONSUMERS.
//    jobs/db/pg.js requires this module for translate() ONLY and documents
//    itself "INERT otherwise"; arbimon-export-consumer runs with no DB_ENGINE
//    and no PG_SHADOW_USER. Module load and translate() must both survive.
check('CONTROL inert consumer (no DB_ENGINE, no PG_SHADOW_USER) loads and translates', function () {
    var r = freshLoad({ DB_ENGINE: undefined, PG_SHADOW_USER: undefined });
    assert.strictEqual(r.err, null, 'module must load for translate()-only consumers');
    assert.strictEqual(typeof r.mod.translate, 'function');
    var out = r.mod.translate('SELECT IFNULL(a,0) FROM projects');
    assert.ok(/COALESCE/i.test(out), 'translate() must still work: ' + out);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);