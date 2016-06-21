var mysql = require('mysql');

var mock_mysql_connection = function(pool){
    this.pool = pool;
    if(pool){
        pool.connections++;
    }
    this.cache = (pool && pool.cache) || {};
};

mock_mysql_connection.prototype = {
    query: function(sql, values, callback){
        if(values instanceof Function && callback === undefined){
            callback = values;
            values = undefined;
        }
        if(this.query_callback || (this.pool && this.pool.query_callback)){
            var cbs = [callback];
            if(this.query_callback){cbs.push(this.query_callback);}
            if(this.pool && this.pool.query_callback){cbs.push(this.pool.query_callback);}
            callback = function(){
                var args=Array.prototype.slice.call(arguments);
                for(var i in cbs){
                    cbs[i].apply(this, args);
                }
            };
        }
        var entry = this.cache[sql];
        if(entry){
            if(entry.error){
                callback(entry.error);
            } else {
                callback(null, entry.no_value ? null : (entry.value || [[]]), entry.fields || [[]]);
            }
        } else {
            callback(new Error("Query not in cache : "+sql));
        }
    },
    beginTransaction: function(callback){
        callback();
    },
    rollback: function(callback){
        callback();
    },
    commit: function(callback){
        callback();
    },
    release:function(){
        if(this.pool){
            this.pool = null;
        }
    }
};

var mock_mysql_pool = function(){
    this.cache={};
};
mock_mysql_pool.prototype = {
    getConnection: function(callback){
        if(this.flag_fails_on_connection){
            callback(new Error("Failed getting a connection"));
        } else {
            callback(null, new mock_mysql_connection(this));
        }        
    }
};

module.exports = {
    pool: null,
    createPool: function(){
        if(!this.pool){
            this.pool = new mock_mysql_pool();
        }
        return this.pool;
    },
    types : {
        pool: mock_mysql_pool,
        connection : mock_mysql_connection
    },
    format: mysql.format.bind(mysql),
    escape: mysql.escape.bind(mysql),
    escapeId: mysql.escapeId.bind(mysql)
};
