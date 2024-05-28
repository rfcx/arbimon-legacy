var q = require('q');
var dbpool = require('./dbpool');

module.exports = {
    resolveRequiredTables: function(fields, table_set){
        var tables=[];
        var tables_in_set = {};
        var tables_added = false;
        var add_table_to_set = function(tableId){
            if(!tables_in_set[tableId]){
                tables.unshift(tableId);
                tables_in_set[tableId] = true;
                tables_added = true;
            }
        };
        fields.forEach(function(s){
            add_table_to_set(s[2]);
        });
        while(tables_added){
            tables_added = false;
            for(var i=0, e=tables.length; i < e; ++i){
                var tkey = tables[i];
                var table = table_set[tkey];
                if(table.requires){
                    table.requires.forEach(add_table_to_set);
                }
            }
        }
        return tables.map(function(tkey){
            return table_set[tkey];
        });
    },
    
    
    computeQuantization: function(datetime_field, quantize){
        var m;
        if(quantize && (m=/^(\d+)\s?(min|hour|day|week)s?$/.exec(quantize))){
            var scale=m[1]|0, qfunc = {
                min   : 'FLOOR(UNIX_TIMESTAMP(' + datetime_field + ')/60)',
                hour  : 'FLOOR(UNIX_TIMESTAMP(' + datetime_field + ')/3600)',
                day   : 'FLOOR(UNIX_TIMESTAMP(' + datetime_field + ')/86400)',
                week  : 'FLOOR(UNIX_TIMESTAMP(' + datetime_field + ')/604800)',
            }[m[2]];
            if(scale != 1){
                qfunc = 'FLOOR('+qfunc+'/'+scale+')*'+scale;
            }
            return qfunc;
        }    
    },
    returnConnectAndReturnSqlStream: function(sql, params, options, callback){
        var deffered = q.defer();
        dbpool.getConnection(function(err, dbconn){
            if(err){
                deffered.reject(err);
                if(callback){
                    callback(err);
                }
            } else {
                var resultstream = dbconn.query(sql, params).stream(options);
                resultstream.on('error', function(err) {
                    deffered.reject(err);
                    if(callback){
                        callback(err);
                    }
                });
                resultstream.on('fields',function(fields,i) {
                    deffered.resolve(resultstream, fields);
                    if(callback){
                        callback(null, resultstream, fields);
                    }                    
                });
                resultstream.on('end', function(){
                    dbconn.release();
                });
            }
        });        
        
        return deffered.promise;
    }
    
};
