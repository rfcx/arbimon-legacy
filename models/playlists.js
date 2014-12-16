// dependencies
var debug = require('debug')('arbimon2:model:playlists');
var mysql = require('mysql');
var async = require('async');
var Joi   = require('joi');
var util  = require('util');


var sqlutil = require('../utils/sqlutil');
var dbpool = require('../utils/dbpool');
var model = require('../models');

// local variables
var s3;
var queryHandler = dbpool.queryHandler;

// exports
var Playlists = {
    /** Finds playlists, given a (non-empty) query.
     * @param {Object}  query
     * @param {Integer} query.id      find playlists with the given id.
     * @param {Integer} query.project find playlists associated to the given project id.
     * @param {Object}  options [optional]
     * @param {Boolean} options.count add the number of recordings in the playlist
     * @param {Function} callback called back with the queried results.
     */    
    find: function (query, options, callback) {
        var constraints=[], projection=[], joins=[], agregate=false;
        if(options instanceof Function){
            callback = options;
            options = null;
        }
        if(!options){
            options = {};
        }

        if (query.id) {
            constraints.push('PL.playlist_id = ' + mysql.escape(query.id));
        } 
        if (query.project) {
            constraints.push('PL.project_id = ' + mysql.escape(query.project));
        }
        if(query.name) {
            constraints.push('PL.name = ' + mysql.escape(query.name));
        }

        if(constraints.length === 0){
            callback(new Error("Playlists.find called with invalid query."));
        }
        
        if(options.count){
            agregate = true;
            projection.push("COUNT(PLR.recording_id) as count");
            joins.push("JOIN playlist_recordings PLR ON PL.playlist_id = PLR.playlist_id");
        }

        projection.push("PLT.name as type");
        joins.push("JOIN playlist_types PLT ON PL.playlist_type_id = PLT.playlist_type_id");
        

        return dbpool.queryHandler(
            "SELECT PL.playlist_id as id, PL.name, PL.project_id, PL.uri \n" +
            (projection.length ? ","+projection.join(",")+"\n" : "") +
            "FROM playlists PL \n" +
            (joins.length ? joins.join("\n")+"\n" : "") +
            "WHERE " + constraints.join(" \n  AND ") +
            (agregate ? "\nGROUP BY PL.playlist_id" : ""), 
            callback
        );
    },


    /** Fetches a playlist's extra info.
     *  The actual info fetched depends on the playlist type.
     * @param {Object}  playlist  playlist object as returned by find().
     * @param {Function} callback(err, path) function to call back with the results.
     */
    getInfo: function (playlist, callback) {
        var steps=[];
        
        switch(playlist.type){
            case "soundscape region":
                steps.push(
                    function (next){
                        dbpool.queryHandler(
                            "SELECT  soundscape_region_id as region, soundscape_id as soundscape \n" +
                            "FROM soundscape_regions SCR \n" +
                            "WHERE SCR.sample_playlist_id = " + (playlist.id | 0), 
                            next
                        );
                    },
                    function (data){
                        var next = arguments[arguments.length - 1];
                        if(data.length){
                            playlist.region     = data[0].region;
                            playlist.soundscape = data[0].soundscape;
                        }
                        next();
                    }
                );
            break;
            
        }
        
        steps.push(function(){
            arguments[arguments.length - 1](null, playlist);
        });
        
        async.waterfall(steps, callback);
    },

    /** Fetches a playlist's data, optionally using a query.
     * @param {Object}  playlist  playlist object as returned by find().
     * @param {Object}  query (optional)
     * @param {Object}  query.recording limit data results to those belonging to the matching recordings
     * @param {Object}  query.limit     limit results to the given window interval
     * @param {Function} callback(err, path) function to call back with the results.
     */
    fetchData: function (playlist, query, callback) {
        var constraints = [];
        if(query instanceof Function) {
            callback = query;
            query = null;
        }
        if(!query) {
            query = {};
        }

        constraints.push('PLR.playlist_id = ' + playlist.id);

        // if (query.id) {
        // } else if (query.project) {
        //     constraints.push('PL.project_id = ' + mysql.escape(query.project));
        // }
        
        var limit_clause = '';
        if(query.limit){
            var qlimit = query.limit;
            if(typeof qlimit != "object"){
                qlimit = {count:query.limit};
            }
            limit_clause = " LIMIT " + Math.max(0,(qlimit.count | 0));
            if(qlimit.offset === undefined && query.offset){
                qlimit.offset = query.offset;
            }
            if(qlimit.offset){
                limit_clause += " OFFSET " + Math.max(0, (qlimit.offset | 0))
            }
        }

        if(constraints.length === 0){
            callback(new Error("Playlists.fetchData called with invalid query."));
        }

        return dbpool.queryHandler(
            "SELECT PLR.recording_id \n" +
            "FROM playlist_recordings PLR \n" +
            "WHERE " + constraints.join(" \n" +
            "  AND ") + limit_clause, function(err, data){
            if(err){ callback(err); return; }
            if(!data.length){
                callback(null, []);
                return;
            }
            // var ids = data.map(function(row){
            //     return row.recording_id;
            // });
            // model.recordings.findByUrlMatch({id:ids}, null, {compute:query && query.show}, callback);
            // this is necessary to ensure playlist order
            async.map(data, function(row, next_row){
                var id = row.recording_id;
                model.recordings.findByUrlMatch({id:id}, null, {compute:query && query.show}, function(err, recording){
                    if(err){next_row(err); return;}
                    next_row(null, recording.length && recording[0]);
                });
            }, function(err,recs){
                callback(err, recs);
            });
        });
    },
    
    fetchRecordingsAround: function(playlist, recording, radius, callback){
        async.waterfall([
            (function(next){
                dbpool.queryHandler(
                    "SELECT rPLR.row \n" +
                    "FROM (\n"+
                    "   SELECT @rownum:=@rownum+1 row, PLR.*  \n" +
                    "   FROM playlist_recordings PLR, (SELECT @rownum:=0) r \n" +
                    "   WHERE PLR.playlist_id = " + mysql.escape(playlist.id) + " \n"+
                    ") as rPLR \n" +
                    "WHERE rPLR.recording_id = " + mysql.escape(recording),
                next);
            }).bind(this), 
            function(rows){
                var next = arguments[arguments.length-1];
                next(null, rows.length ? rows[0].row : 0);
            },
            function(rec_row, next){
                --rec_row;
                var intervals = [
                    {offset:rec_row - radius, count:radius},
                    {offset:rec_row         , count:1     },
                    {offset:rec_row + 1     , count:radius}
                ];                
                async.map(intervals, function(interval, next_interval){
                    Playlists.fetchData(playlist, {limit:interval}, next_interval);
                }, next);
            },
            function(intervals){
                var next = arguments[arguments.length-1];
                next(null, intervals[0], intervals[1][0], intervals[2]);
            },            
        ], callback);
    },
    
    fetchRecordingPosition: function(playlist, recording, callback){
        async.waterfall([
            function(next){
                dbpool.queryHandler(
                    "SELECT rPLR.row \n" +
                    "FROM (\n"+
                    "   SELECT @rownum:=@rownum+1 row, PLR.*  \n" +
                    "   FROM playlist_recordings PLR, (SELECT @rownum:=0) r \n" +
                    "   WHERE PLR.playlist_id = " + mysql.escape(playlist.id) + " \n"+
                    ") as rPLR \n" +
                    "WHERE rPLR.recording_id = " + mysql.escape(recording),
                next);
            }, 
            function(rows){
                var next = arguments[arguments.length-1];
                next(null, rows.length ? rows[0].row - 1 : null);
            }
        ], callback);
    },

    fetchNextRecording: function(playlist, recording, callback){
        async.waterfall([
            function(next){
                Playlists.fetchRecordingsAround(playlist, recording, 1, next);
            },
            function(before, recording, after){
                var next = arguments[arguments.length-1];
                next(null, after.length ? after[0] : recording);
            }
        ], callback);
    },

    fetchPreviousRecording: function(playlist, recording, callback){
        async.waterfall([
            function(next){
                Playlists.fetchRecordingsAround(playlist, recording, 1, next);
            },
            function(before, recording, after){
                var next = arguments[arguments.length-1];
                next(null, before.length ? before[0] : recording);
            }
        ], callback);
    },
    
    create: function(data, callback) {
        
        async.auto({
            getRecs: function(cb) {
                data.params.project_id = data.project_id;
                model.recordings.findProjectRecordings(data.params, function(err, rows) {
                    if(err)  return cb(err);
                    
                    var recIds = rows.map(function(rec) { 
                        return rec.id;
                    });
                    
                    cb(null, recIds);
                });
            },
            insertPlaylist: function(cb) {
                var q = "INSERT INTO playlists \n"+
                        "SET project_id = %s, name = %s, playlist_type_id=1";
                q = util.format(q, mysql.escape(data.project_id), mysql.escape(data.name));
                
                queryHandler(q, cb);
            },
            insertPlaylistRecs: ['getRecs', 'insertPlaylist', function(cb, results) {
                debug(results);
                Playlists.addRecs(results.insertPlaylist[0].insertId, results.getRecs, cb);
            }]
        },
        function(err, result) {
            if(err)  return callback(err);
            
            callback(null, result);
        });
    },
    
    addRecs: function(playlist_id, rec_ids, callback) {
        var schema =  Joi.array().includes(Joi.number());
        
        Joi.validate(rec_ids, schema, function(err, recs) {
            if(err)  return callback(err);
            
            var values = recs.map(function(rec_id) {
                return "(" + playlist_id + "," + rec_id + ")";
            });
            
            var q = "INSERT INTO playlist_recordings(playlist_id, recording_id) \n"+
                    "VALUES " + values.join(",\n       ");
            
            queryHandler(q, callback);
        });
    },
    
    rename: function(playlist, callback) {
        var schema = {
            id: Joi.number().required(),
            name: Joi.string().required()
        };
        
        Joi.validate(playlist, schema, function(err, pls) {
            var q = "UPDATE playlists \n"+
                    "SET name = %s \n"+
                    "WHERE playlist_id = %s";
                    
            q = util.format(q, mysql.escape(pls.name), mysql.escape(pls.id));
            queryHandler(q, callback);
        });
    },
    
    remove: function(playlist_ids, callback) {
        var schema = Joi.array().includes(Joi.number());
        
        Joi.validate(playlist_ids, schema, function(err, ids) {
            var q = "DELETE FROM playlists \n"+
                    "WHERE playlist_id IN (%s)";
                    
            q = util.format(q, mysql.escape(ids));
            queryHandler(q, callback);
        });
    }
};

module.exports = Playlists;
