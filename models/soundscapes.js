// dependencies
var mysql        = require('mysql');
var AWS          = require('aws-sdk');
var async        = require('async');
var joi          = require('joi');
var scidx        = require('../utils/scidx');
var dbpool       = require('../utils/dbpool');
var config       = require('../config');
var arrays_util  = require('../utils/arrays');
var tmpfilecache = require('../utils/tmpfilecache');
// local variables
var s3;
var queryHandler = dbpool.queryHandler;

// exports
var Soundscapes = {
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
                constraints.push('SC.soundscape_id = ' + mysql.escape(query.id));
            } else if (query.project) {
                constraints.push('SC.project_id = ' + mysql.escape(query.project));
            }
        }

        if(constraints.length === 0){
            callback(new Error("Soundscapes.find called with invalid query."));
        }

        return dbpool.queryHandler(
            "SELECT SC.soundscape_id as id, SC.name, SC.project_id as project, SC.user_id as user, \n"+
            "     SC.min_value, SC.max_value, SC.min_t, SC.max_t, SC.min_f, SC.max_f, \n" +
            "     SC.bin_size, SCAT.identifier as aggregation, \n" +
            "     SC.uri \n" +
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

    details: function(project, callback)
    {
        var q = "SELECT S.`soundscape_id`,  CONCAT(UCASE(LEFT(S.`name`, 1)), SUBSTRING(S.`name`, 2)) name , "+
                " CONCAT(UCASE(LEFT(P.`name`, 1)), SUBSTRING(P.`name`, 2)) playlist, "+
                " DATE_FORMAT(S.`date_created`,'%h:%i %p') as time , DATE_FORMAT(S.`date_created`,'%M %d %Y') as date, "+
                " CONCAT(CONCAT(UCASE(LEFT( U.`firstname` , 1)), SUBSTRING( U.`firstname` , 2))  ,' ',CONCAT(UCASE(LEFT( U.`lastname` , 1)), SUBSTRING( U.`lastname` , 2))) user " +
                " FROM `soundscapes` S ,`users` U , `playlists` P  " +
                " WHERE S.`project_id` = "+mysql.escape(project)+" and S.`user_id` = U.`user_id` and P.`playlist_id`  =S.`playlist_id` " 

        queryHandler(q, callback);
    },
    /** Downloads a the scidx file from the bucket, storing it in a temporary file cache, and returns its path.
     * @param {Object} soundscape object.
     * @param {Function} callback(err, path) function to call back with the file's path.
     */
    fetchSCIDXFile: function(soundscape, callback){
        var scidx_uri = "project_"+(soundscape.project|0)+"/soundscapes/"+(soundscape.id|0)+"/index.scidx";
        tmpfilecache.fetch(scidx_uri, function(cache_miss){
            if(!s3){
                s3 = new AWS.S3();
            }
            s3.getObject({
                Bucket : config('aws').bucketName,
                Key    : scidx_uri
            }, function(err, data){
                if(err) { callback(err); return; }
                cache_miss.set_file_data(data.Body);
            });
        }, callback);
    },
    
    /** Fetches and reads the soundscape index file.
     * @param {Object}  soundscape    soundscape object
     * @param {Object}  filters       options for filtering the scidx file (optional)
     * @param {Function} callback     called back with the index file.
     */
    fetchSCIDX : function(soundscape, filters, callback){
        Soundscapes.fetchSCIDXFile(soundscape, function(err, scidx_path){
            if(err) { callback(err); return; }
            var idx = new scidx();
            idx.read(scidx_path.path, filters, callback);
        });                
    },

    region_schema : joi.object().keys({
        name      : joi.string(),
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
                count = scidx.count();
                next();
            },
            function(next){
                dbpool.queryHandler(
                    "INSERT INTO soundscape_regions(soundscape_id, name, x1, y1, x2, y2, count) \n" +
                    "VALUES (" + mysql.escape([soundscape.id, data.name, x1, y1, x2, y2, count]) + ")\n", 
                    next
                );
            },
            function(results, fields, next){
                self.getRegions(soundscape, {region:results.insertId}, next);
            },
            function(rows, fields, next){
                data = rows[0];
                next(null, data);
            }
        ], callback);
    },
    
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
            constraints.push('SCR.soundscape_region_id = ' + mysql.escape(params.region));
        }
        
        return dbpool.queryHandler(
            "SELECT SCR.soundscape_region_id as id, SCR.soundscape_id as soundscape, SCR.name, SCR.x1, SCR.y1, SCR.x2, SCR.y2, SCR.count\n" +
            "FROM soundscape_regions SCR \n" +
            "WHERE " + constraints.join(' AND '), callback);
    },
    
    __compute_thumbnail_path : function(soundscape, callback){
        soundscape.thumbnail = 'https://' + config('aws').bucketName + '.s3.amazonaws.com/' + soundscape.uri;
        callback();
    },

};

module.exports = Soundscapes;
