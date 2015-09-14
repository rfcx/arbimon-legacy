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
        var query_fn = connection.query;
        var release_fn = connection.release;
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

    queryHandler: function (query, callback) {
        debug('queryHandler : fetching db connection.');
        dbpool.pool.getConnection(function(err, connection) {
            if(err) return callback(err);
            
            // for debugging
            var sql = query.sql || query;
            debug('  query : -|', sql.replace(/\n/g,'\n             '));
            
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
        });
    },
};

module.exports = dbpool;
