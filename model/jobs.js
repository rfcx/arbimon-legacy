var util = require('util');
var mysql = require('mysql');
var async = require('async');
var debug = require('debug')('arbimon2:models:jobs');
var validator = require('validator');
var dbpool = require('../utils/dbpool');
var sqlutil = require('../utils/sqlutil');
var arrays_util  = require('../utils/arrays');

var queryHandler = dbpool.queryHandler;

var Jobs = {
    job_types : {
        training_job : {
            type_id : 1,
            new : function(params, db, callback) {
                db.query(
                    "INSERT INTO `job_params_training` (`job_id`, `model_type_id`, \n" +
                    " `training_set_id`, `validation_set_id`, `trained_model_id`, \n" +
                    " `use_in_training_present`,`use_in_training_notpresent`,`use_in_validation_present`,`use_in_validation_notpresent` ,`name` \n" +
                    ") VALUES ( \n" +
                        mysql.escape([params.job_id, params.classifier, 
                            params.train, null, null, 
                            params.upt, params.unt, params.upv, params.unv, params.name
                        ]) + "\n" +
                    ")", callback
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
            new: function(params, db, callback) {
                db.query(
                    "INSERT INTO `job_params_classification` (\n" +
                    "   `job_id`, `model_id`, `playlist_id` ,`name` \n" +
                    ") VALUES ( \n" + 
                    "   " + mysql.escape([params.job_id, params.classifier, params.playlist, params.name]) + "\n" +
                    ")", callback
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
            new: function(params, db, callback) {
                db.query(
                    "INSERT INTO `job_params_soundscape`( \n"+
                    "   `job_id`, `playlist_id`, `max_hertz`, `bin_size`, `soundscape_aggregation_type_id`, `name`, `threshold` , `frequency` , `normalize` \n" +
                    ") VALUES ( \n" + 
                    "    " + mysql.escape([params.job_id, params.playlist, params.maxhertz, params.bin]) + ", \n"+
                    "    (SELECT `soundscape_aggregation_type_id` FROM `soundscape_aggregation_types` WHERE `identifier` = " + mysql.escape(params.aggregation) + "), \n" +
                    "    " + mysql.escape([params.name, params.threshold, params.frequency , params.normalize]) + " \n" +
                    ")", callback
                );
            },
            sql : {
                report : {
                    projections : ['CONCAT(UCASE(LEFT( JPT.`name`, 1)), SUBSTRING( JPT.`name`, 2)) as name'],
                    tables      : ['JOIN `job_params_soundscape` as JPT ON J.job_id = JPT.job_id'],
                }
            }
        },
        test_job: {
            type_id : 5,
            new: function(params, db, callback) {
                callback();
            },
            sql : {
                report : {
                    projections : ['"" as name'],
                }
            }
        }        
    },

    newJob: function(params, type, callback) {
        var job_type = this.job_types[type];
        if(!job_type){ 
            callback(new Error("Invalid job type " + type + "."));
            return;
        }
        
        var db;
        var job_id;
        var tx = new sqlutil.transaction();

        async.waterfall([
            dbpool.getConnection,
            function start_transaction(connection, next){
                tx.connection = db = connection;
                tx.begin(next);
            },
            function insert_job_entry(){
                var next = arguments[arguments.length - 1];
                db.query(
                    "INSERT INTO `jobs` ( \n" +
                    "   `job_type_id`, `date_created`, `last_update`, `project_id`, `user_id`, `uri`, `remarks` \n" +
                    ") VALUES (" + 
                        job_type.type_id + ", now(), now()," + mysql.escape(params.project) + "," + mysql.escape(params.user) + ",'',''" +
                    ")", next
                );
            },
            function get_job_id(result){
                var next = arguments[arguments.length - 1];
                params.job_id = job_id = result.insertId;
                next();
            },
            function insert_job_parameters(next){
                job_type.new(params, db, next);
            },
            tx.mark_success.bind(tx)
        ], function(err){
            if(db){
                db.release();
            }
            tx.end(function(err2){
                if(err){
                    callback(err);
                } else if(err2){
                    callback(err2);
                } else {
                    callback(null, job_id);
                }
            });
        });
    },
    
    
    getJobTypes: function(callback){
        queryHandler("SELECT job_type_id as id, name, description FROM job_types WHERE `enabled`=1", callback);
    },
    
    hide: function(jId, callback) {
        var q = "update `jobs` set `hidden`  = 1 where `job_id` = " + jId;

        queryHandler(q, callback);
    },
    
    classificationNameExists: function(p, callback) {
        var q = "SELECT count(*) as count FROM `jobs` J ,  `job_params_classification` JPC " +
            " WHERE `project_id` = " + mysql.escape(p.pid) + " and `job_type_id` = 2 and J.`job_id` = JPC.`job_id` " +
            " and `name` like " + mysql.escape(p.name) + " ";

        queryHandler(q, callback);
    },
    modelNameExists: function(p, callback) {
        var q = "SELECT count(*) as count FROM `jobs` J ,  `job_params_training` JPC " +
            " WHERE `project_id` = " + mysql.escape(p.pid) + " and `job_type_id` = 1 and J.`job_id` = JPC.`job_id` " +
            " and `name` like " + mysql.escape(p.name) + " ";

        queryHandler(q, callback);
    },

    soundscapeNameExists: function(p, callback) {
        var q = "SELECT count(*) as count FROM `soundscapes` WHERE `project_id` = " + mysql.escape(p.pid) + " and `name` LIKE " + mysql.escape(p.name);

        queryHandler(q, callback);
    },

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
            } else if(project.url){
                constraints.push('P.url = ' + mysql.escape(project.url));
                tables.push('JOIN projects P ON J.project_id = P.project_id');
            }
        }
        
        for(var i in this.job_types){
            var job_type = this.job_types[i];
            var jt_projections = job_type.sql && job_type.sql.report && job_type.sql.report.projections;
            var jt_tables      = job_type.sql && job_type.sql.report && job_type.sql.report.tables;
            union.push(
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update, \n" +
                (jt_projections && jt_projections.length ? 
                    "    "+jt_projections.join(", ")+", \n" : ""
                ) +
                "   round(100*(J.`progress`/J.`progress_steps`),1) as percentage \n"+
                " FROM `jobs` as J " +
                (jt_tables && jt_tables.length ? 
                    "    "+jt_tables.join("\n")+"\n" : ""
                ) +
                (tables && tables.length ? 
                    "    "+tables.join("\n")+"\n" : ""
                ) +
                "WHERE "+constraints.join(" AND ") + "\n" +
                "  AND J.job_type_id = " + (job_type.type_id|0)
            );
        }
        
        queryHandler("(\n" + 
            union.join("\n) UNION (\n") + 
        "\n)", callback);
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
    find: function(query, options, callback) {
        if(query instanceof Function){
            callback = query;
            query = null;
        } else if(options instanceof Function){
            callback = options;
            options = null;
        }
        
        if(!query){
            query = {};
        }
        if(!options){
            options = {};
        }
        
        var constraints = [], tables = [];
        var projection;
        var limit_clause="";

        if(query.id){
            constraints.push(sqlutil.escape_compare("J.job_id", "IN",  query.id));
        }
        if(query.type){
            if(!query.type instanceof Array){
                query.type = [query.type];
            }
            var type_ids = query.type.map(function(type){
                return /^\d+$/.test(type) ? type : (Jobs.job_types[type] ? Jobs.job_types[type].type_id : undefined);
            });
            constraints.push(sqlutil.escape_compare("J.job_type_id", "IN",  type_ids));
        }
        if(query.user){
            constraints.push(sqlutil.escape_compare("J.user_id", "IN",  query.user));
        }
        if(query.state){
            constraints.push(sqlutil.escape_compare("J.state", "IN",  query.state));
        }
        if(query.hidden){
            constraints.push(sqlutil.escape_compare("J.hidden", "IN",  query.hidden));
        }
        if(query.project){
            constraints.push(sqlutil.escape_compare("J.project_id", "IN",  query.project));
        }
        if(query.completed){
            constraints.push(sqlutil.escape_compare("J.completed", "IN",  query.completed));
        }
        if(query.limit){
            var limit = query.limit;
            if(typeof limit != "object"){
                limit = {count:limit};
            }
            limit_clause = "\nLIMIT " + (limit.count|0) + (limit.offset ? " OFFSET " + (limit.offset|0) : "");
        }        
        
        if(options.id_only){
            projection = ['J.job_id as id'];
        } else {
            projection = [
                'J.job_id as id', 'J.job_type_id as type_id', 'J.date_created', 'J.last_update', 
                'J.project_id as project', 'J.user_id as user', 'J.uri', 'J.state', 'J.cancel_requested', 'J.progress', 
                'J.completed', 'J.remarks', 'J.progress_steps', 'J.hidden'
            ];
            projection.push('JT.identifier as type');
            tables.push('JOIN job_types JT ON J.job_type_id = JT.job_type_id');
            if(options.script){
                projection.push('JT.script');
            }
        }

        
        queryHandler(
            "SELECT "+projection.join(",")+" \n" +
            "FROM `jobs` J" + 
            (tables.length ? "\n"+tables.join('\n') : '') + 
            (constraints.length ? "\nWHERE " + constraints.join("\n  AND ") : "") +
            limit_clause,
            function(err, rows){
            if(err){
                callback(err);
                return;
            }
            if(options.unpack_single){
                debug("if(options.unpack_single){");
                var cb = callback;
                callback = function(err, rows){
                    debug("callback = function(err, rows){");
                    if(err){
                        cb(err);
                        return;
                    }
                    cb(null, rows.length == 1 ? rows[0] : rows);
                };
            }
            if(options.compute){
                debug("if(options.compute){");
                arrays_util.compute_row_properties(rows, options.compute, function(property){
                    debug("arrays_util.compute_row_properties(rows, options.compute, function(property){");
                    return Jobs['__compute_' + property.replace(/-/g,'_')];
                }, callback);
            } else {
                callback(null, rows);
            }                           
        });

    },
    
    set_job_state: function(job, new_state, callback){
        queryHandler(
            "UPDATE jobs \n"+
            "SET state = " + mysql.escape(new_state) + ",\n" +
            "    last_update = NOW() \n" +
            "WHERE job_id = " + (job.id | 0), 
        callback);
    },
    
    get_job_type : function(job){
        var job_types = Jobs.job_types, job_type;
        for(var i in job_types){
            if(job_types[i].type_id == job.type_id){
                return job.type_id;
            }
        }
        return null;
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
