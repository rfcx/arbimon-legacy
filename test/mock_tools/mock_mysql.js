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
    }
};
