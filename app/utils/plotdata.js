var q = require('q');
var dbpool = require('./dbpool');

module.exports = {
    buildPlotDataQuery: function(site, options, callback){
        var site_id = site.site_id | 0;
        var datetime_field = "SDL.datetime";        
        var params=[site_id];
        var fields = [[datetime_field, 'datetime', 'SDL']];
        var where_clause = ["site_id = ?"];
        var table_set={
            SDL  : {sql: "site_data_log SDL"},
            SDLPT: {sql: "JOIN site_data_log_plug_types SDLPT ON SDL.plug_type = SDLPT.plug_type_id", requires:['SDL']},
            SDLHT: {sql: "JOIN site_data_log_health_types SDLHT ON SDL.health = SDLHT.health_type_id", requires:['SDL']},
            SDLTT: {sql: "LEFT JOIN site_data_log_tech_types SDLTT ON SDL.bat_tech = SDLTT.tech_type_id", requires:['SDL']}
        };
        var stats  = [
            ['SDL.power'   , 'power'     , 'SDL'   ], 
            ['SDL.temp'    , 'temp'      , 'SDL'   ], 
            ['SDL.voltage' , 'voltage'   , 'SDL'   ], 
            ['SDL.battery' , 'battery'   , 'SDL'   ], 
            ['SDL.status'  , 'status'    , 'SDL'   ], 
            ['SDLPT.type'  , 'plug_type' , 'SDLPT' ], 
            ['SDLHT.type'  , 'health'    , 'SDLHT' ], 
            ['SDLTT.type'  , 'bat_tech'  , 'SDLTT' ]];

        if (options.only_dates) {
            return this.returnConnectAndReturnSqlStream({sql:
                "SELECT DATE(" + datetime_field + ") as dates, COUNT(*) as count\n" + 
                "FROM site_data_log SDL\n" +
                "WHERE site_id = ?\n" +
                "GROUP BY DATE(" + datetime_field + ")",
                typeCast: function (field, next) {
                    if (field.type !== 'DATE') return next(); // 1 = true, 0 = false
                    return field.string();
                }
            }, params, {highWaterMark:5}, callback);
        } else {
            
            fields = fields.slice(0);
            where_clause = where_clause.slice(0);
            
            if(options.stat){
                var options_stats={};
                options.stat.forEach(function(s){options_stats[s]=true;});
                stats.forEach(function(s){
                    if(options_stats[s[1]]){
                        fields.push(s);
                    }
                });
            } else {
                fields.push.apply(fields, stats);
            }
            
            var tables = this.resolveRequiredTables(fields, table_set);

            
            
            var group_clause;
            
            var quantization = computeQuantization(datetime_field, options.quantize);
            if(quantization){
                var dtfield = fields.shift(); // remove datetime field (always the first field)
                fields.forEach(function(f){ f[0] = 'AVG('+f[0]+')';});
                fields.unshift(dtfield); // add datetime
                group_clause = quantization;
            }
            
            if (options.dates) {
                where_clause.push("DATE(" + datetime_field + ") IN (?)");
                params.push(options.dates);
            }
            if (options.from) {
                if(options.to){
                    where_clause.push("" + datetime_field + " BETWEEN ? AND ?");
                    params.push(options.from, options.to);
                } else {
                    where_clause.push("" + datetime_field + " >= ?");
                    params.push(options.from);
                }
            } else if(options.to){
                where_clause.push("" + datetime_field + " <= ?");
                params.push(options.to);
            }
            
            return this.returnConnectAndReturnSqlStream(
                "SELECT " + fields.map(function(field){
                    return field[0] + ' as `'+ field[1] +'`';
                }).join(", ")+ " \n" + 
                "FROM " + tables.join("\n") +
                "WHERE (" + where_clause.join(") AND (") + ")" +
                (group_clause ? "\nGROUP BY " + group_clause : ""), 
                params,  {highWaterMark:5}, callback
            );
        }
    },
    
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