/* jshint node:true */
"use strict";

var util = require('util');
var q = require('q');
var async = require('async');
var debug = require('debug')('arbimon2:models:jobs');
var joi   = require('joi');

var dbpool = require('../utils/dbpool');
var sqlutil = require('../utils/sqlutil');
var arrays_util  = require('../utils/arrays');
var queryHandler = dbpool.queryHandler;


// TODO define jobs as module that are require, and user db identifier field to
// find the job parmas table as job_params_identifier, this way jobs can be
// more plugable
var Jobs = {
    job_types : {
        training_job : {
            type_id : 1,
            new : function(params, db) {
                return q.ninvoke(db, 'query',
                    "INSERT INTO `job_params_training` (`job_id`, `model_type_id`, \n" +
                    " `training_set_id`, `validation_set_id`, `trained_model_id`, \n" +
                    " `use_in_training_present`,`use_in_training_notpresent`,`use_in_validation_present`,`use_in_validation_notpresent` ,`name` \n" +
                    ") VALUES ( \n" +
                        dbpool.escape([params.job_id, params.classifier,
                            params.train, null, null,
                            params.upt, params.unt, params.upv, params.unv, params.name
                        ]) + "\n" +
                    ")"
                );
            },
            sql : {
                report : {
                    projections : ['CONCAT(UCASE(LEFT( JPT.`name`, 1)), SUBSTRING( JPT.`name`, 2)) as name'],
                    tables      : ['JOIN `job_params_training` as JPT ON J.job_id = JPT.job_id'],
                }
            }
        },
        classification_job : {
            type_id : 2,
            new: function(params, db) {
                return q.ninvoke(db, 'query',
                    "INSERT INTO `job_params_classification` (\n" +
                    "   `job_id`, `model_id`, `playlist_id` ,`name` \n" +
                    ") VALUES ( \n" +
                    "   " + dbpool.escape([params.job_id, params.classifier, params.playlist, params.name]) + "\n" +
                    ")"
                );
            },
            sql : {
                report : {
                    projections : ['CONCAT(UCASE(LEFT( JPT.`name`, 1)), SUBSTRING( JPT.`name`, 2)) as name'],
                    tables      : ['JOIN `job_params_classification` as JPT ON J.job_id = JPT.job_id'],
                }
            }
        },
        soundscape_job: {
            type_id : 4,
            new: function(params, db) {
                return q.ninvoke(db, 'query',
                    "INSERT INTO `job_params_soundscape`( \n"+
                    "   `job_id`, `playlist_id`, `max_hertz`, `bin_size`, `soundscape_aggregation_type_id`, `name`, `threshold` , `threshold_type` , `frequency` , `normalize` \n" +
                    ") VALUES ( \n" +
                    "    " + dbpool.escape([params.job_id, params.playlist, params.maxhertz, params.bin]) + ", \n"+
                    "    (SELECT `soundscape_aggregation_type_id` FROM `soundscape_aggregation_types` WHERE `identifier` = " + dbpool.escape(params.aggregation) + "), \n" +
                    "    " + dbpool.escape([params.name, params.threshold, params.threshold_type, params.frequency , params.normalize]) + " \n" +
                    ")"
                );
            },
            sql : {
                report : {
                    projections : ['CONCAT(UCASE(LEFT( JPT.`name`, 1)), SUBSTRING( JPT.`name`, 2)) as name'],
                    tables      : ['JOIN `job_params_soundscape` as JPT ON J.job_id = JPT.job_id'],
                }
            }
        },
        audio_event_detection_job: {
            type_id : 5,
            schema : joi.object().keys({
                project : joi.number().integer(),
                user : joi.number().integer(),
                name       : joi.string(),
                playlist   : joi.number().integer(),
                configuration : joi.number().integer(),
                statistics : joi.array().items(joi.string()),
            }),
            new: function(params, db) {
                return q.ninvoke(db, 'query',
                    "INSERT INTO `job_params_audio_event_detection`( \n"+
                    "   `job_id`, `name`, `playlist_id`, `configuration_id`, `statistics`\n" +
                    ") VALUES (?, ?, ?, ?, ?)", [
                        params.job_id, params.name, params.playlist, params.configuration, JSON.stringify(params.statistics)
                    ]
                );
            },
            sql : {
                report : {
                    projections : ['CONCAT(UCASE(LEFT( JPT.`name`, 1)), SUBSTRING( JPT.`name`, 2)) as name'],
                    tables      : ['JOIN `job_params_audio_event_detection` as JPT ON J.job_id = JPT.job_id'],
                }
            }
        },
        pattern_matching_job: {
            type_id : 6,
            schema : joi.object().keys({
                project    : joi.number().integer(),
                user       : joi.number().integer(),
                name       : joi.string(),
                playlist   : joi.number().integer(),
                template   : joi.number().integer(),
                params     : joi.object().keys({
                    N: joi.number().integer(),
                    threshold: joi.number(),
                }),
            }),
            new: function(params, db) {
                return q.ninvoke(db, 'query',
                    "INSERT INTO `job_params_pattern_matching`( \n"+
                    "   `job_id`, `name`, `playlist_id`, `template_id`, `params`\n" +
                    ") VALUES (?, ?, ?, ?, ?)", [
                        params.job_id, params.name, params.playlist, params.template, JSON.stringify(params.params)
                    ]
                );
            },
            sql : {
                report : {
                    projections : ['CONCAT(UCASE(LEFT( PMS.`name`, 1)), SUBSTRING( PMS.`name`, 2)) as name'],
                    tables      : ['JOIN `pattern_matchings` as PMS ON J.job_id = PMS.job_id'],
                }
            }
        },
    },

    /** Creates a new job given the parameters and job type.
     *  @param {Object} params - job parameters
     *  @param {String} type - job type
     *  @param {Function} callback - callback to return the id of the created job.
     */
    newJob: function(params, type, callback) {
        var job_type = this.job_types[type];
        if(!job_type){
            callback(new Error("Invalid job type " + type + "."));
            return;
        }

        var db;
        var job_id;
        return dbpool.query(
            "SELECT enabled FROM job_types WHERE job_type_id = ?", [
            job_type.type_id
        ]).then(function(rows) {
            if(!rows.length) {
                throw new Error('Job type not found on DB');
            } else if(!rows[0].enabled) {
                throw new Error('Job type not enabled');
            }
        }).then(function(){
                if(job_type.schema){
                    return q.ninvoke(joi, 'validate', params, job_type.schema);
                }
        }).then(function(){
            return q.ninvoke(dbpool, 'getConnection');
        }).then(function start_transaction(connection){
            var tx = new sqlutil.transaction(db = connection);
            return tx.perform(function(){
                return q.ninvoke(db, 'query',
                    "INSERT INTO `jobs` ( \n" +
                    "   `job_type_id`, `date_created`, `last_update`, `project_id`, `user_id`, `uri`, `remarks` \n" +
                    ") VALUES (?, now(), now(), ?, ?,'',''" +
                    ")", [
                        job_type.type_id, params.project, params.user
                    ]
                ).get(0).then(function get_job_id(result){
                    params.job_id = job_id = result.insertId;

                    return job_type.new(params, db);
                }).then(function(){
                    return job_id;
                });
            }).finally(function(){
                connection.release();
            });
        }).nodeify(callback);
    },

    /** Fetches the job types from the database, returning them through a callback.
     *  @param {Function} callback - callback to return the job types to.
     */
    getJobTypes: function(callback){
        var q = "SELECT job_type_id as id, name, description, enabled \n"+
                "FROM job_types";
        queryHandler(q, callback);
    },

    /** Sets the hidden flag for the given job id.
     *  @param {int} jId - job id to set the flag to.
     *  @param {Function} callback - callback to return after setting the flag.
     */
    hide: function(jId, callback) {
        var q = "update `jobs` set `hidden`  = 1 where `job_id` = ?";

        queryHandler(q, [jId], callback);
    },

    /** Sets the cancel_requestted flag for the given job id.
     *  @param {int} jId - job id to set the flag to.
     *  @param {Function} callback - callback to return after setting the flag.
     */
    cancel: function(jId, callback) {
        var q = "update `jobs` set `cancel_requested`  = 1 where `job_id` = ?";

        queryHandler(q, [jId], callback);
    },

    /** Queries the database to search if a given classification name already exists for a given project.
     *  @param {Object} p - parameters object.
     *  @param {Object} p.pid - id of the project.
     *  @param {Object} p.name - name to search for.
     *  @param {Function} callback - callback to return with the search results
     */
    classificationNameExists: function(p, callback) {
        var q = "SELECT count(*) as count FROM `jobs` J ,  `job_params_classification` JPC " +
            "WHERE `project_id` = ?\n" +
            "  AND `job_type_id` = 2\n" +
            "  AND J.`job_id` = JPC.`job_id`\n" +
            "  AND `name` like ? ";

        queryHandler(q, [p.pid, p.name], callback);
    },

    /** Queries the database to search if a given model name already exists for a given project.
     *  @param {Object} p - parameters object.
     *  @param {Object} p.pid - id of the project.
     *  @param {Object} p.name - name to search for.
     *  @param {Function} callback - callback to return with the search results
     */
    modelNameExists: function(p, callback) {
        var q = "SELECT count(*) as count FROM `jobs` J ,  `job_params_training` JPC " +
            " WHERE `project_id` = ? and `job_type_id` = 1 and J.`job_id` = JPC.`job_id` " +
            " and `name` like ? ";

        queryHandler(q, [p.pid, p.name], callback);
    },


    /** Queries the database to search if a given soundscape name already exists for a given project.
     *  @param {Object} p - parameters object.
     *  @param {Object} p.pid - id of the project.
     *  @param {Object} p.name - name to search for.
     *  @param {Function} callback - callback to return with the search results
     */
    soundscapeNameExists: function(p, callback) {
        var q = "SELECT count(*) as count FROM `soundscapes` WHERE `project_id` = ? and `name` LIKE ?";

        queryHandler(q, [p.pid, p.name], callback);
    },

    /** Queries for the set of currently running jobs in the database for a given project, optionally.
     *  @param {Integer|Object} project - associated project (optional). Integers are treaded as {id:#}
     *  @param {Integer} project.id - project id (optional).
     *  @param {String} project.url - project url (optional).
     *  @param {Function} callback - callback to return with the search results
     */
    activeJobs: function(project, callback) {
        if(project instanceof Function){
            callback = project;
            project = undefined;
        }

        var union=[], constraints=[], tables=[];

        constraints.push("J.`hidden` = 0");
        tables.push("JOIN job_types JT ON J.job_type_id = JT.job_type_id");

        if(project){
            if(typeof project != 'object'){
                project = {id:project};
            }
            if(project.id){
                constraints.push('J.project_id = ' + (project.id|0));
            }
            else if(project.url){
                constraints.push('P.url = ' + dbpool.escape(project.url));
                tables.push('JOIN projects P ON J.project_id = P.project_id');
            }
        }

        var union = Object.keys(this.job_types).map(i => {
            var job_type = this.job_types[i];
            var jt_projections = job_type.sql && job_type.sql.report && job_type.sql.report.projections;
            var jt_tables      = job_type.sql && job_type.sql.report && job_type.sql.report.tables;
            return (
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                (jt_projections && jt_projections.length ?
                    "    "+jt_projections.join(", ")+",\n" : ""
                ) +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n"+
                "FROM `jobs` as J \n" +
                (jt_tables && jt_tables.length ?
                    "    "+jt_tables.join("\n")+"\n" : ""
                ) +
                "    " + tables.join("\n") + "\n" +
                "WHERE "+constraints.join(" AND ") + "\n" +
                "  AND J.job_type_id = " + (job_type.type_id|0)
            );
        });

        queryHandler("(\n" + union.join("\n) UNION (\n") + "\n)", callback);
    },


    /** Finds jobs, given a (non-empty) query.
     * @param {Object}  query
     * @param {Integer} query.id        find jobs with the given id.
     * @param {String}  query.type      find jobs with the given type (must be a key from Jobs.job_types).
     * @param {Integer} query.user      find jobs with the given user id.
     * @param {Integer} query.state     find jobs with the given state.
     * @param {Integer} query.hidden    find jobs with the given hidden.
     * @param {Integer} query.project   find jobs with the given project id.
     * @param {Integer} query.completed find jobs that are completed.
     * @param {Object} options options object that modify returned results (optional).
     * @param {Boolean} options.id_only Whether to return the job ids only.
     * @param {Boolean} options.unpack_single Whether to unpack the row from the array if the result is a single row.
     * @param {String} options.compute other (computed) attributes to show on returned jobs. Computable attributes are :
     *                            - per_type_data : data that depends on the job type
     * @param {Function} callback called back with the queried results.
     */
    find: function(query, callback) {
        if(query instanceof Function){
            callback = query;
            query = {};
        }

        var q = "SELECT j.job_id, \n"+
                "       j.progress, \n"+
                "       j.progress_steps, \n"+
                "       j.state, \n"+
                "       j.completed, \n"+
                "       u.login as user, \n"+
                "       p.name as project, \n"+
                "       j.project_id, \n"+
                "       j.date_created AS created, \n"+
                "       j.last_update, \n"+
                "       jt.name as type, \n"+
                "       j.hidden, \n"+
                "       j.remarks, \n"+
                "       j.cancel_requested \n"+
                "FROM jobs AS j \n"+
                "JOIN users AS u ON j.user_id = u.user_id \n"+
                "JOIN projects AS p ON j.project_id = p.project_id \n"+
                "JOIN job_types AS jt ON j.job_type_id = jt.job_type_id \n";


        var where = [];

        if(typeof query.is === 'string') {
            query.is = [query.is];
        }
        if(query.is) {
            if(query.is.indexOf('visible') > -1) {
                where.push('j.hidden = 0');
            }
            if(query.is.indexOf('hidden') >  -1) {
                where.push('j.hidden = 1');
            }
            if(query.is.indexOf('completed') > -1) {
                where.push('j.completed = 1');
            }
        }

        if(query.states) {
            where.push('j.state IN ('+ dbpool.escape(query.states)+')');
        }

        if(query.types) {
            where.push('j.job_type_id IN ('+ dbpool.escape(query.types)+')');
        }

        if(query.project_id) {
            where.push('j.project_id IN ('+ dbpool.escape(query.project_id)+')');
        }

        if(query.user_id) {
            where.push('j.user_id IN ('+ dbpool.escape(query.user_id)+')');
        }

        if(query.project) {
            where.push('p.name IN ('+ dbpool.escape(query.project)+')');
        }

        if(query.user) {
            where.push('u.login IN ('+ dbpool.escape(query.user)+')');
        }

        if(query.job_id) {
            where.push('j.job_id IN ('+ dbpool.escape(query.job_id)+')');
        }


        if(where.length) {
            q += 'WHERE ' + where.join(' \nAND ');
        }

        q += '\n ORDER BY j.job_id DESC \n'+
             'LIMIT 0, 100';

        queryHandler(q, callback);

    },

    /** Sets the state of the given job.
     * @param {Object}  job - given job object
     * @param {Integer} job.id  - id of the job
     * @param {String} new_state state to set the given job to.
     * @param {Function} callback called back with the queried results.
     */
    set_job_state: function(job, new_state, callback){
        queryHandler(
            "UPDATE jobs \n"+
            "SET state = ?,\n" +
            "    last_update = NOW() \n" +
            "WHERE job_id = ?", [
                new_state,
                job.id | 0
            ],
        callback);
    },

    /** Returns the type id of the given job, if it is supported, otherwise null.
     * @param {Object}  job - given job object
     * @param {Integer} job.type_id  - type of id of the job
     * @param {Integer} type id of the job is this job type is supported.
     */
    get_job_type : function(job){
        var job_types = Jobs.job_types, job_type;
        for(var i in job_types){
            if(job_types[i].type_id == job.type_id){
                return job.type_id;
            }
        }
        return null;
    },

    /** Computes a summary of the current jobs status, by job type.
    * @param {Function} callback called back current jobs status, by job type.
    */
    status: function(callback) {
        Jobs.getJobTypes(function(err, rows) {
            if(err) return callback(err);

            async.map(rows, function(jobType, next) {
                var getLast5Jobs =
                    "SELECT state \n"+
                    "FROM `jobs` \n"+
                    "WHERE job_type_id = ? \n"+
                    "AND state IN ('completed', 'error', 'canceled', 'stalled') \n"+
                    "ORDER BY job_id DESC \n"+
                    "LIMIT 0, 10";

                queryHandler(getLast5Jobs, [jobType.id], function(err, rows) {
                    if(err) return next(err);

                    var result = {};
                    var status;

                    rows.forEach(function(job) {
                        if(!result[job.state])
                            result[job.state] = 0;

                        result[job.state]++;
                    });

                    var percentCompleted = result.completed/rows.length;

                    // no jobs of this type
                    if(isNaN(percentCompleted)) {
                        status = 'no_data';
                    }
                    // last ten jobs were successful
                    else if(percentCompleted >= 1) {
                        status = 'ok';
                    }
                    // 20% or less of the jobs had a problem
                    else if(percentCompleted >= 0.8) {
                        status = 'warning';
                    }
                    // more than 20% of the jobs had a problem
                    else {
                        status = 'red_alert';
                    }

                    next(null, {
                        name: jobType.name,
                        status: status,
                        enabled: jobType.enabled
                    });
                });
            }, callback);
        });

    },

    // __compute_per_type_data: function(job, callback){
    //     var job_type = Jobs.get_job_type(job);
    //     if(job_type){
    //         job_type.fetch_per_type_data(job, callback);
    //     } else {
    //         callback();
    //     }
    // }

};

module.exports = Jobs;
