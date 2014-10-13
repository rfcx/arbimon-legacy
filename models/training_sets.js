// dependencies
var async        = require('async');
var AWS          = require('aws-sdk');
var mysql        = require('mysql');
var util         = require('util');
var config       = require('../config'); 
var arrays_util  = require('../utils/arrays');
var tmpfilecache = require('../utils/tmpfilecache');
var audiotool    = require('../utils/audiotool');
// local variables
var s3;

// exports
module.exports = function(queryHandler) {
    var TrainingSets = {
        /** Finds training sets, given a (non-empty) query.
         * @param {Object} query
         * @param {Object} query.id      find training sets with the given id.
         * @param {Object} query.project find training sets associated to the given project id.
         * @param {Object} query.name    find training sets with the given name (must also provide a project id);
         * @param {Function} callback called back with the queried results. 
         */
        find: function (query, callback) {
            var constraints = [];
            
            if (query) {
                if (query.id) {
                    constraints.push('TS.id = ' + mysql.escape(query.id));
                } else if (query.project) {
                    constraints.push('TS.project_id = ' + mysql.escape(query.project));
                    if (query.name) {
                        constraints.push('TS.name = ' + mysql.escape(query.name));
                    }
                }
            }
            
            if(constraints.length == 0){
                callback(new Error("TrainingSets.find called with invalid query."));
            }
                
            return queryHandler(
                "SELECT TS.training_set_id as id, TS.name, TS.date_created, TST.identifier as type \n" +
                "FROM training_sets TS \n" +
                "JOIN training_set_types TST ON TS.training_set_type_id = TST.training_set_type_id \n" +
                "WHERE " + constraints.join(" \n" +
                "  AND "
            ), callback);
        },
        
        /** Finds training sets, given a (non-empty) query.
         * @param {Object} data
         * @param {Object} data.project id of the project associated to this training set.
         * @param {Object} data.name   name given to this training set.
         * @param {Object} data.type   type of training set to insert.
         * @param {Function} callback called back with the newly inserted training set, or with errors.
         */
        insert: function (data, callback) {
            queryHandler(
                "INSERT INTO training_sets (project_id, name, date_created, training_type_id) \n" +
                "VALUES ("+mysql.escape(data.project)+", "+mysql.escape(data.name)+", NOW(), "+ mysql.escape(data.type)+")",
            function(err, result) {
                if (err) throw err;
                TrainingSets.find({id:result.insertId}, callback);
            });
        },
        
        /** Fetches a training set's data, optionally using a query.
         * @param {Object}  query (optional)
         * @param {Function} callback(err, path) funciton to call back with the validation result.
         */
        fetchData: function (training_set, query, callback) {
            if(query instanceof Function) {
                callback = query;
                query = null;
            }
            
            return queryHandler(
                "SELECT species_id as species, songtype_id as songtype \n" +
                "WHERE project_class_id = " + mysql.escape(project_class) + "\n" +
                "  AND project_id = " + mysql.escape(project_id), callback);
        },
        
        types: {
            roi_set : {
                
            }
        }
    };
    
    return TrainingSets;
}
    
