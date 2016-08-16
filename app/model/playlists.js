// dependencies
var debug = require('debug')('arbimon2:model:playlists');
var mysql = require('mysql');
var async = require('async');
var q = require('q');
var Joi   = require('joi');
var util  = require('util');


var sqlutil = require('../utils/sqlutil');
var dbpool = require('../utils/dbpool');
// TODO remove circular dependencies
var model = require('../model');

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
     * @return {Promise} resolving to array with the matching playlists.
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
     * @param {Promise} resolving to the playlist's extra info.
     */
    getInfo: function (playlist, callback) {
        return q.resolve().then(function(){
            if(playlist.type == "soundscape region"){
                return dbpool.query(
                    "SELECT  soundscape_region_id as region, soundscape_id as soundscape \n" +
                    "FROM soundscape_regions SCR \n" +
                    "WHERE SCR.sample_playlist_id = ?", [
                    playlist.id,
                ]).get(0).then(function(sr){
                    if(sr){
                        playlist.region     = sr.region;
                        playlist.soundscape = sr.soundscape;
                    }
                });
            }
        }).thenResolve(playlist).nodeify(callback);
    },

    /** Fetches a playlist's data, optionally using a query.
     * @param {Object}  playlist  playlist object as returned by find().
     * @param {Object}  query (optional)
     * @param {Object}  query.recording limit data results to those belonging to the matching recordings
     * @param {Object}  query.limit     limit results to the given window interval
     * @param {Function} callback(err, path) function to call back with the results (optional).
     * @return {Promise} resolving to array with the matching playlists.
     */
    fetchData: function (playlist, query, callback) {
        var constraints = [], data=[];
        if(query instanceof Function) {
            callback = query;
            query = null;
        }
        if(!query) {
            query = {};
        }

        constraints.push('PLR.playlist_id = ?');
        data.push(playlist.id);

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
                limit_clause += " OFFSET " + Math.max(0, (qlimit.offset | 0));
            }
        }

        if(constraints.length === 0){
            return q.reject(
                new Error("Playlists.fetchData called with invalid query.")
            ).nodeify(callback);
        }

        return dbpool.query(
            "SELECT PLR.recording_id \n" +
            "FROM playlist_recordings PLR \n" +
            "WHERE " + constraints.join(" \n" +
            "  AND ") + limit_clause,
            data
        ).then(function(data){
            if(!data.length){
                return [];
            }
            // var ids = data.map(function(row){
            //     return row.recording_id;
            // });
            // model.recordings.findByUrlMatch({id:ids}, null, {compute:query && query.show}, callback);
            // this is necessary to ensure playlist order
            return q.all(data.map(function(row){
                var id = row.recording_id;
                return model.recordings.findByUrlMatch({id:id}, null, {compute:query && query.show}).get(0);
            }));
        }).nodeify(callback);
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
    
    /** Creates a new playlist.
     * @param {Object} data - object describing playlist to create.
     * @param {Function} callback - callback function (optional)
     * @return {Promise} resolving to created playlists' insert_id
     */
    create: function(data, callback) {
        data.params.project_id = data.project_id;
        return q.all([
            dbpool.query(
                "INSERT INTO playlists(project_id, name, playlist_type_id) \n"+
                "VALUES (?, ?, 1)", [
                data.project_id, data.name
            ]).get('insertId'),
            model.recordings.findProjectRecordings(data.params).then(function(rows) {
                return rows.map(function(rec){
                    return rec.id;
                });
            })
        ]).spread(function (playlist_id, rec_ids){
            return Playlists.addRecs(playlist_id, rec_ids).thenResolve({
                id: playlist_id
            });
        }).nodeify(callback);
    },
    /** Adds recordings to a given playlist.
     * @param {Integer} playlist_id - id of the associated playlist.
     * @param {Array} rec_ids - array of recording ids to add to playlist.
     * @param {Function} callback - callback function (optional).
     * @return {Promise} resolved after the recordings are added to the playlist.
     */
    addRecs: function(playlist_id, rec_ids, callback) {
        var schema =  Joi.array().items(Joi.number());
        
        return q.ninvoke(Joi, 'validate', rec_ids, schema).then(function(recs) {
            return dbpool.query(
                "INSERT INTO playlist_recordings(playlist_id, recording_id) \n"+
                "VALUES " + recs.map(function(rec_id) {
                    return "(" + (playlist_id|0) + "," + (rec_id|0) + ")";
                }).join(",\n       ")
            );
        }).nodeify(callback);
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
        var schema = Joi.array().items(Joi.number());
        
        Joi.validate(playlist_ids, schema, function(err, ids) {
            var q = "DELETE FROM playlists \n"+
                    "WHERE playlist_id IN (%s)";
                    
            q = util.format(q, mysql.escape(ids));
            queryHandler(q, callback);
        });
    }
};

module.exports = Playlists;
