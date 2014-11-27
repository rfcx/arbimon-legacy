var util = require('util');
var mysql = require('mysql');
var validator = require('validator');
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

module.exports = 
     {
        newJob: function(p,type, callback) {

            var q = "INSERT INTO `jobs` (`job_type_id`, `date_created`, `last_update` "+
                    ", `project_id`, `user_id`, `uri`, `remarks`) "+
                    "VALUES ("+type+",now(),now(),"+mysql.escape(p.pid)+","+mysql.escape(p.user)+",'','')";

            queryHandler(q,callback);
        },
        newTrainingJob: function(p, callback)
        {       
            var q = "INSERT INTO `job_params_training` (`job_id`, `model_type_id`, "+
                 " `training_set_id`, `validation_set_id`, `trained_model_id`, " +
                 " `use_in_training_present`,`use_in_training_notpresent`,`use_in_validation_present`,`use_in_validation_notpresent` ,`name`) VALUES "+
                 " ("+mysql.escape(p.id)+","+mysql.escape(p.classifier)+","+mysql.escape(p.train)+",NULL,NULL,"+p.upt+","+p.unt+","+p.upv+","+p.unv+", "+mysql.escape(p.name)+") ";

            queryHandler(q,callback);
        },
        newClassificationJob: function(p, callback)
        {       
            var q = "INSERT INTO `job_params_classification` (`job_id`, `model_id`, `playlist_id` ,`name`)"+
                 "  VALUES ("+mysql.escape(p.id)+","+mysql.escape(p.classifier)+","+mysql.escape(p.playlist_id)+", "+mysql.escape(p.name)+") ";

            queryHandler(q,callback);
        },
         newSoundscapeJob: function(p, callback)
        {
         
            var q = "INSERT INTO `job_params_soundscape`(`job_id`, `playlist_id`, `max_hertz`, `bin_size`, `soundscape_aggregation_type_id`, `name`, `threshold` , `frequency`) "+
                  " VALUES ("+mysql.escape(p.id)+","+mysql.escape(p.playlist)+","+mysql.escape(p.maxhertz)+
                  " ,"+mysql.escape(p.bin)+",  (SELECT `soundscape_aggregation_type_id` FROM `soundscape_aggregation_types` WHERE `identifier` = "+mysql.escape(p.aggregation)+") "+
                  ","+mysql.escape(p.name)+","+mysql.escape(p.threshold)+","+mysql.escape(p.frequency)+")";
            queryHandler(q,callback);
        },
        hide: function(jId, callback)
        {       
            var q = "update `jobs` set `hidden`  = 1 where `job_id` = "+jId;

            queryHandler(q,callback);
        },
        classificationNameExists :
        function(p, callback)
        {       
            var q = "SELECT count(*) as count FROM `jobs` J ,  `job_params_classification` JPC " +
            " WHERE `project_id` = "+mysql.escape(p.pid)+" and `job_type_id` = 2 and J.`job_id` = JPC.`job_id` "+
            " and `name` like "+mysql.escape(p.name)+" ";

            queryHandler(q,callback);
        },
        modelNameExists :
        function(p, callback)
        {       
            var q = "SELECT count(*) as count FROM `jobs` J ,  `job_params_training` JPC " +
            " WHERE `project_id` = "+mysql.escape(p.pid)+" and `job_type_id` = 1 and J.`job_id` = JPC.`job_id` "+
            " and `name` like "+mysql.escape(p.name)+" ";

            queryHandler(q,callback);
        },
        soundscapeNameExists :
        function(p, callback)
        {
            var q = "SELECT count(*) as count FROM `soundscapes` WHERE `project_id` = "+mysql.escape(p.pid)+" and `name` LIKE "+mysql.escape(p.name);

            queryHandler(q,callback);
        },
        
        allActiveJobs: function(callback) {
            var q = "( SELECT j.`progress`, \n"+
                    "         j.`progress_steps`,  \n"+
                    "         j.`job_type_id`, \n"+
                    "         j.`job_id`, \n"+
                    "         CONCAT(UCASE(LEFT( jpt.`name`, 1)), SUBSTRING( jpt.`name`, 2)) as name,  \n"+
                    "         ROUND(100*(j.`progress`/j.`progress_steps`),1) as percentage \n"+
                    "FROM `job_params_training` as jpt, \n"+
                    "     `jobs` as j \n"+
                    "WHERE j.`hidden` = 0  \n"+
                    "AND jpt.`job_id` = j.`job_id` )\n"+
                    "UNION \n"+
                    "( SELECT j.`progress`, \n"+
                    "         j.`progress_steps`, \n"+
                    "         j.`job_type_id` , \n"+
                    "         j.`job_id` , \n"+
                    "         CONCAT(UCASE(LEFT( jpc.`name`, 1)), SUBSTRING( jpc.`name`, 2)) as name , \n"+
                    "         ROUND(100*(j.`progress`/j.`progress_steps`),1) as percentage \n"+
                    "FROM `job_params_classification` as jpc, \n"+
                    "     `jobs` as j \n"+
                    "WHERE j.`hidden` = 0  \n"+
                    "AND jpc.`job_id` = j.`job_id` )\n";
            
            queryHandler(q,callback);
        },
    };

    
    
