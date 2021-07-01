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
var joi   = require('joi');
var _     = require('lodash');
var sprintf = require("sprintf-js").sprintf;

var models = require("./index");

var config       = require('../config');
var SQLBuilder  = require('../utils/sqlbuilder');
var arrays_util  = require('../utils/arrays');
var tmpfilecache = require('../utils/tmpfilecache');
var audioTools   = require('../utils/audiotool');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
var tyler        = require('../utils/tyler.js');

const moment = require('moment');
const Projects = require('./projects');

// local variables
var s3, s3RFCx;
defineS3Clients();
var queryHandler = dbpool.queryHandler;


var getUTC = function (date) {
    var d = new Date(date);
    d.setTime(d.getTime() + (d.getTimezoneOffset() * 60000));
    return d;
};

var fileExtPattern = /\.(wav|flac|opus)$/;
var freqFilterPrecision = 100;

function defineS3Clients () {
    if (!s3) {
        s3 = new AWS.S3(getS3ClientConfig('aws'))
    }
    if (!s3RFCx) {
        s3RFCx = new AWS.S3(getS3ClientConfig('aws-rfcx'))
    }
}

function getS3ClientConfig (type) {
    return {
        accessKeyId: config(type).accessKeyId,
        secretAccessKey: config(type).secretAccessKey,
        region: config(type).region
    }
}

