// `mysql` is kept as a FORMATTER dependency only (mysql.format / escape /
// escapeId render `?` placeholders and literals for the PG path — see
// queryHandler below and dbpool-pg.js getWriteConnection). The MariaDB
// CONNECTION arm (mysql.createPool / getPool / getMysqlConnection / the
// DB_PG_FALLBACK read-fallback) was retired at P7 step 5 (rfcx-local
// OPEN-ITEMS §320, 2026-09-20): PostgreSQL is the only engine. `sqlstring`
// is the same formatter extracted from this module (API-identical) and is
// the swap target if `mysql` is ever dropped from package.json — that swap
// needs its own datetime-rendering proof (timezone 'Z', dt-fold class).
var mysql = require('mysql');
var config = require('../config');
var sqlutil = require('./sqlutil');
var pgshadow = require('./dbpool-pg'); // the PostgreSQL adapter (route path + write conn adapter)
var q = require('q');

// Export-worker engine switch (OPEN-ITEMS #64): when the
// arbimon-recording-export worker sets EXPORTS_DB_ENGINE=pg, app/model/* reads
// in this process execute against PG via jobs/db/pg.js (the POSTGRES_* READ
// pool, arbimon_ro). The web app does not set this env var.
//
// ⚠️ EXPORTS_DB_ENGINE IS READ IN TWO PLACES WITH DIFFERENT SCOPES -- know both
// before reasoning about which engine (or which CREDENTIAL) served a query:
//   1. jobs/db/backend.js  -- selects the engine for the jobs/services/* facade.
//   2. HERE               -- silently reroutes app/model/* reads in THIS process.
// (2) is the surprising one: a module that looks like "the web app's model"
// (app/model/recordings.exportRecordingData, which builds the recordings CSV)
// runs on the EXPORT WORKER'S pool, not on the web pool, whenever this flag is
// set. Concretely, dbpool.query() below routes to jobs/db/pg.js readQuery(),
// i.e. the POSTGRES_* READ pool (arbimon_ro since 2026-09-16), NOT to
// PG_SHADOW_USER.
//
// 🔑 HOW TO PROVE IT, because guessing here is easy and wrong (measured
// 2026-09-16, S1): probing `dbpool.getConnection()` in the export pod answers
// the PG_SHADOW_* identity (and THROWS there, because the export pair sets no
// PG_SHADOW_USER -- that surface is unreachable from the export path by
// design). Probe `dbpool.query("SELECT current_user FROM sites LIMIT 1")`
// instead; it answers `arbimon_ro` on PG. Same module, two shapes, two
// different pools AND two different identities.
//
// ⚠️ ORDERING IS LOAD-BEARING (P7 step 5, 2026-09-20): the EXPORTS branch in
// queryHandler MUST be consulted BEFORE the pgshadow route path. The export
// image runs WITHOUT PG_SHADOW_USER, and pgshadow.getPool() refuses to build a
// pool without it (the 2026-09-16 read-only-role guard) -- so a routed read
// that reached pgshadow first would throw in every export/reconciler process.
var EXPORTS_PG_ENGINE = (process.env.EXPORTS_DB_ENGINE || '').toLowerCase() === 'pg';
var pgjobs = null;
function getExportPgJobs () {
    if (!pgjobs) { pgjobs = require('../../jobs/db/pg'); }
    return pgjobs;
}

