var util = require('util');
var mysql = require('mysql');
var async = require('async');
var validator = require('validator');
var dbpool = require('../utils/dbpool');
var sqlutil = require('../utils/sqlutil');
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
        },
        soundscape_job: {
            type_id : 4,
            new: function(params, db, callback) {
                db.query(
                    "INSERT INTO `job_params_soundscape`( \n"+
                    "   `job_id`, `playlist_id`, `max_hertz`, `bin_size`, `soundscape_aggregation_type_id`, `name`, `threshold` , `frequency` \n" +
                    ") VALUES ( \n" + 
                    "    " + mysql.escape([params.job_id, params.playlist, params.maxhertz, params.bin]) + ", \n"+
                    "    (SELECT `soundscape_aggregation_type_id` FROM `soundscape_aggregation_types` WHERE `identifier` = " + mysql.escape(params.aggregation) + "), \n" +
                    "    " + mysql.escape([params.name, params.threshold, params.frequency]) + " \n" +
                    ")", callback
                );
            },
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

    allActiveJobs: function(callback) {
        var q = "( SELECT j.`progress`, \n" +
            "         j.`progress_steps`,  \n" +
            "         j.`job_type_id`, \n" +
            "         j.`job_id`, \n" +
            "         CONCAT(UCASE(LEFT( jpt.`name`, 1)), SUBSTRING( jpt.`name`, 2)) as name,  \n" +
            "         ROUND(100*(j.`progress`/j.`progress_steps`),1) as percentage \n" +
            "FROM `job_params_training` as jpt, \n" +
            "     `jobs` as j \n" +
            "WHERE j.`hidden` = 0  \n" +
            "AND jpt.`job_id` = j.`job_id` )\n" +
            "UNION \n" +
            "( SELECT j.`progress`, \n" +
            "         j.`progress_steps`, \n" +
            "         j.`job_type_id` , \n" +
            "         j.`job_id` , \n" +
            "         CONCAT(UCASE(LEFT( jpc.`name`, 1)), SUBSTRING( jpc.`name`, 2)) as name , \n" +
            "         ROUND(100*(j.`progress`/j.`progress_steps`),1) as percentage \n" +
            "FROM `job_params_classification` as jpc, \n" +
            "     `jobs` as j \n" +
            "WHERE j.`hidden` = 0  \n" +
            "AND jpc.`job_id` = j.`job_id` )\n";

        queryHandler(q, callback);
    },
};

module.exports = Jobs;