function arrayOrSingle(x){
    return joi.alternatives(x, joi.array().items(x));
}


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
                return subject + ' = ' + dbpool.escape(query['=']);
            } else if (query.IN) {
                return subject + ' IN (' + dbpool.escape(query.IN) + ')';
            } else if (query.BETWEEN) {
                return subject + ' BETWEEN ' + dbpool.escape(query.BETWEEN[0]) + ' AND ' + dbpool.escape(query.BETWEEN[1]);
            }
        }
        return undefined;
    },

    findById: function(recId, callback) {
        var q = "SELECT * \n"+
                "FROM recordings \n"+
                "WHERE recording_id = ?";

        q = dbpool.format(q, [recId]);
        queryHandler(q, callback);
    },

    findByIdAsync: function(recId) {
        let find = util.promisify(this.findById)
        return find(recId)
    },

    getPrevAndNextRecordingsAsync: function (recording_id) {
        var selection = "R.recording_id AS id, \n"+
            "SUBSTRING_INDEX(R.uri,'/',-1) as file, \n"+
            "S.name as site, \n"+
            "S.site_id, \n"+
            "S.timezone, \n"+
            "R.uri, \n"+
            "R.datetime, \n"+
            "R.datetime_utc, \n"+
            "R.datetime_local, \n"+
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
        return this.findByIdAsync(recording_id)
            .then((recordings) => {
                const recording = recordings[0]
                if (!recording) {
                    return [[], []];
                } else {
                    const base = `SELECT ${selection} FROM recordings R JOIN sites S ON S.site_id = ? WHERE R.site_id = ?`
                    const replacements = [recording.site_id, recording.site_id, recording.datetime, recording.recording_id];
                    const proms = [
                        dbpool.query({ sql: `${base} AND datetime <= ? AND recording_id != ? ORDER BY datetime DESC LIMIT 5`, typeCast: sqlutil.parseUtcDatetime }, replacements),
                        dbpool.query({ sql: `${base}  AND datetime = ? AND recording_id = ?`, typeCast: sqlutil.parseUtcDatetime }, replacements),
                        dbpool.query({ sql:`${base} AND datetime >= ? AND recording_id != ? ORDER BY datetime ASC LIMIT 4`, typeCast: sqlutil.parseUtcDatetime }, replacements),
                    ]
                    return Q.all(proms);
                }
            }).then((data) => {
                return arrays_util.compute_row_properties(data.reduce((arr1, arr2) => [...arr1, ...arr2], []), 'thumbnail-path', function(property){
                    return Recordings['__compute_' + property.replace(/-/g,'_')];
                });
            })
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
                        "SUBSTRING_INDEX(R.uri,'/',-1) as file, R.meta, \n"+
                        "S.name as site, \n"+
                        "S.timezone, \n"+
                        "R.uri, \n"+
                        "R.datetime, \n"+
                        "R.datetime_utc, \n"+
                        "R.datetime_local, \n"+
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
        var constraints, data=[];
        var steps=[];

        return this.parseUrlQuery(recording_url).then(function(urlquery){
            if(urlquery.special){
                limit_clause = " LIMIT 1";
                order_clause = " ORDER BY S.name ASC, R.datetime " + (urlquery.special == 'first' ? 'ASC' : 'DESC');
            }

            constraints = sqlutil.compile_query_constraints(urlquery, fields);
            if (urlquery && urlquery.site) {
                constraints.shift()
                data.push(urlquery.site['='])
                constraints.push('S.name = ?');
            }
            group_by = sqlutil.compute_groupby_constraints(urlquery, fields, options.group_by, {
                count_only : options.count_only
            });

            if (options.recording_id) {
                constraints.push('R.`recording_id` = ' + dbpool.escape(Number(options.recording_id)));
            }

            if(!urlquery.id) {
                steps.push(
                    dbpool.query("(\n" +
                "   SELECT site_id FROM sites WHERE project_id = ?\n" +
                "   ) UNION (\n" +
                "   SELECT site_id FROM project_imported_sites WHERE project_id = ?\n" +
                ")", [project_id, project_id])
                    .then(function(sites){
                        constraints.push("S.site_id IN (?)");
                        data.push(sites.length ? sites.map(function(site){
                            return site.site_id;
                        }) : [0]);
                }));
            }
        }).then(function(){
            return Q.all(steps);
        }).then(function(){
            return Q.nfcall(queryHandler, {
                sql:
                    "SELECT " + group_by.project_part + projection + " \n" +
                    "FROM recordings R \n" +
                    "JOIN sites S ON S.site_id = R.site_id \n" +
                    "WHERE (" + constraints.join(") AND (") + ")" +
                    group_by.clause +
                    order_clause +
                    limit_clause,
                typeCast: sqlutil.parseUtcDatetime,
            }, data);
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
                    data.forEach((d) => {
                        d.legacy = Recordings.isLegacy(d);
                        d.meta = d.meta ? Recordings.__parse_meta_data(d.meta) : null;
                        d.file = d.meta && d.meta.filename? d.meta.filename : d.file;
                    })
                    return data;
                }
            }
        }).nodeify(callback);
    },
    findByRecordingId: function (recording_id, callback) {
        const query = 'SELECT uri, sample_rate, duration FROM recordings WHERE recording_id = '
            + dbpool.escape(recording_id) + ' LIMIT 1';
        return queryHandler(query, function(err, rows) {
            if (err) { callback(err); return; }
            if (!rows || !rows.length) { callback(undefined, null); return; }
            callback(undefined, rows[0]);
        });
    },

    fetchNext: function (recording, callback) {
        var query = "SELECT R2.recording_id as id\n" +
            "FROM recordings R \n" +
            "JOIN recordings R2 ON " +
                "R.site_id = R2.site_id " +
                "AND R.datetime < R2.datetime \n" +
            "WHERE R.recording_id = " + dbpool.escape(recording.id) + "\n" +
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
            "WHERE R.recording_id = " + dbpool.escape(recording.id) + "\n" +
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
        var query = "SELECT recording_validation_id as id, user_id as user, species_id as species, songtype_id as songtype, present, present_review as presentReview \n" +
            "FROM recording_validations \n" +
            "WHERE recording_id = " + dbpool.escape(recording.id);
        return queryHandler(query, callback);
    },

    getSiteModel: async function(recording) {
        if (!recording.site_id) {
            let recs = await this.findByIdAsync(recording.id)
            recording.site_id = recs[0].site_id
        }
        let sites = await models.sites.findByIdAsync(recording.site_id)
        if (sites && sites.length) {
            var site = sites[0]
        }
        return site
    },

    /**
     * Checks whether recording belongs to Arbimon (legacy) or RFCx platform
     * Arbimon-based recordings are uploaded into buckets with similar naming (e.g. project_123, project_3, etc...)
     * @param {*} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     */
    isLegacy: function(recording) {
        return recording.uri.startsWith('project_')
    },

    /** Downloads a recording from the bucket, storing it in a temporary file cache, and returns its path.
     * @param {Object} recording object containing the recording's data, like the ones returned in findByUrlMatch.
     * @param {Object} recording.uri url containing the recording's path in the bucket.
     * @param {Function} callback(err, path) function to call back with the recording's path.
     */
    fetchRecordingFile: async function(recording, callback){
        tmpfilecache.fetch(recording.uri, async (cache_miss) => {
            debug('fetching ', recording.uri, ' from the bucket.');
            if(!s3 || !s3RFCx){
                defineS3Clients()
            }
            const legacy = this.isLegacy(recording)
            let s3Client = legacy? s3 : s3RFCx
            const opts = {
                Bucket : config(legacy? 'aws' : 'aws-rfcx').bucketName,
                Key    : recording.uri
            }
            s3Client.getObject(opts, function(err, data){
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
     * @param {Object} options.trim.from offset to start the audio from.
     * @param {Object} options.trim.to offset to end the audio at.
     * @param {Object} options.trim.duration audio duration (overrides options.trim.to).
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

            if(options.trim){
                var from = ((+options.trim.from * 1000) | 0) / 1000;
                var to = ((+options.trim.to * 1000) | 0) / 1000;
                var duration = options.trim.duration ? (+options.trim.duration) : (((to - from) * 1000) | 0) / 1000;

                mods.push({
                    ext:'from-' + from + '-len-' + duration,
                    args:{ trim: {from: from, duration: duration} }
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
                    height    : config("spectrograms").spectrograms.height,
                    ...recording.uri.endsWith('.opus') && recording.sample_rate && { maxfreq: recording.sample_rate * 2 },
                    ...recording.contrast && { contrast: recording.contrast }
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
                recording.contrast = 105;
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
                    " WHERE `recording_id` = "+dbpool.escape(valobj.recording)+" and `project_id` = "+dbpool.escape(valobj.project_id)+"  " +
                    " and `species_id` = "+dbpool.escape(valobj.species)+" and `songtype_id` = "+dbpool.escape(valobj.songtype)+" ",
                    function(err, data){
                    if (err) { callback(err); return; }
                    callback(null, valobj);
                });
            }
            else {
                queryHandler(
                    "INSERT INTO recording_validations(recording_id, user_id, species_id, songtype_id, present, project_id, present_review) \n" +
                    " VALUES (" + dbpool.escape([valobj.recording, valobj.user, valobj.species, valobj.songtype, valobj.val, valobj.project_id, 1]) + ") \n" +
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

                queryHandler(dbpool.format(q, [project_class, project_id]), function(err, rows){
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

    calculateLocalTime: function(site_id, datetime, callback) {
        const datetimeFormatted = moment.utc(datetime).format('YYYY-MM-DD HH:mm:ss');
        let q = `SELECT CONVERT_TZ('${datetimeFormatted}','UTC',S.timezone) as datetime_local FROM sites S WHERE S.site_id=${site_id}`;
        queryHandler(q, function(err, rows) {
            if (err) return callback(err);
            if (rows.length) callback(null, rows[0].datetime_local);
        });
    },

    calculateLocalTimeAsync: function(site_id, datetime) {
        let calculateLocalTime = util.promisify(this.calculateLocalTime)
        return calculateLocalTime(site_id, datetime)
    },

    insert: function(recording, callback) {

        var schema = {
            site_id:         joi.number().required(),
            uri:             joi.string().required(),
            datetime:        joi.date().required(),
            mic:             joi.optional(),
            recorder:        joi.optional(),
            version:         joi.optional(),
            sample_rate:     joi.number(),
            precision:       joi.number(),
            duration:        joi.number(),
            samples:         joi.number(),
            file_size:       joi.number(),
            bit_rate:        joi.string(),
            sample_encoding: joi.string(),
            upload_time:     joi.date(),
            datetime_local:  joi.date(),
            datetime_utc:    joi.date(),
            meta:  joi.optional(),
        };

        joi.validate(recording, schema, { stripUnknown: true }, function(err, rec) {
            if(err) return callback(err);

            queryHandler('INSERT INTO recordings (\n' +
                '`site_id`, `uri`, `datetime`, `mic`, `recorder`, `version`, `sample_rate`, \n'+
                '`precision`, `duration`, `samples`, `file_size`, `bit_rate`, `sample_encoding`, `upload_time`, `datetime_local`, `datetime_utc`, `meta`\n' +
            ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [
                rec.site_id, rec.uri, rec.datetime, rec.mic || '(not specified)', rec.recorder || '(not specified)', rec.version || '(not specified)', rec.sample_rate,
                rec.precision, rec.duration, rec.samples, rec.file_size, rec.bit_rate, rec.sample_encoding, rec.upload_time, rec.datetime_local, rec.datetime_utc, rec.meta
            ], callback);
        });
    },

    insertAsync: function(recording) {
        let insert = util.promisify(this.insert)
        return insert(recording)
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
                        dbpool.escapeId(j),
                        dbpool.escape(rec[j])
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

        var uri = dbpool.escape('%' + recording.filename + '%');
        var site_id = dbpool.escape(Number(recording.site_id));
        q = util.format(q, site_id, uri);

        return dbpool.query(q).then(function(rows){
            return rows[0].count > 0;
        }).nodeify(callback);
    },

    existsAsync: function(recording) {
        let exists = util.promisify(this.exists)
        return exists(recording)
    },

    __parse_comments_data : function(data) {
        try {
            const parsedData = JSON.parse(data);
            let comment = '';
            const regArtist = /AudioMoth (\w+)/.exec(parsedData && parsedData.ARTIST? parsedData.ARTIST : parsedData.artist);
            const regArtistFromComment = /by AudioMoth (.*?) at gain/.exec(data);
            comment += regArtist && regArtist[1] ? regArtist[1] : regArtistFromComment && regArtistFromComment[1] ? regArtistFromComment[1] : '';
            const regGain = /at (\w+) gain/.exec(data);
            const regGainFromComment = /at gain setting (\w+) while/.exec(data);
            comment += regGain && regGain[1] ? ` / ${regGain[1]} gain` : regGainFromComment && regGainFromComment[1] ? ` / ${regGainFromComment[1]} gain` : '';
            const regState = /state was (.*?) and/.exec(data);
            const regStateFromComment = /state was (.*?).","/.exec(data);
            comment += regState && regState[1] ? ` / ${regState[1]}` : regStateFromComment && regStateFromComment[1] ? ` / ${regStateFromComment[1]}` : '';
            const regTemperature = /temperature was (.*?).","/.exec(data);
            comment += regTemperature && regTemperature[1] ? ` / ${regTemperature[1]}` : '';
            return comment;
        } catch (e) {
            return null
        }
    },
    __parse_meta_data : function(data) {
        try {
            const parsedData = JSON.parse(data);
            if (!parsedData) {
                return data;
            }
            return parsedData;
        } catch (e) {
            return null;
        }
    },
    __compute_thumbnail_path : async function(recording, callback){
        await Recordings.__compute_thumbnail_path_async(recording)
        callback();
    },
    __compute_thumbnail_path_async : async function(recording){
        if (recording.site_id && recording.site_external_id !== undefined) {
            var site = {
                site_id: recording.site_id,
                external_id: recording.site_external_id
            }
        }
        else {
            var site = await Recordings.getSiteModel(recording)
        }
        const legacy = this.isLegacy(recording)
        if (legacy) {
            recording.thumbnail = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + encodeURIComponent(recording.uri.replace(/\.([^.]*)$/, '.thumbnail.png'));
        }
        else {
            const momentStart = moment.utc(recording.datetime_utc ? recording.datetime_utc : recording.datetime)
            const momentEnd = momentStart.clone().add(recording.duration, 'seconds')
            const dateFormat = 'YYYYMMDDTHHmmssSSS'
            const start = momentStart.format(dateFormat)
            const end = momentEnd.format(dateFormat)
            recording.thumbnail = `/api/ingest/recordings/${site.external_id}_t${start}Z.${end}Z_z95_wdolph_g1_fspec_mtrue_d420.154.png`
        }
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
                "WHERE r.`uri` = " + dbpool.escape(uri);
        queryHandler(q, callback);
    },

    /** finds a set of recordings given some search criteria.
     * @param {Object} params - search parameters
     * @param {Function} callback - callback function (optional)
     * @return {Promise} resolving to the recordings mathing the given search parameters.
     */
    findProjectRecordings: function(params, callback) {
        var schema = Recordings.SCHEMAS.searchFilters;

        return Q.ninvoke(joi, 'validate', params, schema).then(function (parameters) {
            return dbpool.query("SELECT s.* FROM sites s WHERE s.project_id = ?\n" +
                "OR s.site_id in (\n" +
                "   SELECT pis.site_id FROM project_imported_sites pis WHERE pis.project_id = ?\n" +
                ")", [parameters.project_id, parameters.project_id])
                .then(function (sites) {
                    parameters.siteData = {};
                    for (const s of sites) {
                        parameters.siteData[s.site_id] = s;
                    }
                    return parameters
                })
        }).then(function (parameters) {
            var siteData = parameters.siteData
            var outputs = parameters.output instanceof Array ? parameters.output : [parameters.output];
            var sqlOnly = outputs.length === 2 && outputs[0] === 'list' && outputs[1] === 'sql'

            var projection=[];
            var steps=[];

            var select_clause = {
                list: "SELECT r.recording_id AS id, \n"+
                      "       SUBSTRING_INDEX(r.uri,'/',-1) as file, \n"+
                      "       r.uri, \n"+
                      "       r.datetime, \n"+
                      "       r.datetime_utc, \n"+
                      "       r.upload_time, \n"+
                      "       r.duration, \n"+
                      "       r.mic, \n"+
                      "       r.recorder, \n"+
                      "       r.version, \n"+
                      "       r.sample_rate, \n"+
                      "       r.meta, \n"+
                      "       r.site_id \n",

                date_range: "SELECT MIN(r.datetime) AS min_date, \n"+
                            "       MAX(r.datetime) AS max_date \n",

                count: "SELECT COUNT(r.recording_id) as count \n"
            };

            var tables = [
                "recordings AS r"
            ];
            var constraints = [];
            var data = [];

            const siteIds = Object.values(siteData).map(function(site){
                return site.site_id;
            })
            if (siteIds.length) {
                constraints.push("r.site_id IN (?)");
                data.push(siteIds);
            } else {
                constraints.push('1 = 2')
            }

            if(parameters.range) {
                constraints.push('r.datetime BETWEEN ? AND ?');
                data.push(getUTC(parameters.range.from), getUTC(parameters.range.to));
            }

            if (parameters.sites) {
                tables.push("JOIN sites AS s ON s.site_id = r.site_id");
                constraints.push('s.name IN (?)');
                data.push(parameters.sites);
            }

            if(parameters.years) {
                constraints.push('YEAR(r.datetime) IN (?)');
                data.push(parameters.years);
            }

            if(parameters.months) {
                constraints.push('MONTH(r.datetime) IN (?)');
                data.push((parameters.months instanceof Array) ?
                    parameters.months.map(function(m) { return parseInt(m)+1; }) :
                    parseInt(parameters.months)+1
                );
            }

            if(parameters.days) {
                constraints.push('DAY(r.datetime) IN (?)');
                data.push(parameters.days);
            }

            if(parameters.hours) {
                constraints.push('HOUR(r.datetime) IN (?)');
                data.push(parameters.hours);
            }

            if(parameters.validations) {
                tables.push(
                    "LEFT JOIN recording_validations as rv ON r.recording_id = rv.recording_id",
                    "LEFT JOIN project_classes as pc ON pc.species_id = rv.species_id AND pc.songtype_id = rv.songtype_id"
                );
                constraints.push('pc.project_class_id IN (?)');
                data.push(parameters.validations);

                if(parameters.presence && !(parameters.presence instanceof Array && parameters.presence.length >= 2)){
                    constraints.push('rv.present = ?');
                    data.push(parameters.presence == 'present' ? '1' : '0');
                }
            }

            if(parameters.soundscape_composition) {
                tables.push(
                    "LEFT JOIN recording_soundscape_composition_annotations as RSCA ON r.recording_id = RSCA.recordingId"
                );
                constraints.push('RSCA.scclassId IN (?)');
                data.push(parameters.soundscape_composition);

                if(parameters.soundscape_composition_annotation && !(parameters.soundscape_composition_annotation instanceof Array && parameters.soundscape_composition_annotation.length >= 2)){
                    constraints.push('RSCA.present = ?');
                    data.push(parameters.soundscape_composition_annotation == 'present' ? '1' : '0');
                }
            }

            if(parameters.tags) {
                tables.push(
                    "LEFT JOIN recording_tags as RT ON r.recording_id = RT.recording_id"
                );
                constraints.push('RT.tag_id IN (?)');
                data.push(parameters.tags);
            }
            if(parameters.playlists) {
                tables.push(
                    "LEFT JOIN playlist_recordings as PR ON r.recording_id = PR.recording_id"
                );
                constraints.push('PR.playlist_id IN (?)');
                data.push(parameters.playlists);
            }
            if(parameters.classifications) {
                tables.push(
                    "LEFT JOIN classification_results as CR ON r.recording_id = CR.recording_id",
                    "LEFT JOIN job_params_classification CRjp ON CRjp.job_id = CR.job_id",
                    "LEFT JOIN models CRm ON CRjp.model_id = CRm.model_id"
                );
                constraints.push('CR.job_id IN (?)');
                data.push(parameters.classifications);

                if(parameters.classification_results) {
                    if(!(parameters.classification_results instanceof Array)){
                        parameters.classification_results = [parameters.classification_results];
                    }
                    var crflag = {
                        'model':['CR.present = 0', 'CR.present = 1'],
                        'th':['CR.max_vector_value < CRm.threshold', 'CR.max_vector_value >= CRm.threshold']
                    };
                    constraints.push(
                        '(('+ parameters.classification_results.map(function(cr){
                            return Object.keys(cr).map(function(crk){
                                return crflag[crk][1 * (!!cr[crk])];
                            }).join(' AND ');
                        }).join(') OR (') +'))'
                    );
                }
            }

            return Q.all(steps).then(function(){

                var from_clause  = "FROM " + tables.join('\n');
                var where_clause = dbpool.format("WHERE " + constraints.join('\n AND '), data);
                var order_clause = 'ORDER BY ' + dbpool.escapeId(parameters.sortBy || 'datetime') + ' ' + (parameters.sortRev ? 'DESC' : '');
                var limit_clause = (parameters.limit) ? dbpool.escape(parameters.offset || 0) + ', ' + dbpool.escape(parameters.limit) : '';

                if (sqlOnly) {
                    return [select_clause.list, from_clause, where_clause]
                }

                return Q.all(outputs.map(function(output){
                    var query=[
                        select_clause[output],
                        from_clause,
                        where_clause
                    ];
                    if(output === 'list') {
                        var sortBy = parameters.sortBy || 'datetime';
                        var sortRev = parameters.sortRev ? 'DESC' : '';
                        query.push('ORDER BY ' + sortBy + ' ' + sortRev);
                        if(limit_clause){
                            query.push("LIMIT " + limit_clause);
                        }
                    }
                    return Q.nfcall(queryHandler, {
                        sql: query.join('\n'),
                        typeCast: sqlutil.parseUtcDatetime,
                    });
                }));
            }).then(function (results) {
                if (sqlOnly) {
                    return results
                }
                results = outputs.reduce(function(obj, output, i){
                    var r = results[i][0];
                    if(output == "count"){
                        r = r[0].count;
                    } else if(output == 'list'){
                        for (let _1 of r) {
                            // Previously part of the query but now merged after
                            _1.site = siteData[_1.site_id].name;
                            _1.legacy = Recordings.isLegacy(_1)
                            _1.site_external_id = siteData[_1.site_id].external_id;
                            _1.timezone = siteData[_1.site_id].timezone;
                            _1.imported = siteData[_1.site_id].project_id !== parameters.project_id;
                            _1.comments = _1.meta ? Recordings.__parse_comments_data(_1.meta) : null;
                            if (_1.comments && _1.recorder === "Unknown") {
                                _1.recorder = "AudioMoth";
                            }
                            _1.meta = _1.meta ? Recordings.__parse_meta_data(_1.meta) : null;
                            _1.filename = _1.meta? (_1.meta.filename? _1.meta.filename : 'Unknown') : null;
                            Recordings.__compute_thumbnail_path_async(_1);
                            if (!_1.legacy) {
                                _1.file = `${moment.utc(_1.datetime).format('YYYYMMDD_HHmmss')}${path.extname(_1.file)}`;
                            }
                        }
                    } else {
                        r = r[0];
                    }
                    obj[output] = r;
                    return obj;
                }, {});
                if(outputs.length > 1){
                    return results;
                } else {
                    return results[outputs[0]];
                }
            });
        }).nodeify(callback);
    },

    SCHEMAS:{
        searchFilters : {
            project_id: joi.number().required(),
            range: joi.object().keys({
                from: joi.date(),
                to: joi.date()
            }).and('from', 'to'),
            sites:  arrayOrSingle(joi.string()),
            imported: joi.boolean(),
            years:  arrayOrSingle(joi.number()),
            months: arrayOrSingle(joi.number()),
            days:   arrayOrSingle(joi.number()),
            hours:  arrayOrSingle(joi.number()),
            validations:  arrayOrSingle(joi.number()),
            presence:  arrayOrSingle(joi.string().valid('absent', 'present')),
            soundscape_composition:  arrayOrSingle(joi.number()),
            soundscape_composition_annotation:  arrayOrSingle(joi.string().valid('absent', 'present')),
            tags: arrayOrSingle(joi.number()),
            playlists: arrayOrSingle(joi.number()),
            classifications: arrayOrSingle(joi.number()),
            classification_results: arrayOrSingle(joi.object().keys({
                model: joi.number(),
                th: joi.number()
            }).optionalKeys('th')),
            limit:  joi.number(),
            offset: joi.number(),
            sortBy: joi.string(),
            sortRev: joi.boolean(),
            output:  arrayOrSingle(joi.string().valid('count','list','date_range','sql')).default('list')
        },
        exportProjections: {
            recording:arrayOrSingle(joi.string().valid(
                'filename', 'site', 'time', 'recorder', 'microphone', 'software'
            )),
            validation:  arrayOrSingle(joi.number()),
            classification:  arrayOrSingle(joi.number()),
            soundscapeComposition:  arrayOrSingle(joi.number()),
            tag:  arrayOrSingle(joi.number()),
        }
    },

    buildSearchQuery: function(searchParameters){
        var builder = new SQLBuilder();
        return Q.ninvoke(joi, 'validate', searchParameters, Recordings.SCHEMAS.searchFilters).then(function(parameters){
            var outputs = parameters.output instanceof Array ? parameters.output : [parameters.output];

            var projection=[];

            builder.addTable("recordings", "r");
            builder.addTable("JOIN sites", "s", "s.site_id = r.site_id");
            builder.addTable("LEFT JOIN project_imported_sites", "pis", "s.site_id = pis.site_id AND pis.project_id = ?", parameters.project_id);

            builder.addConstraint("(s.project_id = ? OR pis.project_id = ?)",[
                parameters.project_id,
                parameters.project_id
            ]);

            if(parameters.range) {
                builder.addConstraint('r.datetime BETWEEN ? AND ?',[
                    getUTC(parameters.range.from), getUTC(parameters.range.to)
                ]);
            }

            if(parameters.sites) {
                builder.addConstraint('s.name IN (?)', [parameters.sites]);
            }

            if(parameters.imported !== undefined){
                builder.addConstraint(
                    parameters.imported ?
                    'pis.site_id IS NOT NULL' :
                    'pis.site_id IS NULL'
                );
            }

            if(parameters.years) {
                builder.addConstraint('YEAR(r.datetime) IN (?)', [parameters.years]);
            }

            if(parameters.months) {
                builder.addConstraint('MONTH(r.datetime) IN (?)', [
                    (parameters.months instanceof Array) ?
                        parameters.months.map(function(m) { return parseInt(m)+1; }) :
                        parseInt(parameters.months)+1
                ]);
            }

            if(parameters.days) {
                builder.addConstraint('DAY(r.datetime) IN (?)', [parameters.days]);
            }

            if(parameters.hours) {
                builder.addConstraint('HOUR(r.datetime) IN (?)', [parameters.hours]);
            }

            if(parameters.validations) {
                builder.addTable("LEFT JOIN recording_validations", "rv", "r.recording_id = rv.recording_id");
                builder.addTable("LEFT JOIN project_classes", "pc", "pc.species_id = rv.species_id AND pc.songtype_id = rv.songtype_id");

                builder.addConstraint('pc.project_class_id IN (?)', [parameters.validations]);

                if(parameters.presence && !(parameters.presence instanceof Array && parameters.presence.length >= 2)){
                    builder.addConstraint('rv.present = ?', [parameters.presence == 'present' ? '1' : '0']);
                }
            }

            if(parameters.soundscape_composition) {
                builder.addTable("LEFT JOIN recording_soundscape_composition_annotations", "RSCA", "r.recording_id = RSCA.recordingId");
                builder.addConstraint('RSCA.scclassId IN (?)', [parameters.soundscape_composition]);

                if(parameters.soundscape_composition_annotation && !(parameters.soundscape_composition_annotation instanceof Array && parameters.soundscape_composition_annotation.length >= 2)){
                    builder.addConstraint('RSCA.present = ?', [parameters.soundscape_composition_annotation == 'present' ? '1' : '0']);
                }
            }

            if(parameters.tags) {
                builder.addTable("LEFT JOIN recording_tags", "RT", "r.recording_id = RT.recording_id");
                builder.addConstraint('RT.tag_id IN (?)', [parameters.tags]);
            }
            if(parameters.playlists) {
                builder.addTable("LEFT JOIN playlist_recordings", "PR", "r.recording_id = PR.recording_id");
                builder.addConstraint('PR.playlist_id IN (?)', [parameters.playlists]);
            }

            if(parameters.classifications) {
                builder.addTable("LEFT JOIN classification_results", "CR", "r.recording_id = CR.recording_id");
                builder.addTable("LEFT JOIN job_params_classification", "CRjp", "CRjp.job_id = CR.job_id");
                builder.addTable("LEFT JOIN models", "CRm", "CRjp.model_id = CRm.model_id");
                builder.addConstraint('CR.job_id IN (?)', [parameters.classifications]);

                if(parameters.classification_results) {
                    if(!(parameters.classification_results instanceof Array)){
                        parameters.classification_results = [parameters.classification_results];
                    }
                    var crflag = {
                        'model':['CR.present = 0', 'CR.present = 1'],
                        'th':['CR.max_vector_value < CRm.threshold', 'CR.max_vector_value >= CRm.threshold']
                    };
                    builder.addConstraint(
                        '(('+ parameters.classification_results.map(function(cr){
                            return Object.keys(cr).map(function(crk){
                                return crflag[crk][1 * (!!cr[crk])];
                            }).join(' AND ');
                        }).join(') OR (') +'))'
                    );
                }
            }

            builder.setOrderBy(parameters.sortBy || 'site', !parameters.sortRev);

            if(parameters.limit){
                builder.setLimit(parameters.offset || 0, parameters.limit);
            }

            return builder;
        });
    },

    exportRecordingData: function(projection, filters){
        var builder;

        return Q.all([
            this.buildSearchQuery(filters),
            Q.ninvoke(joi, 'validate', projection, Recordings.SCHEMAS.exportProjections)
        ]).then(function(all){
            builder = all[0];
            var projection_parameters = all[1];
            var promises=[];

            if(projection_parameters.recording){
                var recParamMap = {
                    'filename' : "SUBSTRING_INDEX(r.uri,'/',-1) as filename",
                    'site' : 's.name as site',
                    'time' : 'DATE_FORMAT(r.datetime, "%Y/%m/%d %T") as time',
                    'recorder' : 'r.recorder',
                    'microphone' : 'r.mic as microphone',
                    'software' : 'r.version as software',
                };
                builder.addProjection.apply(builder, projection_parameters.recording.map(function(recParam){
                    console.log("recParam", recParam, recParamMap[recParam]);
                    return recParamMap[recParam];
                }));
                builder.addProjection('r.meta');
            }

            if(projection_parameters.validation){
                promises.push(models.projects.getProjectClasses(null,null,{noProject:true, ids:projection_parameters.validation}).then(function(classes){
                    classes.forEach(function(cls, idx){
                        var clsid = "p_PVAL_" + idx;
                        builder.addTable("LEFT JOIN recording_validations", clsid,
                            "r.recording_id = " + clsid + ".recording_id " +
                            "AND " + clsid + ".songtype_id = ? " +
                            "AND " + clsid + ".species_id = ? " +
                            "AND " + clsid + ".project_id = ? ", [
                            cls.songtype,
                            cls.species,
                            cls.project,
                        ]);
                        builder.addProjection("IF(ISNULL("+clsid+".present), '---', "+clsid+".present)  AS " + dbpool.escapeId("val<" + cls.species_name + "/" + cls.songtype_name + ">"));
                    });
                }));
            }
            if(projection_parameters.classification){
                promises.push(models.classifications.getFor({id:projection_parameters.classification, showModel:true}).then(function(classifications){
                    classifications.forEach(function(classification, idx){
                        var clsid = "p_CR_" + idx;
                        builder.addTable("LEFT JOIN classification_results", clsid,
                            "r.recording_id = " + clsid + ".recording_id " +
                            "AND " + clsid + ".job_id = ?", [
                            classification.job_id
                        ]);
                        builder.addProjection("IF(ISNULL("+clsid+".present), '---', "+clsid+".present)  AS " + dbpool.escapeId("cr<" + classification.cname + ">"));
                        if(classification.threshold){
                            builder.addProjection("IF(ISNULL("+clsid+".max_vector_value), '---', "+clsid+".max_vector_value > " + dbpool.escape(classification.threshold) + ")  AS " + dbpool.escapeId("cr<" + classification.cname + "> threshold (" + String(classification.threshold).replace('.',',') + ")"));
                        }
                    });
                }));
            }
            if(projection_parameters.soundscapeComposition){
                promises.push(models.SoundscapeComposition.getClassesFor({id:projection_parameters.soundscapeComposition}).then(function(classes){
                    classes.forEach(function(cls, idx){
                        var clsid = "p_SCC_" + idx;
                        builder.addTable("LEFT JOIN recording_soundscape_composition_annotations", clsid,
                            "r.recording_id = " + clsid + ".recordingId " +
                            "AND " + clsid + ".scclassId = ?", [
                            cls.id
                        ]);
                        builder.addProjection("IF(ISNULL("+clsid+".present), '---', "+clsid+".present)  AS " + dbpool.escapeId("scc<" + cls.type + "/" + cls.name + ">"));
                    });
                }));
            }
            if(projection_parameters.tag){
                promises.push(models.tags.getFor({id:projection_parameters.tag}).then(function(tags){
                    tags.forEach(function(tag, idx){
                        var prtid = "p_RT_" + idx;
                        builder.addProjection("(SELECT COUNT(*) FROM recording_tags AS " + prtid + " WHERE r.recording_id = " + prtid + ".recording_id AND " + prtid + ".tag_id = " + dbpool.escape(tag.id)+ "  ) AS " + dbpool.escapeId("tag<" + tag.tag + ">"));
                    });
                }));
            }

            return Q.all(promises);
        }).then(function(){
            return dbpool.streamQuery({
                sql: builder.getSQL(),
                typeCast: sqlutil.parseUtcDatetime,
            });
        });
    },


    /* fetch count of project recordings.
    */
    countProjectRecordings: function(filters){
        return this.buildSearchQuery(filters).then(function(builder){
            builder.addProjection.apply(builder, [
                's.site_id', 's.name as site', 'pis.site_id IS NOT NULL as imported',
                'COUNT(*) as count'
            ]);
            delete builder.orderBy;
            builder.setGroupBy('s.site_id');
            return dbpool.query(builder.getSQL());
        });
    },

    /* fetch count of project recordings.
    */
    deleteMatching: function(filters, project_id){
        return this.buildSearchQuery(filters).then(function(builder){
            builder.addProjection.apply(builder, [
                'r.recording_id as id'
            ]);
            delete builder.orderBy;

            return dbpool.query(builder.getSQL()).then(function(rows){
                return Q.ninvoke(Recordings, 'delete', rows, project_id);
            });
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

        queryHandler(dbpool.format(sqlFilterImported, [recIds, project_id]), function(err, rows) {

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

                        queryHandler(dbpool.format(sqlDelete, [rec.id]), function(err, results) {
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
