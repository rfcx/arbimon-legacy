var mysql = require('mysql');
var config = require('../config');
var sqlutil = require('./sqlutil');
var q = require('q');
var showQueriesInConsole = true;
var dbpool = {
    pool: undefined,
    getPool: function(){
        if (!dbpool.pool) {
            console.log("MySQL pool is being created")
            dbpool.pool = mysql.createPool({
                host : config('db').host,
                port : config('db').port || 3306,
                user : config('db').user,
                password : config('db').password,
                database : config('db').database,
                timezone: config('db').timezone
            })
            dbpool.pool.on('connection', function (connection) {
                console.log('MySQL pool connection %d is set', connection.threadId);
            });
        }
        return dbpool.pool
    },

    format: mysql.format.bind(mysql),
    escape: mysql.escape.bind(mysql),
    escapeId: mysql.escapeId.bind(mysql),

    enable_query_debugging : function(connection){
        if(connection.$_qd_enabled_$){
            return connection;
        }
        var query_fn = connection.query;
        var release_fn = connection.release;
        connection.$_qd_enabled_$ = true;
        connection.query = function(sql, values, cb) {
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
        };
        return connection;
    },

    getConnection : function(callback){
        return q.ninvoke(dbpool.getPool(), 'getConnection').then(function (connection){
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

    queryHandler: function (query, options, callback) {
        if(callback === undefined && options instanceof Function){
            callback = options;
            options = undefined;
        }
        dbpool.getPool().getConnection(function(err, connection) {
            if(err) return callback(err);

            var padding = '\n        ';

            // for debugging
            var sql = query.sql || query;
            if(options && options.stream){
                var stream_args = options.stream === true ? {highWaterMark:5} : options.stream;
                var resultstream = connection.query(query).stream(stream_args);
                resultstream.on('error', function(err) {
                    callback(err);
                });
                resultstream.on('fields',function(fields,i) {
                  callback(null, resultstream, fields);
                });
                resultstream.on('end', function(){
                    connection.release();
                });
            } else {
                var startTime = new Date().getTime();
                connection.query(query, options, function(err, rows, fields) {
                    connection.release();
                    callback(err, rows, fields);
                });
            }
        });
    },
};

dbpool.query = function(sql, options){
    return q.ninvoke(dbpool, 'queryHandler', sql, options).get(0);
};

dbpool.streamQuery = function(sql, options){
    return q.ninvoke(dbpool, "getConnection").then(function(dbconn){
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
