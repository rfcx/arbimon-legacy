var util = require('util');
var mysql = require('mysql');
var validator = require('validator');
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

module.exports =
    {
        findName: function(model_id, callback) {
            var q = "SELECT name \n"+
                    "FROM models \n"+
                    "WHERE model_id = " + mysql.escape(model_id);

            queryHandler(q, callback);
        },
        
        details: function(model_id, callback) {
            var q = "SELECT ms.`json_stats` as json, m.model_id, CONCAT(UCASE(LEFT(m.name, 1)), SUBSTRING(m.name, 2)) as mname "+
                    ", DATE_FORMAT(m.date_created,'%h:%i %p') as mtime , DATE_FORMAT(m.date_created,'%M %d %Y') as mdc "+
                    ", jpt.`use_in_training_present`, jpt.`use_in_training_notpresent` ,jpt.`use_in_validation_present` , jpt.`use_in_validation_notpresent`"+
                    " , CONCAT(CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) ,"+
                    "  ' ', CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) ) as muser " + 
                    " , mt.name as mtname ,jobs.`remarks`  " +
                    ", DATE_FORMAT(jobs.`last_update`,'%h:%i %p') as lasttime , DATE_FORMAT(jobs.`last_update`,'%M %d %Y') as lastupdate "+ 
                    " , CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as species "+
                    " , CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype "+
                    " , CONCAT(UCASE(LEFT(ts.`name`, 1)), SUBSTRING(ts.`name`, 2)) as trainingSetName "+
                    ", DATE_FORMAT(ts.date_created,'%h:%i %p') as trainingSettime , DATE_FORMAT(ts.date_created,'%M %d %Y') as trainingSetdcreated "+
                    " , TIMESTAMPDIFF(SECOND, jobs.`date_created`, m.`date_created` ) as joblength "+
                    " FROM `models` as m,`model_types` as mt , `users` as u ,`job_params_training` as jpt , `jobs` , `model_classes` as mc " +
                    " ,`species`  as s , `songtypes` as st , `model_stats` as ms , `training_sets` as ts "+
                    " WHERE m.model_id  = "+mysql.escape(model_id)+
                    " and m.`model_type_id` = mt.`model_type_id` and m.user_id = u.user_id "+
                    " and jpt.`trained_model_id` = m.model_id and jobs.job_id = jpt.job_id and mc.`model_id` = m.`model_id` "+
                    " and mc.`species_id` = s.`species_id` and st.`songtype_id` = mc.`songtype_id` and ms.`model_id` = m.`model_id` " +
                    " and jpt.`training_set_id` = ts.`training_set_id` "
                    ;

            queryHandler(q, callback);
        },

        delete: function(model_id, callback) {
            var q = "update `models` set `deleted` = 1 where model_id = "+model_id;

            queryHandler(q, callback);
        },

        types: function(callback) {
            var q = "SELECT `model_type_id`, `name` FROM `model_types` ";

            queryHandler(q, callback);
        }
    };

    
