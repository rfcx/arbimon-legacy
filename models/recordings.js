// dependencies
var async        = require('async');
var AWS          = require('aws-sdk');
var mysql        = require('mysql');
var util         = require('util');
var config       = require('../config'); 
var arrays_util  = require('../utils/arrays');
var tmpfilecache = require('../utils/tmpfilecache');
var audiotool    = require('../utils/audiotool');
// local variables
var s3;

// exports
module.exports = function(queryHandler) {
    var Recordings = {
        parseUrl: function(recording_url){
            var rec_match;
            if (recording_url) {
                rec_match = /^(\d+)$/.exec(recording_url);
                if(rec_match) return {
                    id    : rec_match[ 1] | 0
                };
            //                site     year     month    day       hour     minute
            //                1      2 3      4 5      6 7       8 9     10 11    10987654321
            //                1     01 2     12 3     23 4      34 5     45 6     54 3 2 1
                rec_match = /^([^-]*)(-([^-]*)(-([^-]*)(-([^-_]*)([_-]([^-]*)(-([^-]*))?)?)?)?)?(\.(wav|flac))?/.exec(recording_url);
                if(rec_match) return {
                    site   : rec_match[ 1],
                    year   : rec_match[ 3],
                    month  : rec_match[ 5],
                    day    : rec_match[ 7],
                    hour   : rec_match[ 9],
                    minute : rec_match[11]
                };
            }
            return {};
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
                id     : this.parseQueryItem(components.id    , false),
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
        
        /** Finds recordings matching the given url and project id.
         * @param {String} recording_url url query selecting the set of recordings
         * @param {Integer} project_id id of the project associated to the recordings
         * @param {Object} options options object that modify returned results (optional).
         * @param {Boolean} options.count_only Whether to return the queried recordings, or to just count them
         * @param {String} options.group_by Level in wich to group recordings (valid items : site, year, month, day, hour, auto, next)
         * @param {Function} callback called back with the queried results. 
         */
        findByUrlMatch: function (recording_url, project_id, options, callback) {
            if(options instanceof Function){
                callback = options;
                options = null;
            }
            options || (options = {});
            var urlquery = this.parseUrlQuery(recording_url);
            var keep_keys = options.keep_keys;
            var limit_clause = (options.limit ?
                " LIMIT " + (options.limit|0) + (options.offset ? " OFFSET " + (options.offset|0) : "") : ""
            );
            var constraints = [
                'S.project_id = ' + mysql.escape(project_id)
            ];
            var fields = {
                id     : {subject: 'R.recording_id'    , project:  true},
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
                levels  : [],
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
            
            if(group_by.level == 'next'){
                if(group_by.curr){
                    if(group_by.curr.next) {
                        group_by.curr_level = group_by.curr.next;
                        group_by.curr = fields[group_by.curr_level];
                    }
                } else {
                    for(var i in fields){
                        var field = fields[i];
                        if(!group_by.curr || group_by.curr.level > field.level) {
                            group_by.curr = field;
                            group_by.curr_level = i;
                        }
                    }
                }
            }
            
            while(group_by.curr){
                group_by.levels.unshift(group_by.curr_level);
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
            var projection = count_only ? "COUNT(*) as count" : "R.recording_id AS id, S.name as site, R.uri, R.datetime, R.mic, R.recorder, R.version";
            var sql = "SELECT " + group_by.project_part + projection + " \n" +
                "FROM recordings R \n" +
                "JOIN sites S ON S.site_id = R.site_id \n" +
                "WHERE (" + constraints.join(") AND (") + ")" +
                group_by.clause + limit_clause;
                
            var query = {
                sql: sql,
                typeCast: function (field, next) {
                    if (field.type !== 'DATETIME') return next(); // 1 = true, 0 = false
                    
                    var d = new Date(field.string());
                    //~ console.log(d);
                    
                    d.setTime(d.getTime() - (d.getTimezoneOffset() * 60000));
                    
                    //~ console.log(d);
                    return d;
                }
            };
            
            return queryHandler(query, function(err, data){
                if (!err && data && group_by.levels.length > 0) {
                    data = arrays_util.group_rows_by(data, group_by.levels, options);
                }
                callback(err, data);
            });
        },
        
        /** Finds out stats about a given recording and returns them.
         * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
         * @param {Object} recording.id integer that uniquely identifies the recording in the database.
         * @param {Object} recording.uri url containing the recording's path in the bucket.
         * @param {Function} callback called with the recording info.
         */
        fetchInfo : function(recording, callback){
            recording.file = recording.uri.split('/').pop();
            Recordings.fetchRecordingFile(recording, function(err, cachedRecording){
                if(err || !cachedRecording) { callback(err, cachedRecording); return; }
                audiotool.info(cachedRecording.path, function(err, recStats){
                    recording.stats = recStats;
                    callback(null, recording);
                });
            });
        },
        
        /** Fetches the validations for a given recording.
         * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
         * @param {Object} recording.id integer that uniquely identifies the recording in the database.
         * @param {Function} callback(err, validations) function called back with the queried results. 
         */
        fetchValidations: function (recording, callback) {
            var query = "SELECT recording_validation_id as id, user_id as user, project_class_id as class, present \n" +
                "FROM recording_validations \n" +
                "WHERE recording_id = " + mysql.escape(recording.id)
            return queryHandler(query, callback);
        },
        
        /** Downloads a recording from the bucket, storing it in a temporary file cache, and returns its path.
         * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
         * @param {Object} recording.uri url containing the recording's path in the bucket.
         * @param {Function} callback(err, path) funciton to call back with the recording's path.
         */
        fetchRecordingFile: function(recording, callback){
            tmpfilecache.fetch(recording.uri, function(cache_miss){
                console.log('fetching ', recording.uri, ' from the bucket.')
                if(!s3){
                    s3 = new AWS.S3();
                }
                s3.getObject({
                    Bucket : config('aws').bucketName,
                    Key    : recording.uri
                }, function(err, data){
                    if(err) { callback(err); return; }
                    cache_miss.set_file_data(data.Body);
                });
            }, callback)
        },
        
        /** Returns the audio file of a given recording.
         * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
         * @param {Object} recording.uri url containing the recording's path in the bucket.
         * @param {Function} callback(err, path) funciton to call back with the recording audio file's path.
         */
        fetchAudioFile: function (recording, callback) {
            var mp3audio_key = recording.uri.replace(/\.(wav|flac)/, '.mp3');
            tmpfilecache.fetch(mp3audio_key, function(cache_miss){
                Recordings.fetchRecordingFile(recording, function(err, recording_path){
                    audiotool.transcode(recording_path.path, cache_miss.file, {
                        sample_rate: 44100, format: 'mp3', channels: 1
                    }, function(status_code){
                        if(status_code) { callback({code:status_code}); return; }
                        cache_miss.retry_get();
                    });
                });
            }, callback)
        },
        
        /** Returns the spectrogram file of a given recording.
         * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
         * @param {Object} recording.uri url containing the recording's path in the bucket.
         * @param {Function} callback(err, path) funciton to call back with the recording spectrogram file's path.
         */
        fetchSpectrogramFile: function (recording, callback) {
            var mp3audio_key = recording.uri.replace(/\.(wav|flac)/, '.png');
            tmpfilecache.fetch(mp3audio_key, function(cache_miss){
                Recordings.fetchRecordingFile(recording, function(err, recording_path){
                    audiotool.spectrogram(recording_path.path, cache_miss.file, function(status_code){
                        if(status_code) { callback({code:status_code}); return; }
                        cache_miss.retry_get();
                    });
                });
            }, callback)
        }
    };
    
    return Recordings;
}
    
