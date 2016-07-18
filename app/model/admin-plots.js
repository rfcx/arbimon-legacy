/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:admin-plots');
var db = require('../utils/dbpool');
var q = require('q');

var AdminPlots = {
    /** Return plot of requested data.
     * @param {Object} query - query.
     * @param {Object} query.stat - statistic to return.
     * @param {String} query.quantize - aggregate entries by the specified time interval. 
     * @param {bool}   query.only_dates - show the dates with logged data instead of the logs.
     * @param {Object} query.from - date from wich to count the statistic.
     * @param {Object} query.to   - date to wich to count the statistic.
     */
    queryStatsData: function(query) {
        var m;
        var selectFn = function(dateField){
            return dateField;
        };
        var clauseFns = [];
        var groupClauseFn;
        
        if(query.only_dates){
            selectFn = function(dateField){
                return 'DATE(' + dateField + ')';
            };
            groupClauseFn = selectFn;
        } else if(query.quantize && (m=/^(\d+)\s?(min|hour|day|week)s?$/.exec(query.quantize))){
            var scale=m[1]|0, qfunc = {
                min   : {prefix:'FLOOR(UNIX_TIMESTAMP(', var:'R.upload_time', suffix:')/60)'},
                hour  : {prefix:'FLOOR(UNIX_TIMESTAMP(', var:'R.upload_time', suffix:')/3600)'},
                day   : {prefix:'FLOOR(UNIX_TIMESTAMP(', var:'R.upload_time', suffix:')/86400)'},
                week  : {prefix:'FLOOR(UNIX_TIMESTAMP(', var:'R.upload_time', suffix:')/604800)'},
            }[m[2]];
            if(scale != 1){
                qfunc.prefix = 'FLOOR(' + qfunc.prefix;
                qfunc.suffix = qfunc.suffix + '/' + scale + ')*' + scale;
            }
            groupClauseFn = function(dateField){
                return qfunc.prefix + dateField + qfunc.suffix;
            };
        }

        if (query.dates) {
            clauseFns.push(function(dateField){
                return {
                    clause: 'DATE(SDL.datetime) IN (?)',
                    data : query.dates
                };
            });
        }
        if (query.from) {
            if(query.to){
                clauseFns.push(function(dateField){
                    return {
                        clause: 'SDL.datetime BETWEEN ? AND ?',
                        data : [query.from, query.to]
                    };
                });
            } else {
                clauseFns.push(function(dateField){
                    return {
                        clause: 'SDL.datetime >= ?',
                        data : [query.from]
                    };
                });
            }
        } else if(query.to){
            clauseFns.push(function(dateField){
                return {
                    clause: 'SDL.datetime <= ?',
                    data : [query.to]
                };
            });
        }
        
        var clauseFn = clauseFns.lengths ? function(dateField, data){
            return clauseFns.map(function(clauseFn){
                var c = clauseFn('timestamp');
                data.push.apply(data, c.data);
                return c.clause;
            });
        } : null;
        
        if(AdminPlots["queryStatsData_" + query.stat]){
            return AdminPlots["queryStatsData_" + query.stat](selectFn, clauseFn, groupClauseFn);
        } else {
            return q.reject(new Error("Unknown statistics " + query.stat));
        }
    },
    
    queryStatsData_activity: function(selectFn, clauseFn, groupClauseFn){
        var data = [];
        var clause = clauseFn && clauseFn('timestamp', data);
        return db.streamQuery(
            "SELECT " + selectFn('timestamp') + " as datetime, COUNT(*) as activity\n" +
            "FROM project_news\n" + 
            (clause ? (
            "WHERE (" + clause.join(")\n" + 
            "  AND (") + ")\n") : "") +
            (groupClauseFn ? (
            "GROUP BY " + groupClauseFn('timestamp')
            ) : "")
        );
    },
    
};


module.exports = AdminPlots;
