var util = require('util');
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
                "WHERE model_id = " + dbpool.escape(model_id);

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
                q = dbpool.format(q, [modelId]);
                queryHandler(q, cb);
            },
            rec: function getRecInfo(cb) {
                recordings.findById(recId, cb);
            }
        }, function(err, results) {
            if(err) return callback(err);
            
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

    getModelId: function (job_id) {
        const sql = `SELECT m.model_id FROM models m
            JOIN job_params_training jpt ON jpt.trained_model_id = m.model_id
            WHERE jpt.job_id = ${job_id}`
        return dbpool.query(sql).get(0);
    },

    getModelJobId: function (model_id) {
        const sql = `SELECT jpt.job_id FROM job_params_training jpt
            JOIN models m ON jpt.trained_model_id = m.model_id
            WHERE m.model_id = ${model_id}`
        return dbpool.query(sql).get(0);
    },
    
    details: function(model_id, callback) {
        var q = "SELECT ms.`json_stats` as json, \n"+
                "       m.threshold , \n" +
                "       m.model_id, \n"+
                "       m.name, \n"+
                "       m.date_created, \n"+
                "       jpt.`use_in_training_present`, \n"+
                "       jpt.`use_in_training_notpresent`, \n"+
                "       jpt.`use_in_validation_present`, \n"+
                "       jpt.`use_in_validation_notpresent`, \n"+
                "       CONCAT(u.firstname, ' ', u.lastname) as userFullname, \n"+
                "       u.login as username, \n"+
                "       mt.name as model_type, \n"+
                "       jobs.`remarks`, \n"+
                "       jobs.`job_id`, \n"+
                "       jobs.`last_update`, \n"+
                "       CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as species, \n"+
                "       CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype, \n"+
                "       ts.`name` as trainingSetName, \n"+
                "       ts.date_created as trainingSetcreated, \n"+
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
        
        q = dbpool.format(q, [model_id]);
        queryHandler(q, function(err, rows) {
            if(err) return callback(err);
            
            if(!rows.length) return callback(new Error('model not found'));
            
            var data = rows[0];
            data.json = JSON.parse(data.json);
            
            var model = {
                id: data.model_id,
                name: data.name,
                createdOn: data.date_created,
                user: {
                    fullname: data.userFullname,
                    username: data.username
                },
                type: data.model_type,
                lastUpdate: data.last_update,
                species: data.species,
                songtype: data.songtype,
                remarks: data.remarks,
                jobId: data.job_id,
                jobLength: data.joblength,
                threshold: data.threshold,
                oobScore: data.json.forestoobscore,
                minv: data.json.minv,
                maxv: data.json.maxv,
                validations: {
                    use_in_training: {
                        present: data.use_in_training_present,
                        notPresent: data.use_in_training_notpresent,
                    },
                    use_in_validation: {
                        present: data.use_in_validation_present,
                        notPresent: data.use_in_validation_notpresent,
                    },
                    stats: {
                        accuracy: data.json.accuracy,
                        precision: data.json.precision,
                        sensitivity: data.json.sensitivity,
                        specificity: data.json.specificity,
                        tp: data.json.tp,
                        fp: data.json.fp,
                        tn: data.json.tn,
                        fn: data.json.fn,
                    }
                },
                trainingSet: {
                    name: data.trainingSetName,
                    createdOn: data.trainingSetcreated,
                    roiCount: data.json.roicount,
                },
                pattern: {
                    duration: data.json.roilength,
                    lowfreq: data.json.roilowfreq,
                    highfreq: data.json.roihighfreq,
                    samplerate: data.json.roisamplerate,
                    thumbnail: 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + data.json.roipng,
                }
            };
            callback(null, model);
        });
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
                    if(err) {
                        callback();
                    }
                    else {
                        var q = "UPDATE `models` SET deleted = 1 WHERE model_id = "+model_id;
                        queryHandler(q, callback);
                    }
                });
         
            }
        );
        

    },

    types: function(callback) {
        var q = "SELECT model_type_id, name , description, enabled \n"+
                "FROM model_types";

        queryHandler(q, callback);
    },

    savethreshold: function(m,t,callback) {
        var q = "UPDATE `models` SET `threshold` = "+dbpool.escape(t)+
                " WHERE `models`.`model_id` ="+dbpool.escape(m)+";";

        queryHandler(q, callback);
    }
};
