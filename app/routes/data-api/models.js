/* jshint node:true */
"use strict";

var util = require('util');
var path = require('path');

var debug = require('debug')('arbimon2:route:models');
var express = require('express');
var request = require('request');
var async = require('async');
var AWS = require('aws-sdk');

var model = require('../../model');
var pokeDaMonkey = require('../../utils/monkey');
var scriptsFolder = __dirname+'/../../scripts/';
var config = require('../../config');


var router = express.Router();
var s3 = new AWS.S3();

// ------------------------ models routes -------------------------------------

router.get('/project/:projectUrl/models', function(req, res, next) {

    model.projects.modelList(req.params.projectUrl, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/project/:projectUrl/models/forminfo', function(req, res, next) {

    model.models.types(function(err, row1) {
        if(err) return next(err);
        
        model.projects.trainingSets( req.params.projectUrl, function(err, row2) {
            if(err) return next(err);
            
            res.json({ types:row1 , trainings:row2});
        });
    });
});

router.post('/project/:projectUrl/models/new', function(req, res, next) {
    var response_already_sent;
    var project_id, name, train_id, classifier_id, usePresentTraining;
    var useNotPresentTraining, usePresentValidation, useNotPresentValidation, user_id;
    var job_id, params;

    async.waterfall([
        
        function find_project_by_url(next){
            model.projects.findByUrl(req.params.projectUrl, next);
        },
        function gather_job_params(rows){
            var next = arguments[arguments.length-1];

            if(!rows.length){
                res.status(404).json({ err: "project not found"});
                response_already_sent = true;
                next(new Error());
                return;
            }

            project_id = rows[0].project_id;

            if(!req.haveAccess(project_id, "manage models and classification"))
                return res.json({ error: "you dont have permission to 'manage models and classification'" });

            name = (req.body.n);
            train_id = dbpool.escape(req.body.t);
            classifier_id = dbpool.escape(req.body.c);
            usePresentTraining = dbpool.escape(req.body.tp);
            useNotPresentTraining = dbpool.escape(req.body.tn);
            usePresentValidation = dbpool.escape(req.body.vp);
            useNotPresentValidation  = dbpool.escape(req.body.vn);
            user_id = req.session.user.id;
            params = {
                name: name,
                train: train_id,
                classifier: classifier_id,
                user: user_id,
                project: project_id,
                upt: usePresentTraining,
                unt: useNotPresentTraining,
                upv: usePresentValidation,
                unv: useNotPresentValidation,
            };

            next();
        },
        function check_md_exists(next){
            model.jobs.modelNameExists({
                name: name,
                classifier: classifier_id,
                user: user_id,
                pid: project_id
            }, next);
        },
        function abort_if_already_exists(row) {
            var next = arguments[arguments.length-1];
            if(row[0].count !== 0){
                res.json({ name:"repeated"});
                response_already_sent = true;
                next(new Error());
                return;
            } else {
                next();
            }
        },
        function add_job(next){
            model.jobs.newJob(params, 'training_job', next);
        },
        function get_job_id(_job_id){
            var next = arguments[arguments.length -1];
            job_id = _job_id;
            next();
        },
        function poke_the_monkey(next){
            pokeDaMonkey();
            next();
        },
    ], function(err, data){
        if(err){
            if(!response_already_sent){
                console.error(err.stack);
                res.json({ err:"Could not create training job"});
            }
            return;
        } else {
            res.json({ ok:"job created trainingJob:"+job_id});
        }
    });
});

router.get('/project/:projectUrl/models/:mid', function(req, res, next) {
    model.models.details(req.params.mid, function(err, model) {
        if(err) {
            if(err.message == "model not found") {
                return res.status(404).json({ error: err.message });
            }
            else {
                return next(err);
            }
        }
        res.json(model);
    });
});

router.post('/project/:projectUrl/models/savethreshold', function(req, res, next) {
    model.models.savethreshold(req.body.m,req.body.t, function(err, row) {
        if(err) return next(err);

        res.json({ok:'saved'});
    });
});

router.get('/project/:projectUrl/models/:mid/delete', function(req, res, next) {
    model.projects.findByUrl(req.params.projectUrl,
        function(err, rows)
        {
            if(err) return next(err);

            if(!rows.length){
                res.status(404).json({ error: "project not found"});
                return;
            }

            var project_id = rows[0].project_id;

            if(!req.haveAccess(project_id, "manage models and classification")) {
                return res.json({ error: "you dont have permission to 'manage models and classification'" });
            }

            model.models.delete(req.params.mid,
                function(err, row)
                {
                    if(err) return next(err);
                    var rows = "Deleted model";
                    res.json(rows);
                }
            );
        }
    );
});

router.get('/project/:projectUrl/models/:modelId/validation-list', function(req, res, next) {

    if(!req.params.modelId)
        return res.json({ error: 'missing values' });

    model.projects.modelValidationUri(req.params.modelId, function(err, row) {
        if(err) return next(err);
        
        if(!row.length) {
            return res.sendStatus(404);
        }
        
        var validationUri = row[0].uri;
        validationUri = validationUri.replace('.csv','_vals.csv');
        s3.getObject({
            Key: validationUri,
            Bucket: config('aws').bucketName
        },
        function(err, data) {
            if(err) {
                if(err.code == 'NoSuchKey') return res.json({ err: "list not found"});
                else return next(err);
            }
            var outData = String(data.Body);

            var lines = outData.split('\n');
            
            lines = lines.filter(function(line) {
                return line !== '';
            });

            async.map(lines, function(line, callback) {
                var items = line.split(',');
                var prec = items[1].trim(' ') == 1 ? 'yes' :'no';
                var modelprec = items[2].trim(' ') == 'NA' ? '-' : ( items[2].trim(' ') == 1 ? 'yes' :'no');
                var entryType = items[3] ? items[3].trim(' '):'';
                
                model.recordings.recordingInfoGivenUri(items[0], function(err, recData) {
                    if(err) return callback(err);
                    
                    if(!recData.length) return callback(null, false);
                    
                    var recUriThumb = recData[0].uri.replace('.wav','.thumbnail.png');
                    recUriThumb = recUriThumb.replace('.flac','.thumbnail.png');

                    var rowSent = {
                        site: recData[0].site,
                        date: recData[0].date,
                        presence: prec,
                        model: modelprec,
                        id: recData[0].id,
                        url: "https://"+ config('aws').bucketName + ".s3.amazonaws.com/" + recUriThumb,
                        type: entryType
                    };
                    
                    callback(null, rowSent);
                });

            },
            function(err, results) {
                if(err) return next(err);
                
                var vals = results.filter(function(vali) {
                    return !!vali;
                });
                
                debug('model validations:', vals);
                res.json({ validations: vals });
            });

        });
    });

});

router.get('/project/:projectUrl/models/:modelId/training-vector/:recId', function(req, res, next) {
    if(!req.params.modelId || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }
    
    model.models.getTrainingVector(req.params.modelId, req.params.recId, function(err, result) {
        if(err) return next(err);
        
        var vectorUri = result;
        
        s3.getObject({
            Key: vectorUri,
            Bucket: config('aws').bucketName
        },
        function(err, data){
            if(err) {
                if(err.code == 'NoSuchKey'){
                    return res.status(404).json({ err:'vector-not-found' });
                }
                else {
                    return next(err);
                }
            }
            
            async.map(String(data.Body).split(','), function(number, next) {
                next(null, parseFloat(number));
            }, function done(err, vector) {
                res.json({ vector: vector });
            });

        });
    });

});


// --------------------- validations routes -----------------------------------

router.get('/project/:projectUrl/validations', function(req, res, next) {
    if(!req.query.species_id || !req.query.sound_id) {
        return res.status(400).json({ error: "missing query parameters" });
    }
    model.projects.validationsStats(req.params.projectUrl, req.query.species_id, req.query.sound_id, function(err, stats) {
        if(err) return next(err);
        
        res.json(stats);
    });
});

// --------------------- soundscapes routes

router.post('/project/:projectUrl/soundscape/new', function(req, res, next) {
    var response_already_sent;
    var params, job_id;

    async.waterfall([
        function find_project_by_url(next){
            model.projects.findByUrl(req.params.projectUrl, next);
        },
        function gather_job_params(rows){
            var next = arguments[arguments.length -1];
            if(!rows.length){
                res.status(404).json({ err: "project not found"});
                response_already_sent = true;
                next(new Error());
                return;
            }
            var project_id = rows[0].project_id;

            if(!req.haveAccess(project_id, "manage soundscapes")) {
                console.log('user cannot create soundscape');
                response_already_sent = true;
                res.status(403).json({ err: "you dont have permission to 'manage soundscapes'" });
                return next(new Error());
            }
            params = {
                name        : (req.body.n),
                user        : req.session.user.id,
                project     : project_id,
                playlist    : (req.body.p.id),
                aggregation : (req.body.a),
                threshold   : (req.body.t),
                threshold_type : (req.body.tr),
                bin         : (req.body.b),
                maxhertz    : (req.body.m),
                frequency   : (req.body.f),
                normalize   : (req.body.nv)
            };

            next();
        },
        function check_sc_exists(next){
            model.jobs.soundscapeNameExists({name:params.name,pid:params.project}, next);
        },
        function abort_if_already_exists(row) {
            var next = arguments[arguments.length -1];
            if(row[0].count !== 0){
                res.json({ name:"repeated"});
                response_already_sent = true;
                next(new Error());
                return;
            }

            next();
        },
        function add_job(next){
            model.jobs.newJob(params, 'soundscape_job', next);
        },
        function get_job_id(_job_id){
            var next = arguments[arguments.length -1];
            job_id = _job_id;
            next();
        },
        function poke_the_monkey(next){
            pokeDaMonkey();
            next();
        }
    ], function(err){
        if(err){
            if(!response_already_sent){
                res.json({ err:"Could not create soundscape job"});
            }
            return;
        } else {
            res.json({ ok:"job created soundscapeJob:"+job_id });
        }
    });
});


module.exports = router;
