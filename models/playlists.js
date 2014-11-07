// dependencies
var mysql        = require('mysql');
var async        = require('async');
var joi          = require('joi');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
var Recordings   = require('./recordings');
var Projects     = require('./projects');
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

        if (query) {
            if (query.id) {
                constraints.push('PL.playlist_id = ' + mysql.escape(query.id));
            } else if (query.project) {
                constraints.push('PL.project_id = ' + mysql.escape(query.project));
            }
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
                return row.recording_id
            });
            Recordings.findByUrlMatch({id:ids}, null, {compute:query && query.show}, callback);
        });
    }
};

module.exports = Playlists;
