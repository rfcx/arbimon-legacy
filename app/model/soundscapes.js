// dependencies
var AWS          = require('aws-sdk');
var async        = require('async');
var joi          = require('joi');
var path          = require('path');
var q          = require('q');
var child_process = require('child_process');
var scidx        = require('../utils/scidx');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
var arrays       = require('../utils/arrays');
var config       = require('../config');
var arrays_util  = require('../utils/arrays');
var tmpfilecache = require('../utils/tmpfilecache');
// local variables
var s3;
var queryHandler = dbpool.queryHandler;

var set_visual_scale_path = path.resolve(__dirname, '..', '..', 'scripts', 'Soundscapes', 'set_visual_scale.py');

// exports
var Soundscapes = {
    PLAYLIST_TYPE : 2,

    /** Finds soundscapes, given a (non-empty) query.
     * @param {Object}  query
     * @param {Integer} query.id      find soundscapes with the given id.
     * @param {Integer} query.project find soundscapes associated to the given project id.
     * @param {Object}  options [optional]
     * @param {String} options.compute other (computed) attributes to show on returned data
     * @param {Function} callback called back with the queried results.
     */
    find: function (query, options, callback) {
        var constraints=[], agregate=false;
        if(options instanceof Function){
            callback = options;
            options = null;
        }
        if(!options){
            options = {};
        }

        if (query) {
            if (query.id) {
                constraints.push('SC.soundscape_id = ' + dbpool.escape(query.id));
            } else if (query.project) {
                constraints.push('SC.project_id = ' + dbpool.escape(query.project));
            }
        }

        if(constraints.length === 0){
            callback(new Error("Soundscapes.find called with invalid query."));
        }

        return dbpool.queryHandler(
            "SELECT SC.soundscape_id as id, \n"+
            "       SC.name, \n"+
            "       SC.project_id as project, \n"+
            "       SC.playlist_id, \n"+
            "       SC.user_id as user, \n"+
            "       SC.min_value, \n"+
            "       SC.max_value, \n"+
            "       SC.visual_max_value, \n"+
            "       SC.visual_palette, \n"+
            "       SC.min_t, \n"+
            "       SC.max_t, \n"+
            "       SC.min_f, \n"+
            "       SC.max_f, \n"+
            "       SC.bin_size, \n"+
            "       SC.threshold, \n"+
            "       SC.threshold_type, \n"+
            "       SC.frequency, \n"+
            "       SC.normalized, \n"+
            "       SCAT.identifier as aggregation, \n" +
            "       SCAT.name as aggr_name, \n" +
            "       SCAT.scale as aggr_scale, \n" +
            "       SC.uri \n" +
            "FROM soundscapes SC \n" +
            "JOIN soundscape_aggregation_types SCAT ON SC.soundscape_aggregation_type_id = SCAT.soundscape_aggregation_type_id\n" +
            "WHERE " + constraints.join(" \n  AND "), function(err, data){
            if (!err && data){
                if(options.compute){
                    arrays_util.compute_row_properties(data, options.compute, function(property){
                        return Soundscapes['__compute_' + property.replace(/-/g,'_')];
                    }, callback);
                    return;
                }
            }
            callback(err, data);
        });

    },

    details: function(project, callback){
        var q = "SELECT S.`soundscape_id`,  CONCAT(UCASE(LEFT(S.`name`, 1)), SUBSTRING(S.`name`, 2)) name , "+
                " CONCAT(UCASE(LEFT(P.`name`, 1)), SUBSTRING(P.`name`, 2)) playlist, "+
                " UNIX_TIMESTAMP( S.`date_created` )*1000 as date , "+
                " CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2))  ,' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) user " +
                " FROM `soundscapes` S ,`users` U , `playlists` P  " +
                " WHERE S.`project_id` = "+dbpool.escape(project)+" and S.`user_id` = U.`user_id` and P.`playlist_id` = S.`playlist_id` and S.uri is not null" +
                " ORDER BY S.`date_created` DESC";

        queryHandler(q, callback);
    },
    /** Downloads a the scidx file from the bucket, storing it in a temporary file cache, and returns its path.
     * @param {Object} soundscape object.
     * @param {Function} callback(err, path) function to call back with the file's path.
     */
    fetchSCIDXFile: function(soundscape, callback){
        var scidx_uri = "project_"+(soundscape.project|0)+"/soundscapes/"+(soundscape.id|0)+"/index.scidx";
        return q.ninvoke(tmpfilecache, 'fetch', scidx_uri, function(cache_miss){
            if(!s3){
                s3 = new AWS.S3();
            }
            s3.getObject({
                Bucket : config('aws').bucketName,
                Key    : scidx_uri
            }, function(err, data){
                if(err) { cache_miss.deferred.reject(err); return; }
                cache_miss.set_file_data(data.Body);
            });
        }).nodeify(callback);
    },

    /** Fetches and reads the soundscape index file.
     * @param {Object}  soundscape    soundscape object
     * @param {Object}  filters       options for filtering the scidx file (optional)
     * @param {Function} callback     called back with the index file.
     */
    fetchSCIDX : function(soundscape, filters, callback){
        return Soundscapes.fetchSCIDXFile(soundscape).then(function(scidx_path){
            var idx = new scidx();
            return q.ninvoke(idx, 'read', scidx_path.path, filters);
        }).nodeify(callback);
    },


    aggregations : {
        'time_of_day': {
            'date': ['%H'], 'projection': [1], 'range': [0,  23]
        },
        'day_of_month': {
            'date': ['%d'], 'projection': [1], 'range': [1,  31]
        },
        'day_of_year': {
            'date': ['%j'], 'projection': [1], 'range': [1, 366]
        },
        'month_in_year': {
            'date': ['%m'], 'projection': [1], 'range': [1,  12]
        },
        'day_of_week': {
            'date': ['%w'], 'projection': [1], 'range': [0,   6]
        },
        'year': {
            'date': ['%Y'], 'projection': [1], 'range': 'auto'
        }
    },

    /** Fetches the soundscape's normalization vector.
     * @param {Object}  soundscape    soundscape object
     * @param {Function} callback     called back with the index file.
     */
    fetchNormVector : function(soundscape, callback){
        if(!soundscape){
            callback(new Error('Soundscape not given'));
            return;
        }
        var aggregation = this.aggregations[soundscape.aggregation.id];
        if(!aggregation){
            callback(new Error('Invalid soundscape aggregation ' + soundscape.aggregation.id));
            return;
        }

        var proy = aggregation.projection, proylen = aggregation.projection.length;
        var dateparts = aggregation.date.map(function(datepart){
            return 'DATE_FORMAT(R.datetime, "'+datepart+'")';
        });

        return dbpool.query(
            "SELECT " + dateparts.map(function(dp, i){
                return dp + " as dp_"+i;
            }).join(", ") + ", COUNT(*) as count\n" +
            "FROM `soundscapes` S\n" +
            "JOIN `playlist_recordings` PR ON S.playlist_id = PR.playlist_id\n" +
            "JOIN `recordings` R ON R.recording_id = PR.recording_id\n" +
            "WHERE S.soundscape_id = " + dbpool.escape(soundscape.id) + "\n" +
            "GROUP BY " + dateparts.join(", ")
        ).then(function(rows){
            var normvec = {};
            rows.forEach(function(row){
                var date=0;
                for(var i=0; i < proylen; ++i){
                    date += proy[i] * row['dp_' + i];
                }
                normvec[date] = row.count;
            });
            return normvec;
        }).nodeify(callback);
    },

    region_schema : joi.object().keys({
        name      : joi.string(),
        threshold : joi.boolean().optional(),
        bbox      : joi.object().keys({
            x1 : joi.number(),
            y1 : joi.number(),
            x2 : joi.number(),
            y2 : joi.number()
        })
    }),

    /** Adds a region to a soundscape.
     * @param {Object}  soundscape soundscape object as returned by find().
     * @param {Object}  region region to add, follows the schema in region_schema.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    addRegion: function(soundscape, region, callback){
        var self = this;
        var data;
        var x1, y1, x2, y2, count;
        async.waterfall([
            function(next){
                joi.validate(region, self.region_schema, next);
            },
            function(vdata, next){
                data = vdata;
                x1 = Math.min(vdata.bbox.x1, vdata.bbox.x2);
                y1 = Math.min(vdata.bbox.y1, vdata.bbox.y2);
                x2 = Math.max(vdata.bbox.x1, vdata.bbox.x2);
                y2 = Math.max(vdata.bbox.y1, vdata.bbox.y2);
                next();
            },
            function(next){
                Soundscapes.fetchSCIDX(soundscape, {
                    ignore_offsets : true,
                    minx : ((x1 - soundscape.min_t)) | 0,
                    maxx : ((x2 - soundscape.min_t)) | 0,
                    miny : ((y1 - soundscape.min_f) / soundscape.bin_size) | 0,
                    maxy : ((y2 - soundscape.min_f) / soundscape.bin_size - 1) | 0
                }, next);
            },
            function(scidx, next){
                var options = region.threshold && {threshold:{
                    value : soundscape.threshold,
                    type : soundscape.threshold_type,
                }};

                count = scidx.count(options);
                next();
            },
            function(next){
                dbpool.queryHandler(
                    "INSERT INTO soundscape_regions(soundscape_id, name, x1, y1, x2, y2, count, threshold, threshold_type) \n" +
                    "VALUES (" + dbpool.escape([
                        soundscape.id, data.name, x1, y1, x2, y2, count,
                        region.threshold ? soundscape.threshold : NULL,
                        region.threshold ? soundscape.threshold_type : NULL,
                    ]) + ")\n",
                    next
                );
            },
            function(results, fields, next){
                self.getRegions(soundscape, {region:results.insertId}, next);
            },
            function(rows, fields){
                var next = arguments[arguments.length-1];
                data = rows[0];
                next(null, data);
            }
        ], callback);
    },

    /** Fetches a soundscape's regions.
     * @param {Object}  soundscape    soundscape
     * @param {Object}  params  [optional]
     * @param {Integer} param.region  find region with the given id.
     * @param {String}  param.compute other (computed) attributes to show on returned data
     * @param {Function} callback called back with the queried results.
     */
    getRegions: function(soundscape, params, callback){
        if(params instanceof Function){
            callback = params;
            params = null;
        }
        if(!params){
            params={};
        }

        var constraints=[
            'SCR.soundscape_id = ' + (soundscape.id | 0)
        ];
        if(params.region){
            constraints.push('SCR.soundscape_region_id = ' + dbpool.escape(params.region));
        }

        return dbpool.queryHandler(
            "SELECT SCR.soundscape_region_id as id, SCR.soundscape_id as soundscape, SCR.name, SCR.x1, SCR.y1, SCR.x2, SCR.y2, SCR.count, \n" +
            "    SCR.threshold, SCR.threshold_type, " +
            "    SCR.sample_playlist_id as playlist \n" +
            "FROM soundscape_regions SCR \n" +
            "WHERE " + constraints.join(' AND '), function(err, data){
            if (!err && data){
                if(params.compute){
                    arrays_util.compute_row_properties(data, params.compute, function(property){
                        return Soundscapes['__compute_region_' + property.replace(/-/g,'_')];
                    }, callback);
                    return;
                }
            }
            callback(err, data);
        });
    },

    /** Samples the recordings in a soundscape region.
     * @param {Object}  soundscape    soundscape
     * @param {Object}  region  region in the soundscape.
     * @param {Object}  params  [optional]
     * @param {Integer} param.count  number of recording to sample (default: all the recordings in the region).
     * @param {Function} callback called back with the results.
     * @return {Promise} resolved after the region has been sampled.
     */
    sampleRegion: function(soundscape, region, params, callback){
        if(!params){
            params = {};
        }

        var count = (params.count) | 0;
        var db;
        var playlist_id, rercordings;

        var filters = {
            ignore_offsets : true,
            minx : ((region.x1 - soundscape.min_t)) | 0,
            maxx : ((region.x2 - soundscape.min_t)) | 0,
            miny : ((region.y1 - soundscape.min_f) / soundscape.bin_size) | 0,
            maxy : ((region.y2 - soundscape.min_f) / soundscape.bin_size - 1) | 0
        };

        var options = region.threshold && {threshold:{
            value: region.threshold,
            type: region.threshold_type,
        }};

        return Soundscapes.fetchSCIDX(soundscape, filters).then(function (scidx){
            recordings = arrays.sample_without_replacement(scidx.flatten(options), count);
        }).then(function(){
            return dbpool.performTransaction(function(tx){
                var db = tx.connection;

                return q.resolve().then(function (){
                    if(region.playlist){
                        playlist_id = region.playlist;
                        return;
                    }

                    var name = soundscape.name + ', ' + region.name + ' recordings sample';
                    return db.promisedQuery(
                        "INSERT INTO playlists(project_id, name, playlist_type_id, uri, status) \n" +
                        " VALUES (?, ?, ?, ?, ?)",[
                        soundscape.project, name, Soundscapes.PLAYLIST_TYPE, null, 20
                    ]).then(function(results){
                        region.playlist = results.insertId;
                        playlist_id = region.playlist;
                        return db.promisedQuery(
                            "UPDATE soundscape_regions \n" +
                            "SET sample_playlist_id = ? \n" +
                            "WHERE soundscape_region_id = ?", [
                            results.insertId,
                            region.id
                        ]);
                    });
                }).then(function (){
                    return db.promisedQuery(
                        "INSERT IGNORE INTO playlist_recordings(playlist_id, recording_id)\n VALUES \n" +
                        recordings.map(function(){
                            return '   (?, ?)';
                        }).join(", \n") + ";",
                        recordings.reduce(function(_, r){
                            _.push(playlist_id, r);
                            return _;
                        }, [])
                    );
                });
            });
        }).thenResolve(region).nodeify(callback);
    },

    /** Fetches soundscape region tags.
     * @param {Object}  region soundscape object as returned by getRegions().
     * @param {Object}  params optional stuff for the query.
     * @param {Object}  params.recording limit results to this recording.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    getRegionTags: function(region, params, callback){
        if(params instanceof Function){
            callback = params;
            params = null;
        }
        if(!params){
            params={};
        }

        var constraints=[
            'SRT.soundscape_region_id = ' + (region.id)
        ];
        var project = [];
        var groupby = [];

        groupby.push('SRT.soundscape_region_id');

        if(params.id){
            constraints.push('SRT.soundscape_region_tag_id = ' + dbpool.escape(params.id));
            project.push('SRT.user_id as user', 'SRT.timestamp');
            if(params.recording){
                constraints.push('SRT.recording_id = ' + dbpool.escape(params.recording));
            }
        } else if(params.recording){
            constraints.push('SRT.recording_id = ' + dbpool.escape(params.recording));
            project.push('SRT.user_id as user', 'SRT.timestamp');
            groupby.push('SRT.recording_id');
        }

        groupby.push('SRT.soundscape_tag_id');

        return dbpool.queryHandler(
            "SELECT SRT.soundscape_region_tag_id as id, SRT.soundscape_region_id as region, SRT.recording_id as recording,\n" +
            (project.length ? "    " + project.join(", ")+", \n" : "")+
            "    ST.tag, ST.type, COUNT(*) as count \n" +
            "FROM soundscape_region_tags SRT \n" +
            "JOIN soundscape_tags ST ON ST.soundscape_tag_id = SRT.soundscape_tag_id\n" +
            "WHERE " + constraints.join(' AND ') + "\n" +
            "GROUP BY " + groupby.join(", "), callback);
    },

    /** adds a soundscape region tags.
     * @param {Object}  region soundscape object as returned by getRegions().
     * @param {Object}  recording id of the recording to add the tag to.
     * @param {Object}  data data for the tag addition. Can be a string, in
     *                  which case its used for the tag parameter, or an
     *                  integer specifying an already existing tag.
     * @param {Object}  data.tag the name of the tag
     * @param {Function} callback(err, path) function to call back with the results.
     */
    addRegionTag: function(region, recording, user, data, callback){
        var tagtypes={'normal':1,'species_sound':1};
        if(typeof data == 'string'){
            data = {tag:data, type:'normal'};
        }

        async.waterfall([
            function check_valid_tag_type(next){
                if(!tagtypes[data.type]){
                    next(new Error("Invalid tag type " + data.type + "."));
                } else {
                    next();
                }
            },
            function fetch_tag_id(next){
                dbpool.queryHandler(
                    "SELECT ST.soundscape_tag_id as id\n" +
                    "FROM soundscape_tags ST \n" +
                    "WHERE tag  = "+dbpool.escape(data.tag)+"\n" +
                    "  AND type = "+dbpool.escape(data.type), next
                );
            },
            function or_make_tag_id(result){
                var next = arguments[arguments.length - 1];
                if(result.length){
                    next(null, result[0].id);
                    return;
                }
                dbpool.queryHandler(
                    "INSERT INTO soundscape_tags(tag, type) \n"+
                    "VALUES ("+dbpool.escape([data.tag, data.type])+")",
                    function(err, result){
                        if(err){ next(err); } else { next(null, result.insertId); }
                    }
                );
            },
            function insert_tag(tag_id){
                var next = arguments[arguments.length-1];
                dbpool.queryHandler(
                    "INSERT INTO soundscape_region_tags(soundscape_region_id, recording_id, soundscape_tag_id, user_id, timestamp) \n"+
                    "VALUES ("+dbpool.escape([region.id, recording, tag_id, user])+", NOW())", next
                );
            },
            function get_tag(result){
                var next = arguments[arguments.length-1];
                Soundscapes.getRegionTags(region, {id:result.insertId}, next);
            },
            function (tags){
                var next = arguments[arguments.length-1];
                next(null, tags.shift());
            }
        ], callback);
    },
    /** deletes soundscapes png scidx and db associations

     */
    delete: function (scape_id,callback)
    {
        var q = "SELECT `uri` FROM `soundscapes` WHERE `soundscape_id` = "+scape_id;

        queryHandler(q,
            function (err,rows)
            {
                if (err) {
                    callback(err);
                }
                if(!s3){
                    s3 = new AWS.S3();
                }
                var imgUri = rows[0].uri;
                var indexUri = rows[0].uri.replace('image.png','index.scidx');
                var params = {
                    Bucket: config('aws').bucketName,
                    Delete: {
                        Objects:
                        [
                          {
                            Key: imgUri
                          },
                          {
                            Key: indexUri
                          }
                        ]
                    }
                };
                s3.deleteObjects(params, function(err, data) {
                    if (err)
                    {
                        callback(err);
                    }
                    else
                    {
                        var q = " DELETE FROM `playlists` WHERE `playlist_id` IN "+
                        " (SELECT `sample_playlist_id` FROM `soundscape_regions` WHERE `soundscape_id` = "+scape_id+")";
                        queryHandler(q,function(err,row)
                            {
                                if (err)
                                {
                                    callback(err);
                                }
                                else
                                {
                                    var q = "DELETE FROM `soundscapes` WHERE `soundscape_id` = "+scape_id+"" ;
                                    queryHandler(q, callback);
                                }
                            }
                        );
                    }
                });
            }
        );
    },
    /** removess a soundscape region tags.
     * @param {Object}  region soundscape object as returned by getRegions().
     * @param {Object}  recording id of the recording to add the tag to.
     * @param {Object}  tag id for the tag to delete.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    removeRegionTag: function(region, recording, tag, callback){
        var tagobj;
        async.waterfall([
            function fetch_tag_to_delete(next){
                Soundscapes.getRegionTags(region, {id:tag, recording:recording}, next);
            },
            function check_in_rec(tags){
                var next = arguments[arguments.length - 1];
                if(!tags.length){
                    next(new Error("Invalid tag specified."));
                } else {
                    tagobj = tags[0];
                    next();
                }
            },
            function(next){
                dbpool.queryHandler(
                    "DELETE FROM soundscape_region_tags \n"+
                    "WHERE  soundscape_region_tag_id = " + dbpool.escape(tagobj.id) + "\n",
                    next
                );
            },
            function(){
                var next = arguments[arguments.length - 1];
                arguments[arguments.length-1](null, tagobj);
            }
        ], callback);
    },


    /** sets the soundscape's visualization options.
     * @param {Object}  soundscape   soundscape
     * @param {Object}  options        options object
     * @param {Integer} options.max    max value
     * @param {Function} callback called back with the results.
     */
    setVisualizationOptions: function(soundscape, options, callback){
        if(!options){
            options = {};
        }

        var max = (options.max || soundscape.max_value);
        var palette = options.palette === undefined ?  soundscape.visual_palette : (options.palette | 0);
        var normalized = options.normalized | 0;
        var amplitude = +options.amplitude;
        var amplitudeReference = options.amplitudeReference;
        var cmd;
        var script = child_process.spawn(
            '.env/bin/python', cmd=[
                set_visual_scale_path,
                (soundscape.id|0), max == '-' ? '-' : (max|0), palette,
                normalized,
                amplitude,
                amplitudeReference
            ], {stdio:'inherit'}
        );
        console.log(cmd);
        script.on('close', function(code){
            Soundscapes.find({id:soundscape.id}, callback);
        });
    },

    __compute_thumbnail_path : function(soundscape, callback){
        soundscape.thumbnail = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + soundscape.uri;
        callback();
    },
    __compute_region_tags : function(region, callback){
        Soundscapes.getRegionTags(region, function(err, tags){
            if(err){callback(err); return;}
            region.tags = tags;
            callback();
        });
    },

    totalSoundscapeJobs: function(projectId) {
        return dbpool.query(`SELECT COUNT(soundscape_id) AS count
            FROM soundscapes
            WHERE project_id = ${dbpool.escape(projectId)} AND uri is not null`).get(0).get('count');
    },

};

module.exports = Soundscapes;
