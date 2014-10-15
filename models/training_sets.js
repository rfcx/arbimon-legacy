// dependencies
var mysql        = require('mysql');
var models       = require('../models');
var sqlutil      = require('../utils/sqlutil');

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
                    constraints.push('TS.training_set_id = ' + mysql.escape(query.id));
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
                "SELECT TS.training_set_id as id, TS.name, TS.date_created, TST.identifier as type, \n" +
                "    TSRS.species_id as TT_roi_set_TT_species, TSRS.songtype_id as TT_roi_set_TT_songtype \n" +
                "FROM training_sets TS \n" +
                "JOIN training_set_types TST ON TS.training_set_type_id = TST.training_set_type_id \n" +
                "LEFT JOIN training_set_roi_set TSRS ON TS.training_set_id = TSRS.training_set_id \n" +
                "WHERE " + constraints.join(" \n" +
                "  AND "
            ), function(err, data, fields){
                if(!err && data){
                    var ttfields=[];
                    fields.forEach(function(fielddef){
                        var m = /TT_(\w+)_TT_(\w+)/.exec(fielddef.name);
                        if(m){
                            ttfields.push([m[0], m[1], m[2]]);
                        }
                    })
                    data.forEach(function(item){
                        var tt = item['type'];
                        ttfields.forEach(function(ttfield){
                            var val = item[ttfield[0]];
                            delete item[ttfield[0]];
                            if(tt == ttfield[1]){
                                item[ttfield[2]] = val;
                            }
                        })
                    });
                }
                callback(err, data);
            });
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
                "INSERT INTO training_sets (project_id, name, date_created, training_set_type_id) \n" +
                "VALUES ("+mysql.escape(data.project)+", "+mysql.escape(data.name)+", NOW(), "+ mysql.escape(data.type)+")",
            function(err, result) {
                if (err) throw err;
                TrainingSets.find({id:result.insertId}, callback);
            });
        },

        /** Fetches a training set's data, optionally using a query.
         * @param {Object}  training_set  training set object as returned by find().
         * @param {Object}  query (optional)
         * @param {Object}  query.recording limit data results to those belonging to the matching recordings
         * @param {Function} callback(err, path) function to call back with the results.
         */
        fetchData: function (training_set, query, callback) {
            if(query instanceof Function) {
                callback = query;
                query = null;
            }
            if(!query) {
                query = {};
            }

            var type = TrainingSets.types[training_set.type];
            var fields = [type.primary_key + ' as id'];
            if (type.fields) {
                fields.push.apply(fields, type.fields);
            }
            var constraints = ['TSD.training_set_id = ' + mysql.escape(training_set.id)];
            var tables = [type.table];

            if(query.recording) {
                var req_query = models.recordings.parseUrlQuery(query.recording);
                constraints.push.apply(constraints, sqlutil.compile_query_constraints(
                    models.recordings.parseUrlQuery(query.recording),
                    models.recordings.QUERY_FIELDS
                ));
                tables.push(
                    'recordings R ON TSD.recording_id = R.recording_id',
                    'sites S ON R.site_id = S.site_id'
                );
            }

            return queryHandler(
                "SELECT " + fields.join(",")+ " \n" +
                "FROM "   + tables.join(" \n" +
                "JOIN ")+ " \n" +
                "WHERE " + constraints.join(" \n" +
                "  AND "), callback);
        },

        /** Fetches the available training set types.
         * @param {Function} callback(err, path) funciton to call back with the results.
         */
        getTypes: function (callback) {
            return queryHandler(
                "SELECT training_set_type_id as id, name, identifier, description \n" +
                "FROM training_set_types \n", callback);
        },

        /** Type-specific training set function implementations.
         */
        types: {
            roi_set : {
                table : 'training_set_roi_set_data TSD',
                primary_key : 'TSD.roi_set_data_id',
                fields: ['TSD.recording_id as recording', 'TSD.species_id as species', 'TSD.songtype_id as songtype', 'TSD.x1', 'TSD.y1', 'TSD.x2', 'TSD.y2']
            }
        }
    };

    return TrainingSets;
}
