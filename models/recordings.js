var util = require('util');
var mysql = require('mysql');

module.exports = function(queryHandler) {
    return {
        parseUrl: function(recording_url){
            //                site    year   month   day     hour    minute
            //                1      2 3      4 5      6 7      8 9     10 11    10987654321
            //                1     01 2     12 3     23 4     34 5     45 6     54 3 2 1
            var rec_match = recording_url ? /^([^-]*)(-([^-]*)(-([^-]*)(-([^-]*)(-([^-]*)(-([^-]*))?)?)?)?)?/.exec(recording_url) : null;
            if(!rec_match){
                rec_match = {};
            }
            return {
                site   : rec_match[1],
                year   : rec_match[3],
                month  : rec_match[5],
                day    : rec_match[7],
                hour   : rec_match[9],
                minute : rec_match[11],
            }
        },
        parseQueryItem: function(item, allow_range){
            if(item && !/^[_*?]$/.test(item)){
                m = /^\[([^\]]*)\]$/.exec(item);
                if(m) {
                    item = m[1];
                    if(allow_range && /:/.test(item)){
                        return {BETWEEN : item.split(':')};
                    }
                    return {IN  : item.split(',')};
                } else {
                    return {'=' : item};
                }
            }
            return undefined;
        },
        parseUrlQuery: function(recording_url){
            var components = this.parseUrl(recording_url);
            return {
                site   : this.parseQueryItem(components.site  , false),
                year   : this.parseQueryItem(components.year  , true ),
                month  : this.parseQueryItem(components.month , true ),
                day    : this.parseQueryItem(components.day   , true ),
                hour   : this.parseQueryItem(components.hour  , true ),
                minute : this.parseQueryItem(components.minute, true )
            };
        },
        applyQueryItem: function(subject, query){
            if(query){
                if (query['=']) {
                    return subject + ' = ' + mysql.escape(query['=']);
                } else if (query['IN']) {
                    return subject + ' IN [' + mysql.escape(query['IN']) + ']';
                } else if (query['BETWEEN']) {
                    return subject + ' BETWEEN ' + mysql.escape(query['BETWEEN'][0]) + ' AND ' + mysql.escape(query['BETWEEN'][1]);
                }
            }
            return undefined;
        },
        
        findByUrlMatch: function (recording_url, project_id, callback) {
            var urlquery = this.parseUrlQuery(recording_url);
            var constraints = [
                'S.project_id = ' + mysql.escape(project_id)
            ];
            var subjects = {
                site   : 'S.name'            ,
                year   : 'YEAR(R.datetime)'  ,
                month  : 'MONTH(R.datetime)' ,
                day    : 'DAY(R.datetime)'   ,
                hour   : 'HOUR(R.datetime)'  ,
                minute : 'MINUTE(R.datetime)'
            };
            for(var i in urlquery){
                var constraint = this.applyQueryItem(subjects[i], urlquery[i]);
                if(constraint) {
                    constraints.push(constraint);
                }
            }
            var query = "SELECT R.recording_id AS id, R.site_id as site, R.uri, R.datetime, R.mic, R.recorder, R.version \n" +
                "FROM recordings R \n" +
                "JOIN sites S ON S.site_id = R.site_id \n" +
                "WHERE (" + constraints.join(") AND (") + ")";
            return queryHandler(query , callback);
        }
    };
}
    
