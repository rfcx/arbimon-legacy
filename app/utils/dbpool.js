var mysql = require('mysql');
var config = require('../config');
var sqlutil = require('./sqlutil');
var q = require('q');
var showQueriesInConsole = true;

const QUERY_TIMEOUT = 25000;

var dbpool = {
    pool: undefined,
    getPool: function(){
        if (!dbpool.pool) {
            // console.log("MySQL pool is being created")
            dbpool.pool = mysql.createPool({
                connectionLimit : 30,
                connectTimeout  : 30 * 1000,
                acquireTimeout  : 30 * 1000,
                timeout         : 30 * 1000,
                host : config('db').host,
                port : config('db').port || 3306,
                user : config('db').user,
                password : config('db').password,
                database : config('db').database,
                timezone: config('db').timezone
            })
            // dbpool.pool.on('connection', function (connection) {
            //     console.log('MySQL pool connection %d is set', connection.threadId);
            // });
            // dbpool.pool.on('release', function(connection) {
            //     console.log('MySQL pool connection %d is released', connection.threadId);
            // })
        }
        return dbpool.pool
    },

    format: mysql.format.bind(mysql),
    escape: mysql.escape.bind(mysql),
    escapeId: mysql.escapeId.bind(mysql),

    enable_query_debugging : function(connection) {
        connection.$_lastQuery_$ = '';
        connection.$_timeout_$ = setTimeout(() => {
            console.log(`ALERT: connection taken for query ${connection.$_lastQuery_$} is not freed after ${QUERY_TIMEOUT}`);
            connection.$_lastQuery_$ = '';
        }, QUERY_TIMEOUT);

        if(connection.$_qd_enabled_$){
            return connection;
        }
        var query_fn = connection.query;
        var release_fn = connection.release;

        connection.$_qd_enabled_$ = true;
        connection.query = function(sql, values, cb) {
            connection.$_lastQuery_$ = sql
            if (values instanceof Function) {
                cb = values;
                values = undefined;
            }
            if(cb){
                query_fn.call(connection, sql, values, function(err, rows, fields) {
                    cb(err, rows, fields);
                });
            } else {
                return query_fn.call(connection, sql, values);
            }
        };
        connection.promisedQuery = function(sql, values){
            return q.ninvoke(this, 'query', sql, values).get(0);
        };
        connection.release = function(){
            release_fn.apply(this, Array.prototype.slice.call(arguments));
            if (connection.$_timeout_$) {
                clearTimeout(connection.$_timeout_$);
                connection.$_timeout_$ = null;
                connection.$_lastQuery_$ = '';
            }
        };
        return connection;
    },

    getConnection: function(callback){
        return q.ninvoke(dbpool.getPool(), 'getConnection').then(function (connection){
            // Log it here since we cannot using `connection` listener
            // console.log('MySQL pool connection %d is set', connection.threadId);
            dbpool.enable_query_debugging(connection);
            return connection;
        }).catch(function (err){
            console.error('connection error:', err);
            throw err;
        }).nodeify(callback);
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
