const async = require('async');
const AWS = require('aws-sdk');
const path = require('path');
const q = require('q');
const joi = require('joi');
const dbpool = require('../utils/dbpool');
const config = require('../config');
const recordings = require('./recordings');
const k8sConfig = config('k8s');
const jsonTemplates = require('../utils/json-templates');
const { Client } = require('kubernetes-client');
const k8sClient = new Client({ version: '1.13' });
let s3;
const queryHandler = dbpool.queryHandler;

module.exports = {
    findName: function(model_id, callback) {
        let q = "SELECT name \n"+
                "FROM models \n"+
                "WHERE model_id = " + dbpool.escape(model_id);

        queryHandler(q, callback);
    },
    
    getTrainingVector: function(modelId, recId, callback) {
        
        async.parallel({
            model: function getModelInfo(cb) {
                let q = "SELECT m.project_id, \n"+
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
            
            let filename = path.basename(results.rec[0][0].uri);
            let vectorUri = 'project_' + results.model[0][0].project_id + 
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

    getModelById: function (model_id, callback) {
        const sql = `SELECT * from models WHERE model_id = ${model_id}`;
        return queryHandler(sql, callback);
    },

    getModelByUri: async function (projectId, uri) {
        const sql = `SELECT * from models WHERE project_id = ${projectId} and uri = '${uri}'`;
        return dbpool.query(sql).get(0);
    },
    
    details: function(model_id, opts, callback) {
        let q = "SELECT ms.`json_stats` as json, \n"+
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
                `AND jpt.trained_model_id = ${opts.isSharedModel ? opts.sourceModelId : 'm.model_id'} \n`+
                `AND jobs.job_id = ${opts.isSharedModel ? opts.sourceJobId : 'jpt.job_id'} \n`+
                `AND mc.model_id = ${opts.isSharedModel ? opts.sourceModelId : 'm.model_id'} \n`+
                "AND mc.`species_id` = s.`species_id` \n"+
                "AND st.`songtype_id` = mc.`songtype_id` \n"+
                `AND ms.model_id = ${opts.isSharedModel ? opts.sourceModelId : 'm.model_id'} \n` +
                `AND jpt.training_set_id = ${opts.isSharedModel ? opts.sourceTrainingSetId : 'ts.training_set_id'}`;
        
        q = dbpool.format(q, [model_id]);
        queryHandler(q, function(err, rows) {
            if(err) return callback(err);
            
            if(!rows.length) return callback(new Error('model not found'));
            
            let data = rows[0];
            data.json = JSON.parse(data.json);
            const isProd = process.env.NODE_ENV === 'production';
            const awsConfig = isProd ? config('aws') : config('aws_rfcx');
            const patternBucket = isProd ? awsConfig.bucketName : awsConfig.bucketNameStaging;
            const patternRegion = isProd ? awsConfig.region : awsConfig.region;
            const patternThumbnail = 'https://' + patternBucket + '.s3.' + patternRegion + '.amazonaws.com/' + data.json.roipng;
            
            let model = {
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
                    thumbnail: patternThumbnail,
                }
            };
            callback(null, model);
        });
    },

    checkExistingModel: function(opts, callback) {
        const q = `select * from models where project_id = ${opts.projectIdTo} and name = '${opts.modelName}';`;
        queryHandler(q, callback);
    },

    shareModel: function(opts, callback) {
        const q = `insert into models(name, model_type_id, uri, date_created, project_id, user_id, training_set_id, validation_set_id, deleted, threshold)
            select  m2.name, m2.model_type_id, m2.uri, m2.date_created, ${opts.projectIdTo}, m2.user_id, m2.training_set_id, m2.validation_set_id, m2.deleted, m2.threshold
            from models m2
            where m2.model_id = ${opts.modelId};
        `;
        queryHandler(q, callback);
    },

    delete: function(model_id, callback) {
        let q = "SELECT `uri` FROM `models` WHERE `model_id` ="+model_id;

        queryHandler(q,
            function (err,rows)
            {
                if (err) {
                    callback();
                }
                if(!s3){
                    s3 = new AWS.S3();
                }
                let uri = rows[0].uri;
                let imgUri = rows[0].uri.replace('.mod','.png');
                let params = {
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
                        let q = "UPDATE `models` SET deleted = 1 WHERE model_id = "+model_id;
                        queryHandler(q, callback);
                    }
                });
         
            }
        );
        

    },

    types: function(callback) {
        let q = "SELECT model_type_id, name , description, enabled \n"+
                "FROM model_types";

        queryHandler(q, callback);
    },

    savethreshold: function(m,t,callback) {
        let q = "UPDATE `models` SET `threshold` = "+dbpool.escape(t)+
                " WHERE `models`.`model_id` ="+dbpool.escape(m)+";";

        queryHandler(q, callback);
    },

    JOB_SCHEMA : joi.object().keys({
        ENV_JOB_ID: joi.string()
    }),

    createRFM: function(data, callback){
        const payload = JSON.stringify(
            {
                ENV_JOB_ID: `${data.jobId}`
            }
        )
        return q.ninvoke(joi, 'validate', payload, this.JOB_SCHEMA)
            .then(async () => {
                data.kubernetesJobName = `arbimon-rfm-train-${data.jobId}-${new Date().getTime()}`;
                const jobParam = jsonTemplates.getRfmTemplate('arbimon-rfm-train', 'job', {
                    kubernetesJobName: data.kubernetesJobName,
                    imagePath: k8sConfig.rfmImagePath,
                    ENV_JOB_ID: `${data.jobId}`
                });
                return await k8sClient.apis.batch.v1.namespaces(k8sConfig.namespace).jobs.post({ body: jobParam });
            }).then(() => {
                return true;
            }).nodeify(callback);
    },
};
