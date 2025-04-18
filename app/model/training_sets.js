/* jshint node:true */
"use strict";

// native dependencies
var fs = require('fs');
var util = require('util');


// 3rd party dependencies
var debug = require('debug')('arbimon2:model:training_sets');
var async = require('async');
var joi = require('joi');
var jimp = require('jimp');
var AWS = require('aws-sdk');
var q = require('q');

// local dependencies
var config       = require('../config');
var APIError = require('../utils/apierror');
var tmpfilecache = require('../utils/tmpfilecache');
var sqlutil      = require('../utils/sqlutil');
var dbpool       = require('../utils/dbpool');
var Recordings   = require('./recordings');
var Projects     = require('./projects');

// local variables
var s3;
var queryHandler = dbpool.queryHandler;


// exports
var TrainingSets = {
    /** Finds training sets, given a (non-empty) query.
     * @param {Object} query
     * @param {Object} query.id      find training sets with the given id.
     * @param {Object} query.project find training sets associated to the given project id.
     * @param {Object} query.name    find training sets with the given name (must also provide a project id);
     * @param {Function} callback called back with the queried results.
     */

    findName: function(set_id, callback) {
        var q = "SELECT name \n"+
                "FROM training_sets \n"+
                "WHERE training_set_id = " + dbpool.escape(set_id) + " AND removed=0";

            queryHandler(q, callback);
    },

    find: function (query, callback) {
        var constraints = ["TS.removed=0"];

        if(query) {
            if (query.id) {
                constraints.push('TS.training_set_id = ' + dbpool.escape(query.id));
            }
            else if (query.project) {
                constraints.push('TS.project_id = ' + dbpool.escape(query.project));

                if (query.name) {
                    constraints.push('TS.name = ' + dbpool.escape(query.name));
                }

                if (query.sourceProject) {
                    constraints.push('TS.source_project_id = ' + dbpool.escape(query.sourceProject));
                }
            }
        }

        if(constraints.length === 0){
            return q.reject(new Error("TrainingSets.find called with invalid query.")).nodeify(callback);
        }

        var sql = "SELECT TS.training_set_id as id, \n" +
                "       TS.name, \n" +
                "       TS.date_created, \n" +
                "       TS.project_id as project, TS.source_project_id, \n" +
                "       TS.metadata, \n" +
                "       TST.identifier as type, \n" +
                "       TSRS.species_id as species, \n" +
                "       TSRS.songtype_id as songtype \n" +
                "FROM training_sets TS \n" +
                "JOIN training_set_types TST ON TS.training_set_type_id = TST.training_set_type_id \n" +
                "LEFT JOIN training_sets_roi_set TSRS ON TS.training_set_id = TSRS.training_set_id \n" +
                "WHERE " + constraints.join(" \nAND ") + " \n" +
                "ORDER BY TS.date_created DESC";

        return q.ninvoke(dbpool, 'queryHandler', sql).get(0).nodeify(callback);
    },

    nameInUse: function(project_id, set_name, callback) {
        var sql = "SELECT count(*) as count \n"+
                "FROM training_sets \n"+
                "WHERE name = %s \n" +
                "AND project_id = %s AND removed=0";

        sql = util.format(sql, dbpool.escape(set_name), dbpool.escape(project_id));
        return q.nfcall(queryHandler, sql).get(0).get(0).get('count').then(function(count){
            return (count | 0) > 0;
        }).nodeify(callback);
    },

    totalRfmTrainingJobs: function(projectId) {
        return dbpool.query(`SELECT COUNT(training_set_id) AS count FROM training_sets WHERE project_id = ${dbpool.escape(projectId)} AND removed = 0`).get(0).get('count');
    },

    /** Finds training sets, given a (non-empty) query.
     * @param {Object} data
     * @param {Object} data.project id of the project associated to this training set.
     * @param {Object} data.name   name given to this training set.
     * @param {Object} data.type   type of training set to insert.
     * @param {Function} callback called back with the newly inserted training set, or with errors.
     */
    insert: function (data, callback) {
        if(!data.project_id){
            callback(new Error("Project id is missing."));
            return;
        }
        if(!data.name){
            callback(new Error("Training set name is missing."));
            return;
        }
        var typedef = TrainingSets.types[data.type];
        if(!data.type || !typedef){
            callback(new Error("Training set type " + data.type + " is invalid."));
            return;
        }

        var typedef_action = typedef.insert;
        var scope={};
        var tasks = [];
        if(typedef_action && typedef_action.validate){
            tasks.push(function perform_typedef_extra_validation(cb){
                typedef_action.validate(data, cb);
            });
        }
        tasks.push(dbpool.getConnection);
        tasks.push(function begin_transaction(connection, cb){
            scope.connection = connection;
            scope.connection.beginTransaction(cb);
        });
        tasks.push(function run_insert_query(){
            var cb = Array.prototype.pop.call(arguments);
            scope.in_transaction = true;
            scope.connection.query(
                "INSERT INTO training_sets (project_id, name, date_created, training_set_type_id) \n" +
                "VALUES ("+dbpool.escape(data.project_id)+", "+dbpool.escape(data.name)+", NOW(), "+ dbpool.escape(typedef.id)+")",
            cb);
        });
        tasks.push(function get_insert_id(result){
            var cb = Array.prototype.pop.call(arguments);
            scope.insert_id = result.insertId;
            cb();
        });
        if(typedef_action && typedef_action.extras){
            tasks.push(function perform_typedef_extra_validation(){
                var cb = Array.prototype.pop.call(arguments);
                typedef_action.extras(scope.connection, scope.insert_id, data, cb);
            });
        }
        tasks.push(function commit_transaction() {
            var cb = Array.prototype.pop.call(arguments);
            scope.connection.commit(cb);
        });
        tasks.push(function transaction_commited() {
            var cb = Array.prototype.pop.call(arguments);
            scope.in_transaction = false;
            cb();
        });
        tasks.push(function fetch_newly_inserted_object(result) {
            var cb = Array.prototype.pop.call(arguments);
            TrainingSets.find({id:scope.insert_id}, cb);
        });
        async.waterfall(tasks, function(err, tset){
            if(scope.connection){
                scope.connection.release();
            }
            callback(err, tset);
        });
    },

    shareTrainingSet: async function(opts) {
        const sql_new_ts = `insert into training_sets(project_id, name, date_created, training_set_type_id, removed, source_project_id)
            select ?, ts2.name, ts2.date_created, ts2.training_set_type_id, ts2.removed, ?
            from training_sets ts2
            where ts2.training_set_id = ?;
        `;
        const newInserted = await dbpool.query(sql_new_ts, [opts.projectId, opts.sourceProjectId, opts.trainingSetId])
        const sql_new_ts_rois = `INSERT INTO training_set_roi_set_data (training_set_id, recording_id, species_id, songtype_id, x1, x2, y1, y2, uri)
            SELECT DISTINCT ?, recording_id, species_id, songtype_id, x1, x2, y1, y2, uri
            FROM training_set_roi_set_data
            WHERE training_set_id = ?`
        return await dbpool.query(sql_new_ts_rois, [newInserted.insertId, opts.trainingSetId]);

    /** Insert a combined training set with metadata (term1, term2).
     * @param {Object} data
     * @param {Object} data.projectId id of the project associated to this training set.
     * @param {Object} data.name   name given to this training set.
     * @param {Object} data.term1  training_set_id in format of term1.
     * @param {Object} data.term2  training_set_id in format of term2.
     */
    combine: async function(data) {
        const q = `INSERT INTO training_sets (project_id, name, date_created, training_set_type_id, removed, metadata)
                VALUES (?, ?, NOW(), 1, 0, ?)`
        const newInserted = await dbpool.query(q, [data.projectId, data.name, JSON.stringify({
            term1:data.term1,
            term2:data.term2,
        })])
        const combine_q = `INSERT INTO training_set_roi_set_data (training_set_id, recording_id, species_id, songtype_id, x1, x2, y1, y2, uri)
                        SELECT DISTINCT ?, recording_id, species_id, songtype_id, x1, x2, y1, y2, uri
                        FROM training_set_roi_set_data
                        WHERE training_set_id IN (?, ?)`
        return await dbpool.query(combine_q, [newInserted.insertId, data.term1, data.term2])
    },

    /** Edits a given training set.
     * @param {Object} trainingSet - the training set to edit
     * @param {Object} data
     * @param {Object} data.name   new name for this training set.
     * @param {Object} data.extra  other type-dependent values to modify in the trainingset.
     * @param {Function} callback called back with the newly inserted training set, or with errors.
     * @return {Promise} resolved with the newly edited training set, rejected on any errors.
     */
    edit: function (trainingSet, data, callback) {
        var typedef = TrainingSets.types[trainingSet.type];
        var typedef_action = typedef && typedef.edit;
        var connection;
        var in_transaction = false;

        return q().then(function check_training_set_not_empty(){
            if(!trainingSet){
                throw new APIError("Training set not given.", 422);
            }
        }).then(function check_name_is_valid(){
            if(!data.name){
                throw new APIError("Training set name is missing.", 422);
            }
            if(data.name != trainingSet.name){
                return TrainingSets.nameInUse(trainingSet.project, data.name).then(function(isInUse){
                    if(isInUse){
                        throw new APIError("Name '" + data.name + "' is already in use", 409);
                    }
                });
            }
        }).then(function perform_typedef_extra_validation(){
            if(typedef_action.validate){
                return typedef_action.validate(trainingSet, data);
            }
        }).then(function get_connection(){
            return dbpool.getConnection().then(function(_connection){ // released
                connection = _connection;
            });
        }).then(function begin_transaction(){
            return q.ninvoke(connection, 'beginTransaction').then(function(){
                in_transaction = true;
            });
        }).then(function run_main_update_query(){
            return q.ninvoke(connection, 'query',
                "UPDATE training_sets\n" +
                "SET name = ? \n" +
                "WHERE training_set_id = ?",
                [data.name, trainingSet.id]
            );
        }).then(function run_typedef_dependent_update_query(){
            if(typedef_action.extras){
                return typedef_action.extras(connection, trainingSet.id, data);
            }
        }).then(function commit_transaction() {
            return q.ninvoke(connection, 'commit').then(function(){
                in_transaction = false;
            });
        }).then(function fetch_newly_edited_object() {
            return TrainingSets.find({id:trainingSet.id});
        }).finally(function(){
            if(connection){
                connection.release();
            }
        }).nodeify(callback);
    },




    /** Removes a given training set.
     * @param {Object} trainingSet - the training set to edit
     * @param {Function} callback called back with the newly inserted training set, or with errors.
     * @return {Promise} resolved with the newly edited training set, rejected on any errors.
     */
    remove: function (trainingSet) {
        var typedef = TrainingSets.types[trainingSet.type];
        var typedef_action = typedef && typedef.edit;
        var connection;
        var in_transaction = false;

        if(!trainingSet){
            return q.reject(new APIError("Training set not given.", 422));
        }

        return q.nfcall(queryHandler, dbpool.format(
            "UPDATE training_sets\n" +
            "SET removed = 1 \n" +
            "WHERE training_set_id = ?",
            [trainingSet.id]
        ));
    },

    /** Adds data to the given training set.
     * @param {Object}  training_set  training set object as returned by find().
     * @param {Object}  data data to add to the training set. The properties in
     *                  allowed in this object depend on the type of training set.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    addData: function (training_set, data, callback) {
        TrainingSets.types[training_set.type].add_data(training_set, data, callback);
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

        var typedef = TrainingSets.types[training_set.type];

        return typedef.get_data(training_set, query, callback);
    },

    /** Fetches a training set's rois
     *  @param {Object}  training_set
     *  @param {Object}  options - set of options
     *  @param {Boolean|Object}  options.stream - whether to stream the results, or not. If an object, then
     *                           it is passed to mysql.query(...).stream() (default:false).
     *  @param {Boolean} options.resolveIds - whether to resolve foreign key ids to their associated names or not (default:false).
     *  @param {Boolean} options.noURI - whether to return uris to any associated resource (default:false).
     *  @param {Function} callback(err, path) function to call back with the results, or a stream of them, if options.stream is true.
     */
    fetchRois: function (training_set, options, callback) {
        var typedef = TrainingSets.types[training_set.type];
        return typedef.get_rois(training_set, options, callback);
    },

    /** Fetches the image of a training set's data element
     *  @param {Object}  training_set
     *  @param {Object}  dataId id of the data element
     *  @param {Function} callback(err, path) function to call back with the results.
     */
    fetchDataImage: function(training_set, data_id, callback){
        var typedef = TrainingSets.types[training_set.type];
        if(typedef.fetch_data_image){
            return typedef.fetch_data_image(training_set, data_id, callback);
        } else {
            callback(new Error("Not supported by training set type."));
        }
    },

    removeRoi: function (roi_id, training_set, callback) {
        var typedef = TrainingSets.types[training_set.type];
        return typedef.remove_roi(roi_id, callback);
    },

    /** Fetches a training set's species and songtype
     *  @param {Object}  training_set
     *  @param {Function} callback(err, path) function to call back with the results.
     */
    fetchSpecies: function (training_set, callback) {
        var typedef = TrainingSets.types[training_set.type];
        typedef.get_species(training_set, callback);
    },

    /** Fetches the available training set types.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    getTypes: function (callback) {
        return queryHandler(
            "SELECT training_set_type_id as id, name, identifier, description \n" +
            "FROM training_set_types \n", callback);
    },
    /** Type-specific training set function implementations.
     */
    types: {}
};

TrainingSets.types.roi_set = {
    id    : 1,
    table : 'training_set_roi_set_data TSD',
    primary_key : 'TSD.roi_set_data_id',
    fields: ['TSD.recording_id as recording', 'TSD.species_id as species', 'TSD.songtype_id as songtype', 'TSD.x1', 'TSD.y1', 'TSD.x2', 'TSD.y2'],
    insert : {
        validate : function(data, callback){
            if (data.extras && data.extras.class) {
                Projects.getProjectClasses( data.project_id, data.extras.class, function(err, classes){
                    if(err) {
                        callback(err);
                    } else if(!classes || !classes.length) {
                        callback(new Error("Project class is invalid."));
                    } else {
                        data.species  = classes[0].species;
                        data.songtype = classes[0].songtype;
                        callback();
                    }
                });
            } else if (data.extras && data.extras.species && data.extras.songtype) {
                data.species  = data.extras.species;
                data.songtype = data.extras.songtype;
            } else {
                callback(new Error("Project class is invalid."));
            }
        },
        extras   : function(connection, tset_id, data, callback){
            connection.query(
                "INSERT INTO training_sets_roi_set (training_set_id, species_id, songtype_id) \n" +
                "VALUES ("+dbpool.escape([tset_id, data.species, data.songtype])+")",
            callback);
        }
    },
    edit : {
        /** Validates the data so its fit for editing the training set.
         * @param {Object} data
         * @return {Promise} resolved if the data is fit, rejected otherwise.
         */
        validate : function(trainingSet, data){
            if (data.extras && data.extras.class) {
                return q.nfcall(Projects.getProjectClasses, trainingSet.project, data.extras.class).then(function(classes){
                    if(!classes || !classes.length) {
                        throw new APIError("Project class is invalid.", 422);
                    }

                    data.species  = classes[0].species;
                    data.songtype = classes[0].songtype;

                    return [data.species, data.songtype];
                });
            } else if (data.extras && data.extras.species && data.extras.songtype) {
                data.species  = data.extras.species;
                data.songtype = data.extras.songtype;
                return q([data.species, data.songtype]);
            } else {
                return q.reject(new APIError("Project class is invalid.", 422));
            }
        },
        /** Updates the roi_set data of the associated training set.
         * @param {Integer} tset_id - id of the associated training set
         * @param {Object} data - data to update
         * @return {Promise} resolved if the data is fit, rejected otherwise.
         */
        extras   : function(connection, tset_id, data){
            return q.ninvoke(connection, 'query',
                "UPDATE training_sets_roi_set\n"+
                "SET species_id = ?, songtype_id = ?\n"+
                "WHERE training_set_id = ?",
                [data.species, data.songtype, tset_id]
            );
        }
    },
    data_schema : joi.object().keys({
        species   : joi.number().integer().default(joi.ref('$species')),
        songtype  : joi.number().integer().default(joi.ref('$songtype')),
        recording : joi.number().integer(),
        roi : joi.object().keys({
            x1 : joi.number().unit('seconds'),
            y1 : joi.number().unit('hertz'),
            x2 : joi.number().unit('seconds'),
            y2 : joi.number().unit('hertz')
        })
    }),
    /** Creates a roi image
     * @param {Object} training_set           - training set object
     * @param {Object} data                   - training set data element, as returned by get_data
     */
    create_data_image : function (training_set, rdata, callback){
        debug('create_data_image');
        var s3key = 'project_'+training_set.project+'/training_sets/'+training_set.id+'/'+rdata.id+'.png';
        rdata.uri = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + s3key;
        let rec_data, rec_stats, spec_data, isLegacy;

        return Recordings.findByUrlMatch(rdata.recording, 0, {limit:1})
        .then(data => rec_data = data[0])
        .then((rec_data) => {
            isLegacy = Recordings.isLegacy(rec_data)
            if (isLegacy) {
                return Promise.all([
                    q.ninvoke(Recordings, 'fetchInfo', rec_data).then(data => rec_stats = data),
                    q.ninvoke(Recordings, 'fetchSpectrogramFile', rec_data).then(data => spec_data = data)
                ])
            }
            const opts = {
                uri: rec_data.uri,
                external_id: rec_data.external_id,
                datetime: rec_data.datetime,
                datetime_utc: rec_data.datetime_utc,
                template: true
            }
            const filter = {
                maxFreq: Math.max(rdata.y1, rdata.y2),
                minFreq: Math.min(rdata.y1, rdata.y2),
                trim: {
                    from: Math.min(rdata.x1, rdata.x2),
                    to: Math.max(rdata.x1, rdata.x2)
                }
            }
            return q.ninvoke(Recordings, 'fetchTemplateFile', opts, filter)
        }).then(data => {
            if (data && data.path) {
                spec_data = data
            }
        }).then(() => jimp.read(spec_data.path))
          .then((spectrogram) => {
            if (isLegacy) {
                const px2sec = rec_data.duration/spectrogram.bitmap.width;
                const max_freq = rec_data.sample_rate/2;
                const px2hz  = max_freq/spectrogram.bitmap.height;

                const left = Math.floor(rdata.x1/px2sec);
                const top = spectrogram.bitmap.height-Math.floor(rdata.y2/px2hz);
                const right = Math.ceil(rdata.x2/px2sec);
                const bottom = spectrogram.bitmap.height-Math.floor(rdata.y1/px2hz);

                const roi = spectrogram.clone().crop(left, top, right - left, bottom - top);
                return roi.getBufferAsync(jimp.MIME_PNG);
            }
            const roi = spectrogram.clone()
            return roi.getBufferAsync(jimp.MIME_PNG);
        }).then((roiBuffer) => {
            if(!s3){
                s3 = new AWS.S3();
            }
            return s3.putObject({
                Bucket: config('aws').bucketName,
                Key: s3key,
                ACL: 'public-read',
                Body: roiBuffer
            }).promise();
        }).then(() => {
            if (spec_data && spec_data.path) {
                fs.unlink(spec_data.path, function (err) {
                    if (err) console.error('Error deleting the template file.', err);
                    console.info('Template file deleted.');
                })
            }
            const q = "UPDATE training_set_roi_set_data \n"+
                    "SET uri = ? \n"+
                    "WHERE roi_set_data_id = ?";
            return dbpool.query(dbpool.format(q, [s3key, rdata.id]));
        }).then(() => {
            callback(null, rdata);
        });
    },

    fetch_data_image : function (training_set, data_id, callback){
        var self = this, data;
        async.waterfall([
            function fetch_tset_data(next){
                self.get_data(training_set, {id:data_id}, next);
            },
            function check_and_get_tset_data(rows, fields, next){
                if(!rows.length) {
                    next(new Error("Requested training set data does not exists."));
                    return;
                }
                data = rows[0];
                next();
            },
            function create_img_or_just_return(next){
                if(!data.uri){
                    self.create_data_image(training_set, data, next);
                } else {
                    next(null, data);
                }
            }
        ], callback);
    },
    get_rois : function(training_set, options, callback) {
        var uri_prefix = 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/';
        var fields=["TSD.roi_set_data_id as id"];
        var tables=["training_set_roi_set_data TSD"];
        if(options && options.resolveIds){
            fields.push("SUBSTRING_INDEX(R.uri,'/',-1) as recording", "Sp.scientific_name as species", "Sng.songtype as songtype");
            tables.push(
                "JOIN recordings R ON R.recording_id = TSD.recording_id",
                "JOIN species Sp ON Sp.species_id = TSD.species_id",
                "JOIN songtypes Sng ON Sng.songtype_id = TSD.songtype_id"
            );
        } else {
            fields.push("TSD.recording_id as recording", "TSD.species_id as species", "TSD.songtype_id as songtype");
        }

        fields.push(
            "TSD.x1",
            "ROUND(TSD.y1,0) as y1",
            "TSD.x2",
            "ROUND(TSD.y2,0) as y2",
            "ROUND(TSD.x2-TSD.x1,1) as dur",
            "ROUND(TSD.y2-TSD.y1,1) as bw"
        );
        if(!options || !options.noURI){
            fields.push("CONCAT(" + dbpool.escape(uri_prefix) + ",TSD.uri) as uri");
        }

        return queryHandler(
            'SELECT ' + fields.join(',') + '\n' +
            'FROM ' + tables.join('\n') + '\n' +
            'WHERE TSD.training_set_id = ' + dbpool.escape(training_set.id),
            options,
            callback
        );
    },
    get_species : function(training_set, callback) {
        var q = "SELECT S.scientific_name as species, \n"+
                "       SG.songtype \n"+
                "FROM training_sets_roi_set AS TRS \n"+
                "JOIN songtypes AS SG ON TRS.songtype_id = SG.songtype_id \n"+
                "JOIN species AS S ON TRS.species_id = S.species_id \n"+
                "WHERE TRS.training_set_id = ?";

        queryHandler(dbpool.format(q, [training_set.id]), callback);
    },
    remove_roi : function(roi_id, callback) {
        return queryHandler(
            "delete from training_set_roi_set_data where roi_set_data_id = "+roi_id,
            callback
        );
    },
    /** Fetches a training set's data, optionally using a query.
     * @param {Object}  training_set  training set object as returned by find(), must be of type roi_set.
     * @param {Object}  query (optional)
     * @param {Object}  query.recording limit data results to those belonging to the matching recordings
     * @param {Object}  query.id        limit tset data to the row with the given id.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    get_data : function(training_set, query, callback) {
        var constraints = ['TSD.training_set_id = ' + dbpool.escape(training_set.id)];
        var tables = ['training_set_roi_set_data TSD'];

        if(query.id){
            constraints.push('TSD.roi_set_data_id = ' + dbpool.escape(query.id));
            return queryHandler(
                "SELECT TSD.roi_set_data_id as id, TSD.recording_id as recording,\n"+
                "   TSD.species_id as species, TSD.songtype_id as songtype,  \n" +
                "   TSD.x1, TSD.y1, TSD.x2, TSD.y2 , \n"+
                "   CONCAT('https://"+config('aws').bucketName+".s3."+config('aws').region+".amazonaws.com/',TSD.uri) as uri \n" +
                "FROM "   + tables.join(" \n" +
                "JOIN ")+ " \n" +
                "WHERE " + constraints.join(" \n" +
                "  AND "), callback);
        } else if(query.recording){
            Recordings.parseUrlQuery(query.recording).then(function(req_query){
                constraints.push.apply(constraints, sqlutil.compile_query_constraints(
                    req_query,
                    Recordings.QUERY_FIELDS
                ));
                tables.push(
                    'recordings R ON TSD.recording_id = R.recording_id',
                    'sites S ON R.site_id = S.site_id'
                );
                return queryHandler(
                    "SELECT TSD.roi_set_data_id as id, TSD.recording_id as recording,\n"+
                    "   TSD.species_id as species, TSD.songtype_id as songtype,  \n" +
                    "   TSD.x1, TSD.y1, TSD.x2, TSD.y2 , \n"+
                    "   CONCAT('https://"+config('aws').bucketName+".s3."+config('aws').region+".amazonaws.com/',TSD.uri) as uri \n" +
                    "FROM "   + tables.join(" \n" +
                    "JOIN ")+ " \n" +
                    "WHERE " + constraints.join(" \n" +
                    "  AND "), callback);
            }, callback);
        }
    },
    /** Adds data to a training set.
     * @param {Object}  training_set  training set object as returned by find(), must be of type roi_set.
     * @param {Object}  data data to add, follows the schema in data_schema.
     * @param {Function} callback(err, path) function to call back with the results.
     */
    add_data : function(training_set, data, callback){
        var self = this;
        async.waterfall([
            function(next){
                joi.validate(data, self.data_schema, {context:training_set},next);
            },
            function(vdata, next){
                var x1 = Math.min(vdata.roi.x1, vdata.roi.x2), y1 = Math.min(vdata.roi.y1, vdata.roi.y2);
                var x2 = Math.max(vdata.roi.x1, vdata.roi.x2), y2 = Math.max(vdata.roi.y1, vdata.roi.y2);

                dbpool.queryHandler(
                    "INSERT INTO training_set_roi_set_data(training_set_id, recording_id, species_id, songtype_id, x1, y1, x2, y2) \n" +
                    "VALUES ("+dbpool.escape([
                        training_set.id, vdata.recording, vdata.species, vdata.songtype,
                        x1, y1, x2, y2
                    ])+")",
                    next
                );
            },
            function(result, fields, next){
                self.get_data(training_set, {id:result.insertId}, next);
            },
            function(rows, fields, next){
                data = rows[0];
                next(null,data);
            },
            function (data, next) {
                self.create_data_image(training_set, data, next);
            }
        ], callback);
    },

};

module.exports = TrainingSets;
