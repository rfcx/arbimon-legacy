var debug = require('debug')('arbimon2:dbpool');
var mysql = require('mysql');
var config = require('../config');
var showQueriesInConsole = true;
var dbpool = {
    pool: mysql.createPool({
        host : config('db').host,
        user : config('db').user,
        password : config('db').password,
        database : config('db').database
    }),

    enable_query_debugging : function(connection){
        if(connection.$_qd_enabled_$){
            return connection;
        }
        var query_fn = connection.query;
        var release_fn = connection.release;
        connection.$_qd_enabled_$ = true;
        connection.query = function(sql, values, cb) {
            var sql_txt = sql.sql || sql;
            debug('- query : -|', sql_txt.replace(/\n/g,'\n             '));
            if (values instanceof Function) {
                cb = values;
                values = undefined;
            }
            if(values){
                debug('- values: ', values);
            }
            if(cb){
                query_fn.call(connection, sql, values, function(err, rows, fields) {
                    if(err) {
                        debug('  failed :| ', err+"");
                    } else if (rows) {
                        if(rows.length !== undefined) {
                            debug('  returned :', rows.length , " rows.");
                        }
                        if(rows.affectedRows) {
                            debug('  affected :', rows.affectedRows , " rows.");
                        }
                        if(rows.changedRows) {
                            debug('  changed  :', rows.changedRows , " rows.");
                        }
                        if(rows.insertId) {
                            debug('  insert id :', rows.insertId);
                        }
                    }
                    cb(err, rows, fields);
                });
            } else {
                return query_fn.call(connection, sql, values);
            }
        };
        connection.release = function(){
            debug('Connection released.');
            release_fn.apply(this, Array.prototype.slice.call(arguments));
        };
        return connection;
    },

    getConnection : function(callback){
        debug('getConnection : fetching db connection.');
        dbpool.pool.getConnection(function(err, connection){
            if (err) return callback(err);
            
            dbpool.enable_query_debugging(connection);
            callback(null, connection);
        });
    },

    queryHandler: function (query, options, callback) {
        if(callback === undefined && options instanceof Function){
            callback = options;
            options = undefined;
        }
        debug('queryHandler : fetching db connection.');
        dbpool.pool.getConnection(function(err, connection) {
            if(err) return callback(err);
            
            var padding = '\n        ';
            
            // for debugging
            var sql = query.sql || query;
            debug('  query : -|', padding+sql.replace(/\n/g, padding));
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
                connection.query(query, function(err, rows, fields) {
                    connection.release();
                    // for debugging
                    if(err) {
                        debug('  failed :| ', err+"");
                    }
                    else if (rows) {
                        if(rows.length !== undefined) {
                            debug('  returned :', rows.length , " rows.");
                        }
                        if(rows.affectedRows !== undefined) {
                            debug('  affected :', rows.affectedRows , " rows.");
                        }
                        if(rows.changedRows !== undefined) {
                            debug('  changed  :', rows.changedRows , " rows.");
                        }
                        if(rows.insertId !== undefined) {
                            debug('  insert id :', rows.insertId);
                        }
                    }
                    callback(err, rows, fields);
                });
            }
        });
    },
};

module.exports = dbpool;
