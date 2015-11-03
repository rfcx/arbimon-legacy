/* jshint node:true */
"use strict";

// dependencies
var util  = require('util');
var path   = require('path');
var Q = require('q');
var fs = require('fs');

var debug = require('debug')('arbimon2:model:recordings');
var async = require('async');
var AWS   = require('aws-sdk');
var mysql = require('mysql');
var joi   = require('joi');
var _     = require('lodash');
var sprintf = require("sprintf-js").sprintf;

var config       = require('../config'); 
var arrays_util  = require('../utils/arrays');
var tmpfilecache = require('../utils/tmpfilecache');
var audioTools   = require('../utils/audiotool');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
var tyler        = require('../utils/tyler.js');


// local variables
var s3 = new AWS.S3();
var queryHandler = dbpool.queryHandler;


var getUTC = function (date) {
    var d = new Date(date);
    d.setTime(d.getTime() + (d.getTimezoneOffset() * 60000));
    return d;
};

var fileExtPattern = /\.(wav|flac)$/;
var freqFilterPrecision = 100;

// exports
var Recordings = {
    QUERY_FIELDS : {
        id     : { subject: 'R.recording_id',     project:  true },
        site   : { subject: 'S.name',             project: false, level:1, next: 'year'                },
        year   : { subject: 'YEAR(R.datetime)',   project: true,  level:2, next: 'month' , prev:'site' },
        month  : { subject: 'MONTH(R.datetime)',  project: true,  level:3, next: 'day'   , prev:'year' },
        day    : { subject: 'DAY(R.datetime)',    project: true,  level:4, next: 'hour'  , prev:'month'},
        hour   : { subject: 'HOUR(R.datetime)',   project: true,  level:5, next: 'minute', prev:'day'  },
        minute : { subject: 'MINUTE(R.datetime)', project: true,  level:6,                 prev:'hour' }
    },
    parseUrl: function(recording_url){
        var patternFound = false, resolved = false;
        var deferred = Q.defer();
        var promise = deferred.promise;
        var rec_match;
        if (recording_url) {
            // match given objects
            if(typeof recording_url == "object"){
                patternFound = true;
                deferred.resolve(recording_url);
            // match recording ids
            } else if((rec_match = /^(\d+)$/.exec(recording_url))){
                patternFound = true;
                deferred.resolve({
                    id    : rec_match[ 1] | 0
                });
            //                site     year     month    day       hour     minute
            //                1        2 3      4 5      6 7       8 9     10 11    10987654321
            //                1       01 2     12 3     23 4      34 5     45 6     54 3 2 1
            } else if((rec_match = /^([^-]*)(-([^-]*)(-([^-]*)(-([^-_]*)([_-]([^-]*)(-([^-]*))?)?)?)?)?(\.(wav|flac))?/.exec(recording_url))){
                patternFound = true;
                deferred.resolve({
                    site   : rec_match[ 1],
                    year   : rec_match[ 3],
                    month  : rec_match[ 5],
                    day    : rec_match[ 7],
                    hour   : rec_match[ 9],
                    minute : rec_match[11]
                });

                promise = promise.then(function(parsedUrl){
                    // expand site if site is !q:(site_id)
                    var m = /^!q:(\d+)$/.exec(parsedUrl.site);
                    if(m){
                        var site_id = m[1] | 0;
                        return Q.nfcall(queryHandler,
                            "SELECT S.name\n" +
                            "FROM sites S\n" +
                            "WHERE S.site_id = " + site_id
                        ).then(function(query_results){
                            var data = query_results.shift();
                            if(data && data.length){
                                parsedUrl.site = data[0].name;
                            } else {
                                parsedUrl.site = {no_match:true};
                            }
                            return parsedUrl;
                        });
                    } else {
                        return parsedUrl;
                    }
                }).then(function(parsedUrl){
                    // parse special /last|first/ flags
                    var f = ["year", "month", "day", "hour", "minute"], m;
                    var hasSpecial = false;
                    for(var i=0, e=f.length; i<e; ++i){
                        if((m=/^(first|last|latest)$/.exec(parsedUrl[f[i]]))){
                            parsedUrl.special = m[1];
                            hasSpecial = true;
                        }
                        if(hasSpecial){
                            // if special flag is parsed, then subfields arent needed.
                            delete parsedUrl[f[i]];
                        }
                    }
                    return parsedUrl;
                });
            }
        }

        if(!patternFound){
            deferred.resolve({});
            patternFound = true;
        }
        
        return promise;
    },
    parseQueryItem: function(item, allow_range){
        if(item){
            var t_item = typeof item;  
            if(/string|number/.test(t_item) && !/^[_*?]$/.test(item)){
                var m = /^\[([^\]]*)\]$/.exec(item);
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
        return this.parseUrl(recording_url).then((function(components){
            return {
                special: components.special,
                id     : this.parseQueryItem(components.id    , false),
                site   : this.parseQueryItem(components.site  , false),
                year   : this.parseQueryItem(components.year  , true ),
                month  : this.parseQueryItem(components.month , true ),
                day    : this.parseQueryItem(components.day   , true ),
                hour   : this.parseQueryItem(components.hour  , true ),
                minute : this.parseQueryItem(components.minute, true )
            };
        }).bind(this));
    },
    // TODO:: remove unused function
    applyQueryItem: function(subject, query){
        if(query){
            if (query['=']) {
                return subject + ' = ' + mysql.escape(query['=']);
            } else if (query.IN) {
                return subject + ' IN (' + mysql.escape(query.IN) + ')';
            } else if (query.BETWEEN) {
                return subject + ' BETWEEN ' + mysql.escape(query.BETWEEN[0]) + ' AND ' + mysql.escape(query.BETWEEN[1]);
            }
        }
        return undefined;
    },
    
    findById: function(recId, callback) {
        var q = "SELECT * \n"+
                "FROM recordings \n"+
                "WHERE recording_id = ?";
        
        q = mysql.format(q, [recId]);
        queryHandler(q, callback);
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
        options = options || {};
        var keep_keys = options.keep_keys;
        var limit_clause = (options.limit ?
            " LIMIT " + (options.limit|0) + (options.offset ? " OFFSET " + (options.offset|0) : "") : ""
        );
        var order_clause = (options.order ?
            " ORDER BY S.name ASC, R.datetime ASC" : ''
        );
        var fields = Recordings.QUERY_FIELDS;
        
        var projection;
        if (options.count_only) {
            projection = "COUNT(*) as count";
        } else {
            projection = "R.recording_id AS id, \n"+
                        "SUBSTRING_INDEX(R.uri,'/',-1) as file, \n"+
                        "S.name as site, \n"+
                        "R.uri, \n"+
                        "R.datetime, \n"+
                        "R.mic, \n"+
                        "R.recorder, \n"+
                        "R.version, \n"+
                        "R.sample_rate, \n"+
                        "R.duration, \n"+
                        "R.samples, \n"+
                        "R.file_size, \n"+
                        "R.bit_rate, \n"+
                        "R.precision, \n"+
                        "R.sample_encoding";
        }
        
        var group_by, query;

        var promise = this.parseUrlQuery(recording_url).then(function(urlquery){            
            if(urlquery.special){
                limit_clause = " LIMIT 1";
                order_clause = " ORDER BY S.name ASC, R.datetime " + (urlquery.special == 'first' ? 'ASC' : 'DESC');
            }

            var constraints = sqlutil.compile_query_constraints(urlquery, fields);
            
            if(!urlquery.id) {
                var pid = mysql.escape(project_id);
                constraints.unshift('(S.project_id = ' + pid + ' OR PIS.project_id = ' + pid +')');
            }
            
            group_by = sqlutil.compute_groupby_constraints(urlquery, fields, options.group_by, {
                count_only : options.count_only
            });
            
            
            var sql = "SELECT " + group_by.project_part + projection + " \n" +
                "FROM recordings R \n" +
                "JOIN sites S ON S.site_id = R.site_id \n" +
                "LEFT JOIN project_imported_sites PIS ON S.site_id = PIS.site_id AND PIS.project_id = " + mysql.escape(project_id) + "\n"+
                "WHERE (" + constraints.join(") AND (") + ")" +
                group_by.clause +
                order_clause +
                limit_clause;
                
            query = {
                sql: sql,
                typeCast: sqlutil.parseUtcDatetime,
            };
            
            return Q.nfcall(queryHandler, query);
        }).then(function(query_results){
            var data = query_results.shift();
            if(data){
                if(group_by.levels.length > 0) {
                    return arrays_util.group_rows_by(data, group_by.levels, options);
                } else if(options.compute){
                    return arrays_util.compute_row_properties(data, options.compute, function(property){
                        return Recordings['__compute_' + property.replace(/-/g,'_')];
                    });
                } else {
                    return data;
                }
            }
        });
        
        if(callback){
            promise.then(function(data){
                callback(null, data);
                return data;
            }, callback);
        }
        
        return promise;
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
        if(recording.sample_rate) {
            return callback(null, recording);
        }
        
        Recordings.fetchRecordingFile(recording, function(err, cachedRecording){
            if(err || !cachedRecording) { callback(err, cachedRecording); return; }
            audioTools.info(cachedRecording.path, function(code, recStats){
                
                recording.sample_rate = recStats.sample_rate;
                recording.duration = recStats.duration;
                recording.samples = recStats.samples;
                recording.bit_rate = recStats.bit_rate;
                recording.precision = recStats.precision;
                recording.sample_encoding = recStats.sample_encoding;
                
                fs.stat(cachedRecording.path, function(err, stats){
                    if(err){ callback(err); return; }
                    recording.file_size = stats.size;
                    Recordings.update(_.cloneDeep(recording), function(err, results) {
                        if(err){ callback(err); return; }
                        console.log('rec %s info added to DB', recording.id);
                        callback(null, recording);
                    });
                });
                
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
     * @param {Function} callback(err, path) function to call back with the recording's path.
     */
    fetchRecordingFile: function(recording, callback){
        tmpfilecache.fetch(recording.uri, function(cache_miss){
            debug('fetching ', recording.uri, ' from the bucket.');
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
     * @param {Object} options object containing optional modifiers to the fetched recording. (optional)
     * @param {Object} options.gain the recording should have the specified gain applied.
     * @param {Object} options.maxFreq frequencies above the given one should be filtered.
     * @param {Object} options.minFreq frequencies below the given one should be filtered.
     * @param {Function} callback(err, path) function to call back with the recording audio file's path. (optional)
     * @return Promise with the fetched file.
     */
    fetchAudioFile: function (recording, options, callback) {
        if(callback === undefined && options instanceof Function){
            callback = options;
            options = undefined;
        }
        
        debug('fetchAudioFile');
        var mods=[];
        var mp3_ext = '.mp3';
        
        if(options){
            if(options.gain && options.gain != 1){
                mods.push({
                    ext:'gain-'+(options.gain|0),
                    args:{gain:options.gain}
                });
            }
            if(options.minFreq || options.maxFreq){
                var fmin=Math.min(((options.minFreq/freqFilterPrecision)|0)*freqFilterPrecision, 22049);
                var fmax=Math.min(((options.maxFreq/freqFilterPrecision)|0)*freqFilterPrecision, 22049);
                mods.push({
                    ext:'sinc-'+(fmin||'')+'-'+(fmax||''),
                    args:{filter:{min:fmin, max:fmax, type:'sinc'}}
                });
            }
        }
        
        if(mods.length){
            mp3_ext = '.' + mods.map(function(mod){
                return mod.ext;
            }).join('.') + mp3_ext;
        }
        
        var ifMissedGetFile = function(cache_miss) {
            debug('mp3 not found');
            Recordings.fetchRecordingFile(recording, function(err, recording_path){
                if(err) return callback(err); 

                var transcode_args = {
                    sample_rate: 44100, 
                    format: 'mp3', 
                    channels: 1
                };
                
                if(mods.length){
                    mods.forEach(function(mod){
                        var modtak = Object.keys(mod.args);
                        debug(mod, modtak);
                        for(var i=0, e=modtak.length; i < e; ++i){
                            transcode_args[modtak[i]] = mod.args[modtak[i]];
                        }
                    });
                }
                debug(transcode_args);
                
                audioTools.transcode(
                    recording_path.path, 
                    cache_miss.file, 
                    transcode_args,
                    function(status_code){
                        debug('done transcoding');
                        if(status_code) {
                            return callback({ code: status_code });
                        }
                        cache_miss.retry_get();
                    }
                );
            });
        };
        
        var mp3audio_key = recording.uri.replace(fileExtPattern, mp3_ext);
        return Q.denodeify(tmpfilecache.fetch.bind(tmpfilecache))(mp3audio_key, ifMissedGetFile).nodeify(callback);
    },
    
    /** Returns the spectrogram file of a given recording.
     * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     * @param {Object} recording.uri url containing the recording's path in the bucket.
     * @param {Function} callback(err, path) function to call back with the recording spectrogram file's path.
     */
    fetchSpectrogramFile: function (recording, callback) {
        var spectrogram_key = recording.uri.replace(fileExtPattern, '.png');
        tmpfilecache.fetch(spectrogram_key, function(cache_miss){
            Recordings.fetchRecordingFile(recording, function(err, recording_path){
                if(err) { callback(err); return; }
                audioTools.spectrogram(recording_path.path, cache_miss.file, {
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
        async.waterfall([
            function(next){
                if(!recording.sample_rate || !recording.duration){
                    Recordings.fetchInfo(recording, next);
                } else {
                    next(null, recording);
                }
            },
            function(rec_info,  next){
                recording = rec_info;
                Recordings.fetchSpectrogramFile(recording, next);
            },
            function(specFile, next){
                tyler(specFile.path, next);
                
                // TODO to enabled file deletion need to skip file creation if tiles exists
                // fs.unlink(filePath, function() {
                //     if(err) console.error('failed to deleted spectrogram file');
                // });
            },
            function(specTiles, next){
                
                var maxFreq = recording.sample_rate / 2;
                var pixels2Secs = recording.duration / specTiles.width ;
                var pixels2Hz = maxFreq / specTiles.height;
                
                
                async.map(specTiles.set, 
                    function(t, cb) {
                        
                        var h = t.y1-t.y0;
                        var w = t.x1-t.x0;
                        
                        cb(null, {
                            j : t.x ,  // x index
                            i : t.y ,  // y index
                            s  : t.x0 * pixels2Secs, // x origin in secs
                            hz : maxFreq - t.y0 * pixels2Hz, // y origin in hertz
                            ds : w * pixels2Secs, // tile duration
                            dhz : h * pixels2Hz, // tile bandwith
                            x : t.x0, // x origin
                            y : t.y0, // y origin
                            w : w,  // tile width
                            h : h   // tile height
                        });
                    },
                    function(err, tileSet) {
                        if(err) return next(err);
                        
                        recording.tiles = {
                            x : specTiles.x,
                            y : specTiles.y,
                            set: tileSet
                        };
                        next(null, recording);
                    }
                );
            }
        ], 
        callback);
    },
    
    fetchOneSpectrogramTile: function (recording, i, j, callback) {
        var tile_key = recording.uri.replace(fileExtPattern, '.tile_'+j+'_'+i+'.png');
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
     * @param {Function} callback(err, path) function to call back with the recording spectrogram file's path.
     */
    fetchThumbnailFile: function (recording, callback) {
        var thumbnail_key = recording.uri.replace(fileExtPattern, '.thumbnail.png');
        tmpfilecache.fetch(thumbnail_key, function(cache_miss){
            Recordings.fetchRecordingFile(recording, function(err, recording_path){
                if(err) { callback(err); return; }
                audioTools.spectrogram(recording_path.path, cache_miss.file, {
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
     * @param {String}  validation.class comma separated list of species-songtype pairs. ej: '7-1,3-2'
     * @param {Integer} validation.val   value used to validate the class in the given recording.
     * @param {Function} callback(err, path) function to call back with the validation result.
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
            if (valobj.val < 0 || valobj.val > 2) {
                callback(new Error("Invalid validation value " + valobj.val));
                return;
            }

            // 0 is not present , 1 is present and 2 is clear
            if (valobj.val == 2) {
                queryHandler(
                    "DELETE FROM `recording_validations` "+
                    " WHERE `recording_id` = "+mysql.escape(valobj.recording)+" and `project_id` = "+mysql.escape(valobj.project_id)+"  " +
                    " and `species_id` = "+mysql.escape(valobj.species)+" and `songtype_id` = "+mysql.escape(valobj.songtype)+" ",
                    function(err, data){
                    if (err) { callback(err); return; }
                    callback(null, valobj);
                });
            }
            else {
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
        
        async.map(classes, function(val_class, next){
            var validationClass = /(\d+)(-(\d+))?/.exec(val_class);
            if(!validationClass) {
                next(new Error("validation class is missing."));
            } 
            else if(!validationClass[2]){
                var project_class = validationClass[1] | 0;
                
                var q = "SELECT species_id, songtype_id \n"+
                        "FROM project_classes \n"+
                        "WHERE project_class_id = ? \n"+
                        "AND project_id = ?";
                
                queryHandler(mysql.format(q, [project_class, project_id]), function(err, rows){
                    if(err) return  next(err);
                    
                    if(!rows.length) { 
                        next(new Error("project class " + project_class + " not found")); 
                        return; 
                    }
                    
                    var validation = rows[0];
                    
                    add_one_validation(validation.species_id, validation.songtype_id, next);
                });
            } 
            else {
                add_one_validation(validationClass[1] | 0, validationClass[3] | 0, next);
            }
        }, callback);
        
    },
    
    insert: function(recording, callback) {
        
        var schema = {
            site_id:         joi.number().required(),
            uri:             joi.string().required(),
            datetime:        joi.date().required(),
            mic:             joi.string().required(),
            recorder:        joi.string().required(),
            version:         joi.string().required(),
            sample_rate:     joi.number(),
            precision:       joi.number(),
            duration:        joi.number(),
            samples:         joi.number(),
            file_size:       joi.number(),
            bit_rate:        joi.string(),
            sample_encoding: joi.string(),
            upload_time:     joi.date()
        };
        
        joi.validate(recording, schema, { stripUnknown: true }, function(err, rec) {
            if(err) return callback(err);
            
            var values = [];
        
            for( var j in rec) {
                values.push(util.format('%s = %s', 
                    mysql.escapeId(j), 
                    mysql.escape(rec[j])
                ));
            }
            
            var q = 'INSERT INTO recordings \n'+
                    'SET %s';
                    
            q = util.format(q, values.join(", "));
            queryHandler(q, callback);
        });
    },
    
    update: function(recording, callback) {
        
        if(recording.id) {
            recording.recording_id = recording.id;
        }
        
        var schema = {
            recording_id:    joi.number().required(),
            site_id:         joi.number(),
            uri:             joi.string(),
            datetime:        joi.date(),
            mic:             joi.string(),
            recorder:        joi.string(),
            version:         joi.string(),
            sample_rate:     joi.number(),
            precision:       joi.number(),
            duration:        joi.number(),
            samples:         joi.number(),
            file_size:       joi.number(),
            bit_rate:        joi.string(),
            sample_encoding: joi.string(),
            upload_time:     joi.date()
        };
        
        joi.validate(recording, schema, { stripUnknown: true }, function(err, rec) {
            if(err) return callback(err);
            
            var values = [];
        
            for( var j in rec) {
                if(j !== "recording_id") {
                    values.push(util.format('%s = %s', 
                        mysql.escapeId(j), 
                        mysql.escape(rec[j])
                    ));
                }
            }
            
            var q = 'UPDATE recordings \n'+
                    'SET %s \n'+
                    'WHERE recording_id = %s';
                    
            q = util.format(q, values.join(", "), rec.recording_id);
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
    
    recordingInfoGivenUri : function(uri, callback){
        var q = "SELECT r.`recording_id` AS id, \n " +
                "       date_format(r.`datetime`,'%m-%d-%Y %H:%i') as date, \n"+
                "       s.`name` site, \n"+
                "       r.`uri` \n" +
                "FROM `recordings` r\n"+
                "JOIN `sites` s ON s.`site_id` = r.`site_id`\n"+
                "WHERE r.`uri` = " + mysql.escape(uri);
        queryHandler(q, callback);
    },
    
    findProjectRecordings: function(params, callback) {
        console.log('params', params);
        function arrayOrSingle(x){
            return [x, joi.array().items(x)];
        }
        var schema = {
            project_id: joi.number().required(),
            range: joi.object().keys({
                from: joi.date(),
                to: joi.date()
            }).and('from', 'to'),
            sites:  arrayOrSingle(joi.string()),
            years:  arrayOrSingle(joi.number()),
            months: arrayOrSingle(joi.number()),
            days:   arrayOrSingle(joi.number()),
            hours:  arrayOrSingle(joi.number()),
            validations:  arrayOrSingle(joi.number()),
            presence:  joi.string().valid('absent', 'present'),
            classifications: arrayOrSingle(joi.number()),
            classification_results: arrayOrSingle(joi.object().keys({
                model: joi.number(),
                th: joi.number()
            }).optionalKeys('th')),
            limit:  joi.number(),
            offset: joi.number(),
            sortBy: joi.string(),
            sortRev: joi.boolean(), 
            output:  joi.string()
        };
        
        joi.validate(params, schema, function(err, parameters) {
            if(err) return callback(err);
            
            if(!parameters.output)
                parameters.output = 'list';
            
            var select = {
                list: "SELECT DISTINCT r.recording_id AS id, \n"+
                      "       SUBSTRING_INDEX(r.uri,'/',-1) as file, \n"+
                      "       s.name as site, \n"+
                      "       r.uri, \n"+
                      "       r.datetime, \n"+
                      "       r.mic, \n"+
                      "       r.recorder, \n"+
                      "       r.version, \n"+
                      "       s.project_id != %1$s as imported \n",
                      
                date_range: "SELECT DATE(MIN(r.datetime)) AS min_date, \n"+
                            "       DATE(MAX(r.datetime)) AS max_date \n",
                            
                count: "SELECT COUNT(DISTINCT r.recording_id) as count \n"
            };
            
            var q = select[parameters.output] +
                "FROM recordings AS r \n"+
                "JOIN sites AS s ON s.site_id = r.site_id \n"+
                "LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = %1$s\n";
                    
            if(parameters.validations) {
                q += "LEFT JOIN recording_validations as rv ON r.recording_id = rv.recording_id \n"+
                     "LEFT JOIN project_classes as pc ON pc.species_id = rv.species_id AND pc.songtype_id = rv.songtype_id \n";
            }
            
            if(parameters.classifications) {
                q += "LEFT JOIN classification_results as CR ON r.recording_id = CR.recording_id \n"+
                     "LEFT JOIN job_params_classification CRjp ON CRjp.job_id = CR.job_id \n"+
                     "LEFT JOIN models CRm ON CRjp.model_id = CRm.model_id \n";
            }
            
            q += "WHERE (s.project_id = %1$s \n"+
                 "OR pis.project_id = %1$s) \n";
                    
            q = sprintf(q, parameters.project_id);
            
            if(parameters.range) {
                console.log(parameters.range);
                q += 'AND r.datetime BETWEEN '+ mysql.escape(getUTC(parameters.range.from)) +
                    ' AND ' + mysql.escape(getUTC(parameters.range.to)) + ' \n';
            }
            
            if(parameters.sites) {
                q += 'AND s.name IN (' + mysql.escape(parameters.sites) + ') \n';
            }
            
            if(parameters.years) {
                q += 'AND YEAR(r.datetime) IN (' + mysql.escape(parameters.years) + ') \n';
            }
            
            if(parameters.months) {
                var months;
                
                if(parameters.months instanceof Array) {
                    months = parameters.months.map(function(m) { return parseInt(m)+1; });
                }
                else {
                    months = parseInt(parameters.months)+1;
                }
                
                q += 'AND MONTH(r.datetime) IN (' + mysql.escape(months) + ') \n';
            }
            
            if(parameters.days) {
                q += 'AND DAY(r.datetime) IN (' + mysql.escape(parameters.days) + ') \n';
            }
            
            if(parameters.hours) {
                q += 'AND HOUR(r.datetime) IN (' + mysql.escape(parameters.hours) + ') \n';
            }
            
            if(parameters.validations) {
                q += 'AND pc.project_class_id IN (' + mysql.escape(parameters.validations) + ') \n';
                
                if(parameters.presence) {
                    var flag = parameters.presence == 'present' ? '1' : '0';
                    q += 'AND rv.present = ' + flag + ' \n';
                }
            }
            
            if(parameters.classifications) {
                q += 'AND CR.job_id IN (' + mysql.escape(parameters.classifications) + ') \n';
                
                if(parameters.classification_results) {
                    if(!(parameters.classification_results instanceof Array)){
                        parameters.classification_results = [parameters.classification_results];
                    }
                    var crflag = {
                        'model':['CR.present = 0', 'CR.present = 1'], 
                        'th':['CR.max_vector_value < CRm.threshold', 'CR.max_vector_value >= CRm.threshold']
                    };
                    q += 'AND (('+ parameters.classification_results.map(function(cr){
                        return Object.keys(cr).map(function(crk){
                            return crflag[crk][1 * (!!cr[crk])];
                        }).join(' AND ');
                    }).join(') OR (') +')) \n';
                }
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
                typeCast: sqlutil.parseUtcDatetime,
            };
            queryHandler(query, callback);
        });
    },
    
    delete: function(recs, project_id, callback) {
        
        var recIds = recs.map(function(rec) {
            return rec.id;
        });
        
        var sqlFilterImported = 
            "SELECT r.recording_id AS id, \n"+
            "       r.uri \n"+
            "FROM recordings AS r  \n"+
            "JOIN sites AS s ON s.site_id = r.site_id  \n"+
            "WHERE r.recording_id IN (?) \n"+
            "AND s.project_id = ?";
        
        queryHandler(mysql.format(sqlFilterImported, [recIds, project_id]), function(err, rows) {
            
            if(!rows.length) {
                return callback(null, { 
                    deleted: [], 
                    msg: 'No recordings were deleted' 
                });
            }
            
            var deleted = [];
            
            async.eachSeries(rows, 
                function loop(rec, next) {
                    var ext = path.extname(rec.uri);
                    var thumbnailUri = rec.uri.replace(ext, '.thumbnail.png');
                    
                    var params = {
                        Bucket: config('aws').bucketName,
                        Delete: {
                            Objects: [
                                { Key: rec.uri },
                                { Key: thumbnailUri }
                            ],
                        }
                    };
                    
                    debug(params);
                    
                    s3.deleteObjects(params, function(err, data) {
                        if(err && err.code != 'NoSuchKey') {
                            return next(err);
                        }
                        
                        debug(data);
                        
                        var sqlDelete = "DELETE FROM recordings \n"+
                                        "WHERE recording_id = ?";
                        
                        queryHandler(mysql.format(sqlDelete, [rec.id]), function(err, results) {
                            if(err) next(err);
                            
                            deleted.push(rec.id);
                            next();
                        });
                    });
                }, 
                function done(err) {
                    if(err) {
                        if(!deleted.length) return callback(err);
                        
                        return callback(err, { 
                            deleted: deleted, 
                            msg: 'some recordings where deleted but an error ocurred'
                        });
                    }
                    
                    debug('recordings deleted:', deleted);
                    
                    var s = deleted.length > 1 ? 's' : '';
                    
                    callback(null, { 
                        deleted: deleted, 
                        msg: 'recording'+s+' deleted successfully' 
                    });
                }
            );
        });
    }
};

module.exports = Recordings;
    
