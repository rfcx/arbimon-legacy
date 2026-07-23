'use strict';
/**
 * Minimal PG writer for the exports cutover (OPEN-ITEMS #64 / ADR-023 Option 2).
 *
 * Lives in app/utils (NOT jobs/) because the `arbimon` WEB image ships app/ but
 * not jobs/ — writeExportParams runs in the web app, so its PG INSERT path must
 * resolve there (a require into jobs/db/* would MODULE_NOT_FOUND at cutover).
 * The export WORKER (jobs image) has its own pools in jobs/db/pg.js.
 *
 * Lazy + inert: nothing initializes unless writerQuery() is called, which only
 * happens when EXPORTS_WRITE_ENGINE=pg (the cutover flag) is set on the app.
 *
 * Env (set at cutover on the arbimon web Deployment):
 *   EXPORTS_PG_HOSTNAME  (default: arbimon-pgbouncer.data.svc.cluster.local)
 *   EXPORTS_PG_PORT      (default: 6432)
 *   EXPORTS_PG_NAME      (default: arbimon)
 *   EXPORTS_PG_USERNAME / EXPORTS_PG_PASSWORD  (arbimon_app — write-capable)
 *
 * pgbouncer NOTE: pool_mode=transaction — do NOT add statement_timeout (or any
 * non-ignored startup parameter) to the connection options; single-statement
 * parameterized INSERTs only.
 */
var _pool = null;

function getPool() {
    if (_pool) { return _pool; }
    var Pool = require('pg').Pool; // lazy; web app package.json carries pg
    _pool = new Pool({
        host: process.env.EXPORTS_PG_HOSTNAME || 'arbimon-pgbouncer.data.svc.cluster.local',
        port: parseInt(process.env.EXPORTS_PG_PORT || '6432', 10),
        database: process.env.EXPORTS_PG_NAME || 'arbimon',
        user: process.env.EXPORTS_PG_USERNAME,
        password: process.env.EXPORTS_PG_PASSWORD,
        max: parseInt(process.env.EXPORTS_PG_POOL_MAX || '2', 10)
    });
    _pool.on('error', function (err) {
        console.error('[exports-pg-writer] idle client error', err && err.message);
    });
    return _pool;
}

function writerQuery(sql, params) {
    return getPool().query(sql, params);
}

module.exports = { writerQuery: writerQuery };