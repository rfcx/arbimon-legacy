// dependencies
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

        if(constraints.length == 0){
            callback(new Error("Playlists.find called with invalid query."));
        }
        
        if(options.count){
            agregate = true;
            projection.push("COUNT(PLR.recording_id) as count");
            joins.push("JOIN playlist_recordings PLR ON PL.playlist_id = PLR.playlist_id");
        }
        

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

    /** Fetches a playlist's data, optionally using a query.
     * @param {Object}  playlist  playlist object as returned by find().
     * @param {Object}  query (optional)
     * @param {Object}  query.recording limit data results to those belonging to the matching recordings
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

        if(constraints.length == 0){
            callback(new Error("Playlists.fetchData called with invalid query."));
        }

        return dbpool.queryHandler(
            "SELECT PLR.recording_id \n" +
            "FROM playlist_recordings PLR \n" +
            "WHERE " + constraints.join(" \n" +
            "  AND "
        ), function(err, data){
            if(err){ callback(err); return; }
            var ids = data.map(function(row){
                return row.recording_id;
            });
            model.recordings.findByUrlMatch({id:ids}, null, {compute:query && query.show}, callback);
        });
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
                        "SET project_id = %s, name = %s";
                q = util.format(q, mysql.escape(data.project_id), mysql.escape(data.name));
                
                queryHandler(q, cb);
            },
            insertPlaylistRecs: ['getRecs', 'insertPlaylist', function(cb, results) {
                console.log(results);
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
