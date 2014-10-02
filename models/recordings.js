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
                    return subject + ' IN (' + mysql.escape(query['IN']) + ')';
                } else if (query['BETWEEN']) {
                    return subject + ' BETWEEN ' + mysql.escape(query['BETWEEN'][0]) + ' AND ' + mysql.escape(query['BETWEEN'][1]);
                }
            }
            return undefined;
        },
        
        /**
         * finds recordings matching the given url and project id.
         * @param {String} recording_url url query selecting the set of recordings
         * @param {Integer} project_id id of the project associated to the recordings
         * @param {Object} options options object that modify returned results.
         * @param {Boolean} options.count_only Whether to return the queried recordings, or to just count them
         * @param {String} options.group_by Level in wich to group recordings (valid items : site, year, month, day, hour, auto, next)
         * @param {Function} callback called back with the queried results.
         */
        findByUrlMatch: function (recording_url, project_id, options, callback) {
            if (!options) {
                options = {};
            }
            var urlquery = this.parseUrlQuery(recording_url);
            var constraints = [
                'S.project_id = ' + mysql.escape(project_id)
            ];
            var fields = {
                site   : {subject: 'S.name'            , project: false, level:1, next: 'year'                },
                year   : {subject: 'YEAR(R.datetime)'  , project: true , level:2, next: 'month' , prev:'site' },
                month  : {subject: 'MONTH(R.datetime)' , project: true , level:3, next: 'day'   , prev:'year' },
                day    : {subject: 'DAY(R.datetime)'   , project: true , level:4, next: 'hour'  , prev:'month'},
                hour   : {subject: 'HOUR(R.datetime)'  , project: true , level:5, next: 'minute', prev:'day'  },
                minute : {subject: 'MINUTE(R.datetime)', project: true , level:6                , prev:'hour' }
            };
            var count_only = options.count_only;
            var group_by = {
                curr    : fields[options.group_level],
                curr_level : options.group_by,
                level   : options.group_by,
                projection : [],
                columns : [],
                clause  : '',
                project_part : ''
            };
            
            for(var i in urlquery){
                var field = fields[i];
                var constraint = this.applyQueryItem(field && field.subject, urlquery[i]);
                if(constraint) {
                    constraints.push(constraint);
                    if(group_by.level == 'auto' || group_by.level == 'next') {
                        if(!group_by.curr || group_by.curr.level < field.level) {
                            group_by.curr = field;
                            group_by.curr_level = i;
                        }
                    }
                }
            }
            console.log(options, group_by);
            
            if(group_by.level == 'next' && group_by.curr && group_by.curr.next) {
                group_by.curr_level = group_by.curr.next;
                group_by.curr = fields[group_by.curr_level];
            }
            
            while(group_by.curr){
                if(count_only || group_by.curr.project) {
                    group_by.projection.unshift(group_by.curr.subject + ' as ' + group_by.curr_level);
                }
                if (count_only) {
                    group_by.columns.unshift(group_by.curr.subject);
                }
                group_by.curr_level = group_by.curr.prev;
                group_by.curr = fields[group_by.curr_level];
            }
            if(group_by.columns.length > 0) {
                group_by.clause = "\n GROUP BY " + group_by.columns.join(", ");
            }
            if(group_by.projection.length > 0) {
                group_by.project_part = group_by.projection.join(", ") + ",";
            }
            console.log(group_by);
            var projection = count_only ? "COUNT(*) as count" : "R.recording_id AS id, R.site_id as site, R.uri, R.datetime, R.mic, R.recorder, R.version";
            var query = "SELECT " + group_by.project_part + projection + " \n" +
                "FROM recordings R \n" +
                "JOIN sites S ON S.site_id = R.site_id \n" +
                "WHERE (" + constraints.join(") AND (") + ")" +
                group_by.clause;
            return queryHandler(query , callback);
        }
    };
}
    
