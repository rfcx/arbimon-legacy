/**
 * P7 STEP 5 (rfcx-local OPEN-ITEMS §320, 2026-09-20) — PostgreSQL is the ONLY engine.
 *
 * Behavioural, no live DB: the REAL app/utils/dbpool.js is loaded with a stubbed
 * app/utils/dbpool-pg.js + stubbed jobs/db/pg.js, and we assert WHICH path each
 * call shape takes. Two properties this file exists to keep true:
 *
 *   (1) THE ORDERING TRAP: in the export image (EXPORTS_DB_ENGINE=pg, NO
 *       PG_SHADOW_USER) every dbpool.query() must reach jobs/db/pg.js readQuery()
 *       and must NEVER touch the pgshadow route/write path — because
 *       pgshadow.getPool() refuses to build a pool without PG_SHADOW_USER (the
 *       2026-09-16 read-only-role guard) and would throw in every export and
 *       reconciler process. Before step 5 the export pod was protected by
 *       `pgshadow.isPg === false`; after step 5 the EXPORTS branch order is the
 *       only thing protecting it.
 *   (2) NO SECOND ENGINE: a routed-read error surfaces to the caller; there is no
 *       retry on another engine, and getConnection() is always the PG adapter.
 *
 * Plus the jobs/db/backend.js fail-fast: EXPORTS_DB_ENGINE=mysql now THROWS at
 * require time instead of silently selecting a backend that no longer exists.
 *
 * Run standalone: node test/p7-step5-single-engine.test.js
 */
'use strict';
var assert = require('assert');
var path = require('path');
var Module = require('module');

var ROOT = path.join(__dirname, '..');
var DBPOOL = path.join(ROOT, 'app/utils/dbpool.js');
var PGSHADOW = path.join(ROOT, 'app/utils/dbpool-pg.js');
var JOBSPG = path.join(ROOT, 'jobs/db/pg.js');
var BACKEND = path.join(ROOT, 'jobs/db/backend.js');

function fresh(env, stubs) {
    var saved = {};
    Object.keys(env).forEach(function (k) {
        saved[k] = process.env[k];
        if (env[k] === undefined) { delete process.env[k]; } else { process.env[k] = env[k]; }
    });
    // The loader stays patched until restore(): dbpool.js requires jobs/db/pg
    // LAZILY (first query), so a load-time-only patch would miss it.
    var origLoad = Module._load;
    Module._load = function (request, parent) {
        var resolved = null;
        try { resolved = Module._resolveFilename(request, parent); } catch (e) { /* not a file */ }
        if (resolved && stubs[resolved]) { return stubs[resolved]; }
        return origLoad.apply(this, arguments);
    };
    [DBPOOL, PGSHADOW, JOBSPG, BACKEND].forEach(function (p) { delete require.cache[p]; });
    var out = { err: null, mod: null };
    try { out.mod = require(DBPOOL); } catch (e) { out.err = e; }
    out.restore = function () {
        Module._load = origLoad;
        Object.keys(saved).forEach(function (k) {
            if (saved[k] === undefined) { delete process.env[k]; } else { process.env[k] = saved[k]; }
        });
        [DBPOOL, PGSHADOW, JOBSPG, BACKEND].forEach(function (p) { delete require.cache[p]; });
    };
    return out;
}

function mkStubs(log) {
    var pgshadowStub = {
        isPg: true,
        translate: function (sql) { log.push(['translate', sql]); return sql; },
        pgRouteEligible: function (sql) { return /^\s*SELECT\b/i.test(sql); },
        pgReadQuery: function (finalSql, cb) {
            log.push(['pgReadQuery', finalSql]);
            if (/FAIL_ME/.test(finalSql)) {
                return cb({ pgRouteFallback: true, message: 'query failed' });
            }
            cb(null, [{ served_by: 'pgReadQuery' }]);
        },
        getWriteConnection: function (callback) {
            log.push(['getWriteConnection']);
            var conn = {
                query: function (sql, values, cb) {
                    if (values instanceof Function) { cb = values; values = undefined; }
                    log.push(['conn.query', sql]);
                    // async like the real adapter (queryWithConnHandler reads `c` in the cb)
                    setImmediate(function () { cb(null, { affectedRows: 1, served_by: 'writeConn' }, []); });
                    return { sql: sql };
                },
                release: function () { log.push(['release']); }
            };
            if (callback) { callback(null, conn); }
            return require('q')(conn);
        }
    };
    var jobsPgStub = {
        readQuery: function (sql) { log.push(['jobs/db/pg.readQuery', sql]); return Promise.resolve([{ served_by: 'jobs/db/pg' }]); }
    };
    var s = {};
    s[PGSHADOW] = pgshadowStub;
    s[JOBSPG] = jobsPgStub;
    return s;
}

