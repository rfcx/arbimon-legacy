// dependencies
var async = require('async');
var AWS   = require('aws-sdk');
var mysql = require('mysql');
var util  = require('util');
var Joi   = require('joi');
var im    = require('imagemagick');


var config       = require('../config'); 
var arrays_util  = require('../utils/arrays');
var tmpfilecache = require('../utils/tmpfilecache');
var audiotool    = require('../utils/audiotool');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
// local variables
var s3;
var queryHandler = dbpool.queryHandler;

var date2UTC = function (field, next) {
    if (field.type !== 'DATETIME') return next(); // 1 = true, 0 = false
    
    var d = new Date(field.string());
    // console.log(d);
    
    d.setTime(d.getTime() - (d.getTimezoneOffset() * 60000));
    
    // console.log(d);
    return d;
}



// exports
var Recordings = {
    QUERY_FIELDS : {
        id     : {subject: 'R.recording_id'    , project:  true},
        site   : {subject: 'S.name'            , project: false, level:1, next: 'year'                },
        year   : {subject: 'YEAR(R.datetime)'  , project: true , level:2, next: 'month' , prev:'site' },
        month  : {subject: 'MONTH(R.datetime)' , project: true , level:3, next: 'day'   , prev:'year' },
        day    : {subject: 'DAY(R.datetime)'   , project: true , level:4, next: 'hour'  , prev:'month'},
        hour   : {subject: 'HOUR(R.datetime)'  , project: true , level:5, next: 'minute', prev:'day'  },
        minute : {subject: 'MINUTE(R.datetime)', project: true , level:6                , prev:'hour' }
    },
    parseUrl: function(recording_url){
        var rec_match;
        if (recording_url) {
            if(typeof recording_url == "object"){
                return recording_url;
            }
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
        if(item){
            var t_item = typeof item;  
            if(/string|number/.test(t_item) && !/^[_*?]$/.test(item)){
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
            } else if(item instanceof Array){
                return {IN  : item};
            } else if(t_item == "object"){
                return item;
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
     * @param {String} options.compute other (computed) attributes to show on returned recordings
     * @param {String} options.group_by Level in wich to group recordings (valid items : site, year, month, day, hour, auto, next)
     * @callback {Function} callback called back with the queried results. 
     **/
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
        var order_clause = (options.order ?
            " ORDER BY S.name ASC, R.datetime ASC" : ''
        );
            
        var fields = Recordings.QUERY_FIELDS;
        
        var constraints = sqlutil.compile_query_constraints(urlquery, fields);
        if(!urlquery.id) {
            constraints.unshift('S.project_id = ' + mysql.escape(project_id));
        }
        
        var group_by = sqlutil.compute_groupby_constraints(urlquery, fields, options.group_by, {
            count_only : options.count_only
        });
        
        var projection;
        if (options.count_only) {
            projection = "COUNT(*) as count";
        } else {
            projection = "R.recording_id AS id, SUBSTRING_INDEX(R.uri,'/',-1) as file,S.name as site, R.uri, R.datetime, R.mic, R.recorder, R.version";
        }
        
        var sql = "SELECT " + group_by.project_part + projection + " \n" +
            "FROM recordings R \n" +
            "JOIN sites S ON S.site_id = R.site_id \n" +
            "WHERE (" + constraints.join(") AND (") + ")" +
            group_by.clause +
            order_clause +
            limit_clause;
            
        var query = {
            sql: sql,
            typeCast: date2UTC,
        };
        
        return queryHandler(query, function(err, data){
            if (!err && data){
                if(group_by.levels.length > 0) {
                    data = arrays_util.group_rows_by(data, group_by.levels, options);
                } else if(options.compute){
                    arrays_util.compute_row_properties(data, options.compute, function(property){
                        return Recordings['__compute_' + property.replace(/-/g,'_')];
                    }, callback);
                    return;
                }
            }
            callback(err, data);
        });
    },
    
    fetchNext: function (recording, callback) {
        var query = "SELECT R2.recording_id as id\n" +
            "FROM recordings R \n" +
            "JOIN recordings R2 ON " +
                "R.site_id = R2.site_id " +
                "AND R.datetime < R2.datetime \n" +
            "WHERE R.recording_id = " + mysql.escape(recording.id) + "\n" +
            "ORDER BY R2.datetime ASC \n" +
            "LIMIT 1";
            
        return queryHandler(query, function(err, rows){
            if(err) { callback(err); return; }
            if(!rows || !rows.length) { callback(null, [recording]); return; }
            Recordings.findByUrlMatch(rows[0].id, 0, {limit:1}, callback);                
        });
    },
    fetchPrevious: function (recording, callback) {
        var query = "SELECT R2.recording_id as id\n" +
            "FROM recordings R \n" +
            "JOIN recordings R2 ON " +
                "R.site_id = R2.site_id " +
                "AND R.datetime > R2.datetime \n" +
            "WHERE R.recording_id = " + mysql.escape(recording.id) + "\n" +
            "ORDER BY R2.datetime DESC \n" +
            "LIMIT 1";
            
        return queryHandler(query, function(err, rows){
            if(err) { callback(err); return; }
            if(!rows || !rows.length) { callback(null, [recording]); return; }
            Recordings.findByUrlMatch(rows[0].id, 0, {limit:1}, callback);                
        });
    },
            
    /** Finds out stats about a given recording and returns them.
     * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     * @param {Object} recording.id integer that uniquely identifies the recording in the database.
     * @param {Object} recording.uri url containing the recording's path in the bucket.
     * @param {Function} callback called with the recording info.
     */
    fetchInfo : function(recording, callback){
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
        var query = "SELECT recording_validation_id as id, user_id as user, species_id as species, songtype_id as songtype, present \n" +
            "FROM recording_validations \n" +
            "WHERE recording_id = " + mysql.escape(recording.id);
        return queryHandler(query, callback);
    },
    
    /** Downloads a recording from the bucket, storing it in a temporary file cache, and returns its path.
     * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     * @param {Object} recording.uri url containing the recording's path in the bucket.
     * @param {Function} callback(err, path) funciton to call back with the recording's path.
     */
    fetchRecordingFile: function(recording, callback){
        tmpfilecache.fetch(recording.uri, function(cache_miss){
            console.log('fetching ', recording.uri, ' from the bucket.');
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
        }, callback);
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
                if(err) { callback(err); return; }
                audiotool.transcode(recording_path.path, cache_miss.file, {
                    sample_rate: 44100, format: 'mp3', channels: 1
                }, function(status_code){
                    if(status_code) { callback({code:status_code}); return; }
                    cache_miss.retry_get();
                });
            });
        }, callback);
    },
    
    /** Returns the spectrogram file of a given recording.
     * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     * @param {Object} recording.uri url containing the recording's path in the bucket.
     * @param {Function} callback(err, path) funciton to call back with the recording spectrogram file's path.
     */
    fetchSpectrogramFile: function (recording, callback) {
        var spectrogram_key = recording.uri.replace(/\.(wav|flac)/, '.png');
        tmpfilecache.fetch(spectrogram_key, function(cache_miss){
            Recordings.fetchRecordingFile(recording, function(err, recording_path){
                if(err) { callback(err); return; }
                audiotool.spectrogram(recording_path.path, cache_miss.file, {
                    pixPerSec : config("spectrograms").spectrograms.pixPerSec,
                    height    : config("spectrograms").spectrograms.height
                },function(status_code){
                    if(status_code) { callback({code:status_code}); return; }
                    cache_miss.retry_get();
                });
            });
        }, callback);
    },

    fetchSpectrogramTiles: function (recording, callback) {
        var spectro_path;
        var px2sec, px2hz, max_freq;
        async.waterfall([
            function(next){
                if(!recording.stats){
                    Recordings.fetchInfo(recording, next);
                } else {
                    next(null, recording);
                }
            },
            function(rec_info,  next){
                recording = rec_info;
                Recordings.fetchSpectrogramFile(recording, next);
            },
            function(_1, next){
                spectro_path = _1.path;
                im.identify(spectro_path, next);
            },
            function(spectro_info, next){
                px2sec = recording.stats.duration    / spectro_info.width ;
                max_freq = recording.stats.sample_rate / 2;
                px2hz  = max_freq / spectro_info.height;
                var tile_max_w = config("spectrograms").spectrograms.tiles.max_width;
                var tile_max_h = config("spectrograms").spectrograms.tiles.max_height;
                var tile_count_x = Math.ceil(spectro_info.width  * 1.0 / tile_max_w) | 0;
                var tile_count_y = Math.ceil(spectro_info.height * 1.0 / tile_max_h) | 0;
                var tiles_x=[], tiles_y=[], tile_set=[];
                recording.tiles = {
                    x : tile_count_x,
                    y : tile_count_y,
                    set: tile_set
                };

                for(var x=0; x < tile_count_x; ++x){ tiles_x.push(x); }
                for(var y=0; y < tile_count_y; ++y){ tiles_y.push(y); }
                async.eachLimit(tiles_y, 5, function(tile_y, next_tile_y){
                    var tile_y0 = Math.min( tile_y   *tile_max_h, spectro_info.height),
                        tile_y1 = Math.min((tile_y+1)*tile_max_h, spectro_info.height),
                        tile_h  = tile_y1 - tile_y0;
                    async.eachLimit(tiles_x, 5, function(tile_x, next_tile_x){
                        var tile_x0 = Math.min( tile_x   *tile_max_w, spectro_info.width),
                            tile_x1 = Math.min((tile_x+1)*tile_max_w, spectro_info.width),
                            tile_w  = tile_x1 - tile_x0;
                        var tile_key = recording.uri.replace(/\.(wav|flac)/, '.tile_'+tile_x+'_'+tile_y+'.png');
                        tmpfilecache.fetch(tile_key, function(cache_miss){
                            var tile_file = tmpfilecache.key2File(tile_key);
                            Recordings.fetchRecordingFile(recording, function(err, recording_path){
                                if(err) { next_tile_x(err); return; }
                                im.convert([
                                    spectro_path,
                                    '-colorspace', 'RGB',
                                    '-crop',
                                    tile_w+'x'+tile_h+'+'+tile_x0+'+'+tile_y0,
                                    '+repage',
                                    '-colorspace', 'RGB',
                                    tile_file
                                ], function(err){
                                    if(err) { next_tile_x(err); return; }
                                    cache_miss.retry_get();
                                });
                            });
                        }, function(err, val){
                            if(err) { next_tile_x(err); return; }
                            tile_set.push({
                                j : tile_x , i : tile_y ,
                                s  : tile_x0 * px2sec,  hz : max_freq - tile_y0 * px2hz,
                                ds : tile_w * px2sec, dhz : tile_h * px2hz,
                                x : tile_x0, y : tile_y0,
                                w : tile_w , h : tile_h
                            });
                            next_tile_x();
                        });
                    }, next_tile_y);
                }, function(){
                    var spectrogram_key = recording.uri.replace(/\.(wav|flac)/, '.png');
                    next(null, recording);
                });
            }
        ], callback);
    },
    
    fetchOneSpectrogramTile: function (recording, i, j, callback) {
        var tile_key = recording.uri.replace(/\.(wav|flac)/, '.tile_'+j+'_'+i+'.png');
        tmpfilecache.fetch(tile_key, function(cache_miss){
            Recordings.fetchSpectrogramTiles(recording, function(err, recording){
                if(err) { callback(err); return; }
                cache_miss.retry_get();
            });
        }, callback);
    },

    /** Returns the thumbnail file of a given recording.
     * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     * @param {Object} recording.uri url containing the recording's path in the bucket.
     * @param {Function} callback(err, path) funciton to call back with the recording spectrogram file's path.
     */
    fetchThumbnailFile: function (recording, callback) {
        var thumbnail_key = recording.uri.replace(/\.(wav|flac)/, '.thumbnail.png');
        tmpfilecache.fetch(thumbnail_key, function(cache_miss){
            Recordings.fetchRecordingFile(recording, function(err, recording_path){
                if(err) { callback(err); return; }
                audiotool.spectrogram(recording_path.path, cache_miss.file, {
                    maxfreq   : 15000,
                    pixPerSec : (7),
                    height    : (153)
                },function(status_code){
                    if(status_code) { callback({code:status_code}); return; }
                    cache_miss.retry_get();
                });
            });
        }, callback);
    },
    
    /** Validates a recording.
     * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     * @param {Integer} user_id id of the user to associate to this validation.
     * @param {Integer} project_id id associated to the project that is to be validated.
     * @param {Object}  validation object containing the validation to add to this recording.
     * @param {String}  validation.class identifier used to obtain the class to be validated.
     * @param {Integer} validation.val   value used to validate the class in the given recording.
     * @param {Function} callback(err, path) funciton to call back with the validation result.
     */
    validate: function (recording, user_id, project_id, validation, callback) {
        if(!validation) {
            callback(new Error("validation is missing."));
            return;
        }
        
        var add_one_validation = function(species_id, songtype_id, callback){
            var valobj = {
                recording : recording.id,
                user      : user_id,
                species   : species_id,
                songtype  : songtype_id,
                val       : validation.val | 0,
                project_id: project_id
            };

            if (valobj.val== 2) // 0 is not present , 1 is present and 2 is clear
            {
                queryHandler(
                    "DELETE FROM `recording_validations` "+
                    " WHERE `recording_id` = "+mysql.escape(valobj.recording)+" and `project_id` = "+mysql.escape(valobj.project_id)+"  " +
                    " and `species_id` = "+mysql.escape(valobj.species)+" and `songtype_id` = "+mysql.escape(valobj.songtype)+" ",
                    function(err, data){
                    if (err) { callback(err); return; }
                    callback(null, valobj);
                });
            }
            else
            {
                queryHandler(
                    "INSERT INTO recording_validations(recording_id, user_id, species_id, songtype_id, present, project_id) \n" +
                    " VALUES (" + mysql.escape([valobj.recording, valobj.user, valobj.species, valobj.songtype, valobj.val, valobj.project_id]) + ") \n" +
                    " ON DUPLICATE KEY UPDATE present = VALUES(present)", function(err, data){
                    if (err) { callback(err); return; }
                    callback(null, valobj);
                });
            }
        };
        
        var classes = validation['class'].split(',');
        
        async.mapLimit(classes, 5, function(val_class, next){
            var cm = /(\d+)(-(\d+))?/.exec(val_class);
            if(!cm) {
                next(new Error("validation class is missing."));
            } else if(!cm[2]){
                var project_class = cm[1] | 0;
                queryHandler(
                    "SELECT species_id as species, songtype_id as songtype \n" +
                    "FROM project_classes \n" +
                    "WHERE project_class_id = " + mysql.escape(project_class) + "\n" +
                    "  AND project_id = " + mysql.escape(project_id), function(err, data){
                    if (err) { next(err); return; }
                    if (!data || !data.length) { next(new Error("project class " + project_class + " not found")); return; }
                    add_one_validation(species_id, songtype_id, next);
                });
            } else {
                add_one_validation(cm[1] | 0, cm[3] | 0, next);
            }
        }, callback);        
        
    },
    
    insert: function(recording, callback) {
        
        var schema = {
            site_id: Joi.number().required(),
            uri: Joi.string().required(),
            datetime: Joi.date().required(),
            mic: Joi.string().required(),
            recorder: Joi.string().required(),
            version: Joi.string().required()
        };
        
        Joi.validate(recording, schema, function(err, rec) {
            var values = [];
        
            for( var j in rec) {
                rec[j] = mysql.escape(rec[j]);                    
                values.push(util.format('`%s`=%s', j, rec[j]));
            }
            
            var q = 'INSERT INTO recordings \n'+
                    'SET %s';
                    
            q = util.format(q, values.join(", "));
            queryHandler(q, callback);
        });
    },
    
    exists: function(recording, callback) {
        
        if(!recording.site_id || !recording.filename)
            callback(new Error("Missing fields"));
        
        var q = "SELECT count(*) as count \n"+
                "FROM recordings \n"+
                "WHERE site_id = %s \n"+
                "AND uri LIKE %s";
        
        var uri = mysql.escape('%' + recording.filename + '%');
        var site_id = mysql.escape(Number(recording.site_id));
        q = util.format(q, site_id, uri);
        queryHandler(q, function(err, rows) {
            if(err)
                return callback(err);
                
            callback(null, rows[0].count > 0);
        });
    },
    
    __compute_thumbnail_path : function(recording, callback){
        recording.thumbnail = 'https://' + config('aws').bucketName + '.s3.amazonaws.com/' + recording.uri.replace(/\.([^.]*)$/, '.thumbnail.png');
        callback();
    },
    __compute_spectrogram_tiles : function(recording, callback){
        Recordings.fetchSpectrogramTiles(recording, callback);
    },    
    
    findProjectRecordings: function(params, callback) {
        var schema = {
            project_id: Joi.number().required(),
            range: Joi.object().keys({
                from: Joi.date(),
                to: Joi.date()
            }).and('from', 'to'),
            sites:  [Joi.string(), Joi.array().includes(Joi.string())],
            years:  [Joi.number(), Joi.array().includes(Joi.number())],
            months: [Joi.number(), Joi.array().includes(Joi.number())],
            days:   [Joi.number(), Joi.array().includes(Joi.number())],
            hours:  [Joi.number(), Joi.array().includes(Joi.number())],
            limit:  Joi.number(),
            offset: Joi.number(),
            sortBy: Joi.string(),
            sortRev: Joi.boolean(), 
            output:  Joi.string()
        };
        
        Joi.validate(params, schema, function(err, parameters) {
            if(err) return callback(err);
            
            if(!parameters.output)
                parameters.output = 'list';
            
            var select = {
                list: ("SELECT r.recording_id AS id, \n"+
                      "       SUBSTRING_INDEX(r.uri,'/',-1) as file, \n"+
                      "       s.name as site, \n"+
                      "       r.uri, \n"+
                      "       r.datetime, \n"+
                      "       r.mic, \n"+
                      "       r.recorder, \n"+
                      "       r.version \n"),
                      
                date_range: ("SELECT DATE(MIN(r.datetime)) AS min_date, \n"+
                            "       DATE(MAX(r.datetime)) AS max_date \n"),
                            
                count: "SELECT COUNT(*) as count \n"
            };
            
            var q = select[parameters.output] +
                    "FROM recordings AS r \n"+
                    "JOIN sites AS s ON s.site_id = r.site_id \n"+
                    "WHERE s.project_id = %s \n";
                    
            q = util.format(q, parameters.project_id);
            
            if(parameters.range) {
                q += 'AND r.datetime BETWEEN '+ mysql.escape(parameters.range.from) +' AND ' + mysql.escape(parameters.range.to) + ' \n';
            }
            
            if(parameters.sites){
                q += 'AND s.name IN (' + mysql.escape(parameters.sites) + ') \n';
            }
            
            if(parameters.years){
                q += 'AND YEAR(r.datetime) IN (' + mysql.escape(parameters.years) + ') \n';
            }
            
            if(parameters.months){
                var months;
                
                if(months instanceof Array)
                    months = parameters.months.map(function(m) { return m+1; });
                else
                    months = parameters.months+1;
                
                q += 'AND MONTH(r.datetime) IN (' + mysql.escape(months) + ') \n';
            }
            
            if(parameters.days){
                q += 'AND DAY(r.datetime) IN (' + mysql.escape(parameters.days) + ') \n';
            }
            
            if(parameters.hours){
                q += 'AND HOUR(r.datetime) IN (' + mysql.escape(parameters.hours) + ') \n';
            }
            
            if(parameters.output === 'list') {
                var sortBy = parameters.sortBy || 'site';
                var sortRev = parameters.sortRev ? 'DESC' : '';
                
                q += 'ORDER BY ' + mysql.escapeId(sortBy) + ' ' + sortRev +' \n';
            }
            
            if(parameters.limit) {
                var offset = parameters.offset || 0;
                q += 'LIMIT ' + mysql.escape(offset) + ', ' + mysql.escape(parameters.limit);
            }
            
            var query = {
                sql: q,
                typeCast: date2UTC,
            };
            queryHandler(query, callback);
        });
    }
};

module.exports = Recordings;
    
