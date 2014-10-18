var util = require('util');
var mysql = require('mysql');
var validator = require('validator');

module.exports = function(queryHandler) {
    return {
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
                 "  VALUES ("+mysql.escape(p.id)+","+mysql.escape(p.classifier)+",NULL, "+mysql.escape(p.name)+") ";

            queryHandler(q,callback);
        }
    };
}
    
    
