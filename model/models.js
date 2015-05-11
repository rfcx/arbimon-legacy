var util = require('util');
var mysql = require('mysql');
var async = require('async');
var validator = require('validator');
var AWS = require('aws-sdk');
var path = require('path');

var dbpool = require('../utils/dbpool');
var config = require('../config'); 

var recordings = require('./recordings');

var s3;
var queryHandler = dbpool.queryHandler;

module.exports = {
    findName: function(model_id, callback) {
        var q = "SELECT name \n"+
                "FROM models \n"+
                "WHERE model_id = " + mysql.escape(model_id);

        queryHandler(q, callback);
    },
    
    getTrainingVector: function(modelId, recId, callback) {
        
        async.parallel({
            model: function getModelInfo(cb) {
                var q = "SELECT m.project_id, \n"+
                        "       jpt.job_id \n"+
                        "FROM models AS m \n"+
                        "JOIN job_params_training AS jpt ON m.model_id = jpt.trained_model_id \n"+
                        "WHERE m.model_id = ?";
                q = mysql.format(q, [modelId]);
                queryHandler(q, cb);
            },
            rec: function getRecInfo(cb) {
                recordings.findById(recId, cb);
            }
        }, function(err, results) {
            if(err) return callback(err);
            
            console.dir(results);
            
            if(!results.rec[0].length) {
                return callback(new Error('recorinding not exist'));
            }
            if(!results.model[0].length) {
                return callback(new Error('model not exist'));
            }
            
            
            var filename = path.basename(results.rec[0][0].uri);
            var vectorUri = 'project_' + results.model[0][0].project_id + 
                            '/training_vectors/job_' + results.model[0][0].job_id + 
                            '/' + filename;
            
            callback(null, vectorUri);
        });
    },
    
    details: function(model_id, callback) {
        var q = "SELECT ms.`json_stats` as json, \n"+
                "       m.threshold , \n" +
                "       m.model_id, \n"+
                "       CONCAT(UCASE(LEFT(m.name, 1)), SUBSTRING(m.name, 2)) as mname, \n"+
                "       DATE_FORMAT(m.date_created,'%h:%i %p') as mtime, \n"+
                "       DATE_FORMAT(m.date_created,'%b %d, %Y') as mdc, \n"+
                "       jpt.`use_in_training_present`, \n"+
                "       jpt.`use_in_training_notpresent`, \n"+
                "       jpt.`use_in_validation_present`, \n"+
                "       jpt.`use_in_validation_notpresent`, \n"+
                "       CONCAT( \n"+
                "           CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) , ' ', \n"+
                "           CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) \n"+
                "       ) as muser, \n"+
                "       mt.name as mtname, \n"+
                "       jobs.`remarks`, \n"+
                "       jobs.`job_id`, \n"+
                "       DATE_FORMAT(jobs.`last_update`,'%h:%i %p') as lasttime, \n"+
                "       DATE_FORMAT(jobs.`last_update`,'%b %d, %Y') as lastupdate, \n"+
                "       CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as species, \n"+
                "       CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype, \n"+
                "       CONCAT(UCASE(LEFT(ts.`name`, 1)), SUBSTRING(ts.`name`, 2)) as trainingSetName, \n"+
                "       DATE_FORMAT(ts.date_created,'%h:%i %p') as trainingSettime , DATE_FORMAT(ts.date_created,'%b %d, %Y') as trainingSetdcreated, \n"+
                "       TIMESTAMPDIFF(SECOND, jobs.`date_created`, m.`date_created` ) as joblength \n"+
                "FROM `models` as m, \n"+
                "     `model_types` as mt, \n"+
                "     `users` as u, \n"+
                "     `job_params_training` as jpt, \n"+
                "     `jobs`, \n"+
                "     `model_classes` as mc, \n"+
                "     `species`  as s, \n"+
                "     `songtypes` as st, \n"+
                "     `model_stats` as ms, \n"+
                "     `training_sets` as ts \n"+
                "WHERE m.model_id = ? \n"+
                "AND m.`model_type_id` = mt.`model_type_id` \n"+
                "AND m.user_id = u.user_id \n"+
                "AND jpt.`trained_model_id` = m.model_id \n"+
                "AND jobs.job_id = jpt.job_id \n"+
                "AND mc.`model_id` = m.`model_id` \n"+
                "AND mc.`species_id` = s.`species_id` \n"+
                "AND st.`songtype_id` = mc.`songtype_id` \n"+
                "AND ms.`model_id` = m.`model_id` \n" +
                "AND jpt.`training_set_id` = ts.`training_set_id`";
        
        q = mysql.format(q, [model_id]);
        queryHandler(q, callback);
    },

    delete: function(model_id, callback) {
        var q = "SELECT `uri` FROM `models` WHERE `model_id` ="+model_id;

        queryHandler(q,
            function (err,rows)
            {
                if (err) {
                    callback();
                }
                if(!s3){
                    s3 = new AWS.S3();
                }
                var uri = rows[0].uri;
                var imgUri = rows[0].uri.replace('.mod','.png');
                var params = {
                    Bucket: config('aws').bucketName,
                    Delete: { 
                        Objects:
                        [ 
                          {
                            Key: uri, 
                          },
                          {
                            Key: imgUri, 
                          }
                        ]
                    }
                };
                s3.deleteObjects(params, function(err, data) {
                    if (err)
                    {
                        callback();
                    }
                    else
                    {
                        var q = "update `models` set `deleted` = 1 where model_id = "+model_id;
   
                        queryHandler(q, callback);                             
                    }
                });                 
         
            }
        );
        

    },

    types: function(callback) {
        var q = "SELECT `model_type_id`, `name` , `description` FROM `model_types` ";

        queryHandler(q, callback);
    },

    savethreshold: function(m,t,callback) {
        var q = "UPDATE `models` SET `threshold` = "+mysql.escape(t)+
                " WHERE `models`.`model_id` ="+mysql.escape(m)+";";

        queryHandler(q, callback);
    }
};