var dbpool = {
    format: mysql.format.bind(mysql),
    escape: mysql.escape.bind(mysql),
    escapeId: mysql.escapeId.bind(mysql),

    getConnection: function(callback){
        // Conn-scoped surface -- writes, transactions, direct-conn reads --
        // is a checked-out PG client wrapped to the mysql driver's surface
        // (query/promisedQuery/beginTransaction/commit/rollback/release,
        // translated, with the RETURNING shim for insertId). See
        // dbpool-pg.js "PHASE 7 -- WRITE ROUTING".
        return pgshadow.getWriteConnection(callback);
    },

    performTransaction: function(transactionFn){
        return dbpool.getConnection().then(function(connection){
            var tx = new sqlutil.transaction(connection);
            return tx.perform(transactionFn).finally(function(){
                connection.release();
            });
        });
    },

    queryWithConnHandler: async function queryWithConnHandler(connection, query, options, mustCloseConn, callback) {
        if(callback === undefined && options instanceof Function){
            callback = options;
            options = undefined;
        }

        if(options && options.stream){
            var stream_args = options.stream === true ? {highWaterMark:5} : options.stream;
            var resultstream = connection.query(query).stream(stream_args);
            resultstream.on('error', function(err) {
                console.error('[queryHandler dbpool]', err)
                callback(err);
            });
            resultstream.on('fields',function(fields,i) {
                callback(null, resultstream, fields);
            });
            resultstream.on('end', function(){
                if (mustCloseConn) {
                    connection.release();
                }
            });
        } else {
            let c = connection.query(query, options, function(err, rows, fields) {
                if (c && !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
                    console.log('=== SQL QUERY\n', c.sql.replace(/\n/g, ' '), '\n===')
                }

                if (mustCloseConn) {
                    connection.release();
                }
                callback(err, rows, fields);
            });
        }
    },

    queryHandler: function (query, options, callback) {
        // Normalize the two-arg call form (queryHandler(sql, cb)) ONCE, up
        // front, for EVERY branch. Previously only the pg-flip and exports-pg
        // branches normalized; the default MariaDB branch relied on
        // queryWithConnHandler doing it downstream — which is fine on the
        // happy path but the getConnection ERROR path called callback(err)
        // with callback still undefined (it was sitting in `options`),
        // throwing "TypeError: callback is not a function" as an uncaught
        // exception and killing the pod. Latent until a DB connection error
        // occurs (first seen 2026-08-11 under a PROTOCOL_SEQUENCE_TIMEOUT
        // during host memory pressure).
        if (callback === undefined && options instanceof Function) {
            callback = options;
            options = undefined;
        }
        var rawSql = (typeof query === 'string') ? query
            : (query && typeof query.sql === 'string') ? query.sql : null;

        // -------- export worker (EXPORTS_DB_ENGINE=pg) -- FIRST, see above --
        if (EXPORTS_PG_ENGINE) {
            try {
                if (rawSql === null) {
                    throw new Error('EXPORTS_DB_ENGINE=pg only supports string/sql-object queries')
                }
                // Match the mysql driver path: apply replacements/placeholders
                // before translation, using the configured timezone.
                var finalSql = mysql.format(rawSql, options, false, config('db').timezone || 'Z');
                var translated = pgshadow.translate(finalSql);
                getExportPgJobs().readQuery(translated).then(function (rows) {
                    callback(null, rows, null);
                }).catch(function (err) {
                    console.error('[queryHandler exports-pg]', err && err.message ? err.message : err)
                    callback(err);
                });
            } catch (err) {
                callback(err);
            }
            return;
        }

        // -------- routed reads (Phase 6.4, the only read path since step 5) --
        // Eligible plain SELECTs run on the PG read route (one READ ONLY tx
        // each, statement_timeout scoped). Writes and anything the allowlist
        // classifier does not positively identify as a plain read fall through
        // to the conn-scoped PG adapter below. A route-path failure surfaces
        // to the caller: there is no other engine to fall back to (the
        // DB_PG_FALLBACK MariaDB retry was disarmed at the 09-12 flip, OPQ-5,
        // and retired with the MariaDB arm at step 5).
        if (rawSql !== null && pgshadow.pgRouteEligible(rawSql)) {
            var pgFinal = null;
            try {
                pgFinal = mysql.format(rawSql, options, false, config('db').timezone || 'Z');
            } catch (e) { pgFinal = null; }
            if (pgFinal !== null) {
                return pgshadow.pgReadQuery(pgFinal, function (pgErr, rows) {
                    if (pgErr) { return callback(pgErr); }
                    callback(null, rows, null);
                });
            }
        }

        dbpool.getConnection(function(err, connection) {
            if (err) {
                console.log('[err getConnection] - query, options, callback', query, options, callback)
                return callback(err);
            }

            dbpool.queryWithConnHandler(connection, query, options, true, callback)
        });
    },
};

dbpool.query = function(sql, options){
    return q.ninvoke(dbpool, 'queryHandler', sql, options).get(0);
};

dbpool.queryWithConn = function (connection, sql, options) {
    return q.ninvoke(dbpool, 'queryWithConnHandler', connection, sql, options, false).get(0);
}

dbpool.streamQuery = function(sql, options){
    return dbpool.getConnection().then(function(dbconn){
        return q.Promise(function(resolve, reject){
            var resultstream = dbconn.query(sql, options).stream({highWaterMark:5});
            resultstream.on('error', reject);
            resultstream.on('fields',function(fields,i) {
                resolve([resultstream, fields]);
            });
            resultstream.on('end', function(){
                dbconn.release();
            });
        });
    });
};

module.exports = dbpool;