describe('P7 step 5 — PostgreSQL is the only engine', function () {

    it('(1) export image shape: EXPORTS_DB_ENGINE=pg + no PG_SHADOW_USER → reads go to jobs/db/pg, pgshadow untouched', function (done) {
        var log = [];
        var r = fresh({ EXPORTS_DB_ENGINE: 'pg', PG_SHADOW_USER: undefined, DB_ENGINE: undefined }, mkStubs(log));
        assert.ifError(r.err);
        r.mod.query('SELECT site_id FROM sites WHERE project_id = ?', [42]).then(function (rows) {
            assert.deepStrictEqual(rows, [{ served_by: 'jobs/db/pg' }]);
            var kinds = log.map(function (e) { return e[0]; });
            assert.deepStrictEqual(kinds, ['translate', 'jobs/db/pg.readQuery'], 'expected ONLY the exports path, got ' + JSON.stringify(kinds));
            // placeholders rendered by mysql.format BEFORE translate:
            assert.ok(/project_id = 42$/.test(log[0][1]), 'placeholder rendered: ' + log[0][1]);
            r.restore(); done();
        }).catch(function (e) { r.restore(); done(e); });
    });

    it('(1b) export image shape: a non-SELECT (write) also goes to jobs/db/pg, never the write adapter', function (done) {
        var log = [];
        var r = fresh({ EXPORTS_DB_ENGINE: 'pg', PG_SHADOW_USER: undefined, DB_ENGINE: undefined }, mkStubs(log));
        assert.ifError(r.err);
        r.mod.query('UPDATE recordings_export_parameters SET processed_at = NOW() WHERE id = ?', [7]).then(function () {
            var kinds = log.map(function (e) { return e[0]; });
            assert.ok(kinds.indexOf('getWriteConnection') === -1, 'write adapter must not be touched in the export image: ' + JSON.stringify(kinds));
            assert.ok(kinds.indexOf('pgReadQuery') === -1, 'route path must not be touched in the export image');
            r.restore(); done();
        }).catch(function (e) { r.restore(); done(e); });
    });

    it('(2) web shape: eligible SELECT → pgReadQuery; write → the PG conn adapter', function (done) {
        var log = [];
        var r = fresh({ EXPORTS_DB_ENGINE: undefined, DB_ENGINE: 'pg', PG_SHADOW_USER: 'x' }, mkStubs(log));
        assert.ifError(r.err);
        r.mod.query('SELECT project_id FROM projects WHERE url = ?', ['demo']).then(function (rows) {
            assert.deepStrictEqual(rows, [{ served_by: 'pgReadQuery' }]);
            assert.deepStrictEqual(log.map(function (e) { return e[0]; }), ['pgReadQuery']);
            assert.ok(/url = 'demo'$/.test(log[0][1]), 'placeholder rendered: ' + log[0][1]);
            log.length = 0;
            return r.mod.query('UPDATE projects SET name = ? WHERE project_id = ?', ['n', 1]);
        }).then(function (res) {
            assert.strictEqual(res.served_by, 'writeConn');
            assert.deepStrictEqual(log.map(function (e) { return e[0]; }), ['getWriteConnection', 'conn.query', 'release']);
            r.restore(); done();
        }).catch(function (e) { r.restore(); done(e); });
    });

    it('(2b) a routed-read failure surfaces to the caller — no retry on any other path', function (done) {
        var log = [];
        var r = fresh({ EXPORTS_DB_ENGINE: undefined, DB_ENGINE: 'pg', PG_SHADOW_USER: 'x' }, mkStubs(log));
        assert.ifError(r.err);
        r.mod.query('SELECT FAIL_ME FROM sites').then(function () {
            r.restore(); done(new Error('expected rejection'));
        }, function (err) {
            assert.strictEqual(err.message, 'query failed');
            assert.deepStrictEqual(log.map(function (e) { return e[0]; }), ['pgReadQuery'], 'exactly one attempt, no fallback: ' + JSON.stringify(log));
            r.restore(); done();
        });
    });

    it('(2c) getConnection() is the PG adapter unconditionally (callback AND promise forms)', function (done) {
        var log = [];
        var r = fresh({ EXPORTS_DB_ENGINE: undefined, DB_ENGINE: 'pg', PG_SHADOW_USER: 'x' }, mkStubs(log));
        assert.ifError(r.err);
        r.mod.getConnection(function (err, conn) {
            assert.ifError(err);
            assert.strictEqual(typeof conn.release, 'function');
            r.mod.getConnection().then(function (conn2) {
                assert.strictEqual(typeof conn2.release, 'function');
                assert.deepStrictEqual(log.map(function (e) { return e[0]; }), ['getWriteConnection', 'getWriteConnection']);
                assert.strictEqual(r.mod.getMysqlConnection, undefined, 'the MariaDB arm must be gone from the surface');
                assert.strictEqual(r.mod.getPool, undefined, 'the MariaDB pool getter must be gone from the surface');
                r.restore(); done();
            }).catch(function (e) { r.restore(); done(e); });
        });
    });

    it('(3) jobs/db/backend.js: EXPORTS_DB_ENGINE=mysql throws at require time (the engine is gone)', function () {
        var saved = process.env.EXPORTS_DB_ENGINE;
        process.env.EXPORTS_DB_ENGINE = 'mysql';
        delete require.cache[BACKEND];
        assert.throws(function () { require(BACKEND); }, /not an engine|retired/i);
        // control: pg (and unset) load the PG backend without touching a DB
        var pgStub = { engine: undefined, getConnection: function () {} };
        var origLoad = Module._load;
        Module._load = function (request, parent) {
            var resolved = null;
            try { resolved = Module._resolveFilename(request, parent); } catch (e) { /* */ }
            if (resolved === JOBSPG) { return pgStub; }
            return origLoad.apply(this, arguments);
        };
        try {
            process.env.EXPORTS_DB_ENGINE = 'pg';
            delete require.cache[BACKEND];
            assert.strictEqual(require(BACKEND).engine, 'pg');
            delete process.env.EXPORTS_DB_ENGINE;
            delete require.cache[BACKEND];
            assert.strictEqual(require(BACKEND).engine, 'pg', 'unset must resolve to pg (the old mysql default is gone)');
        } finally {
            Module._load = origLoad;
            delete require.cache[BACKEND];
            if (saved === undefined) { delete process.env.EXPORTS_DB_ENGINE; } else { process.env.EXPORTS_DB_ENGINE = saved; }
        }
    });
});