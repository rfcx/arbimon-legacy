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
        connection.query = function(sql, values, cb) {
            var sql_txt = sql.sql || sql;
            if(showQueriesInConsole) console.log('- query : -|', sql_txt.replace(/\n/g,'\n             '));
            if (values instanceof Function) {
                cb = values;
                values = undefined;
            }
            if(values){
                if(showQueriesInConsole) console.log('- values: ', values);
            }
            query_fn.call(connection, sql, values, function(err, rows, fields) {
                if(err) {
                    if(showQueriesInConsole) console.log('  failed :| ', err+"");
                } else if (rows) {
                    if(rows.length != undefined) {
                        if(showQueriesInConsole) console.log('  returned :', rows.length , " rows.");
                    }
                    if(rows.affectedRows) {
                        if(showQueriesInConsole) console.log('  affected :', rows.affectedRows , " rows.");
                    }
                    if(rows.changedRows) {
                        if(showQueriesInConsole) console.log('  changed  :', rows.changedRows , " rows.");
                    }
                    if(rows.insertId) {
                        if(showQueriesInConsole) console.log('  insert id :', rows.insertId);
                    }
                }
                cb(err, rows, fields);
            });
        };
        return connection;
    },

    getConnection : function(callback){
        dbpool.pool.getConnection(function(err, connection){
            if(err){ callback(err); return; }
            dbpool.enable_query_debugging(connection);
            callback(null, connection);
        });
    },

    queryHandler: function (query, callback) {
        
        if(showQueriesInConsole) console.log('db connection from pool: fetching');
        
        dbpool.pool.getConnection(function(err, connection) {
            if(err) return callback(err);
            
            // for debugging
            var sql = query.sql || query;
            if(showQueriesInConsole) console.log('  query : -|', sql.replace(/\n/g,'\n             '));
            
            connection.query(query, function(err, rows, fields) {
                connection.release();
                // for debugging
                if(err) {
                    if(showQueriesInConsole) console.log('  failed :| ', err+"");
                }
                else if (rows) {
                    if(rows.length != undefined) {
                        if(showQueriesInConsole) console.log('  returned :', rows.length , " rows.");
                    }
                    if(rows.affectedRows != undefined) {
                        if(showQueriesInConsole) console.log('  affected :', rows.affectedRows , " rows.");
                    }
                    if(rows.changedRows != undefined) {
                        if(showQueriesInConsole) console.log('  changed  :', rows.changedRows , " rows.");
                    }
                    if(rows.insertId != undefined) {
                        if(showQueriesInConsole) console.log('  insert id :', rows.insertId);
                    }
                }
                callback(err, rows, fields);
            });
        });
    },
};


module.exports = dbpool;
