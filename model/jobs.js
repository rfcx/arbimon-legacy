var util = require('util');
var mysql = require('mysql');
var async = require('async');
var debug = require('debug')('arbimon2:models:jobs');
var joi   = require('joi');

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
    cancel: function(jId, callback) {
        var q = "update `jobs` set `cancel_requested`  = 1 where `job_id` = " + jId;

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
            } 
            else if(project.url){
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
            where.push('j.state IN ('+ mysql.escape(query.states)+')');
        }
        
        if(query.types) {
            where.push('j.job_type_id IN ('+ mysql.escape(query.types)+')');
        }
        
        if(query.project_id) {
            where.push('j.project_id IN ('+ mysql.escape(query.project_id)+')');
        }
        
        if(query.user_id) {
            where.push('j.user_id IN ('+ mysql.escape(query.user_id)+')');
        }
        
        if(query.project) {
            where.push('p.name IN ('+ mysql.escape(query.project)+')');
        }
        
        if(query.user) {
            where.push('u.login IN ('+ mysql.escape(query.user)+')');
        }
        
        
        if(where.length) {
            q += "WHERE " + where.join(' \nAND ');
        }
        
        queryHandler(q, callback);
        
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
