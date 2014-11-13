// dependencies
var mysql        = require('mysql');
var dbpool       = require('../utils/dbpool');
var config       = require('../config');
var arrays_util  = require('../utils/arrays');
// local variables
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
            "SELECT SC.soundscape_id as id, SC.name, SC.project_id, SC.user_id, SC.uri \n" +
            "FROM soundscapes SC \n" +
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

    __compute_thumbnail_path : function(soundscape, callback){
        soundscape.thumbnail = 'https://' + config('aws').bucketName + '.s3.amazonaws.com/' + soundscape.uri;
        callback();
    },

};

module.exports = Soundscapes;
