/* jshint node:true */
"use strict";

const express = require('express');
const async = require('async');
const AWS = require('aws-sdk');
const q = require('q');

const model = require('../../model');
const pokeDaMonkey = require('../../utils/monkey');
const config = require('../../config');
const APIError = require('../../utils/apierror');
const router = express.Router();
const s3 = new AWS.S3();
const { httpErrorHandler } = require('@rfcx/http-utils');

// ------------------------ models routes -------------------------------------

router.get('/project/:projectUrl/models', function(req, res, next) {
    res.type('json');

    model.projects.modelList(req.params.projectUrl, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/project/:projectUrl/models/forminfo', function(req, res, next) {
    res.type('json');

    model.models.types(function(err, row1) {
        if(err) return next(err);
        
        model.projects.trainingSets( req.params.projectUrl, function(err, row2) {
            if(err) return next(err);
            
            res.json({ types:row1 , trainings:row2});
        });
    });
});

router.post('/project/:projectUrl/models/new', function(req, res, next) {
    res.type('application/json');
    var response_already_sent;
    var project_id, name, train_id, classifier_id, usePresentTraining;
    var useNotPresentTraining, usePresentValidation, useNotPresentValidation, user_id;
    var job_id, params;
    
    return model.projects.findByUrl(req.params.projectUrl).then(function gather_job_params(rows){
        if(!rows.length){
            throw new APIError({ error: "project not found"}, 404);
        }
        
        project_id = rows[0].project_id;
        
        if(!req.haveAccess(project_id, "manage models and classification")){
            throw new APIError({ error: "you dont have permission to 'manage models and classification'"});
        }
        
        name = (req.body.n);
        train_id = req.body.t;
        classifier_id = req.body.c;
        usePresentTraining = req.body.tp;
        useNotPresentTraining = req.body.tn;
        usePresentValidation = req.body.vp;
        useNotPresentValidation  = req.body.vn;
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
        
        return q.ninvoke(model.jobs, 'modelNameExists', {
            name: name,
            classifier: classifier_id,
            user: user_id,
            pid: project_id
        }).get(0);
    }).then(function abort_if_already_exists(row) {
        if(row[0].count !== 0){
            throw new APIError({ error:"Name is repeated"});
        }

        return model.jobs.newJob(params, 'training_job').catch(function(err){
            throw new APIError({ name:"Could not create training job"});
        });
    }).then(function get_job_id(_job_id){
        job_id = _job_id;

        pokeDaMonkey(); // parallel promise
        
        res.json({ ok:"job created trainingJob:"+job_id});
    }).catch(next);
});

router.get('/project/:projectUrl/models/:mid', function(req, res, next) {
    res.type('json');
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
    res.type('json');
    model.models.savethreshold(req.body.m,req.body.t, function(err, row) {
        if(err) return next(err);

        res.json({ok:'saved'});
    });
});

router.get('/project/:projectUrl/models/:mid/delete', function(req, res, next) {
    res.type('json');
    model.projects.findByUrl(req.params.projectUrl, function(err, rows) {
        if(err) return next(err);

        if(!rows.length){
            res.status(404).json({ error: "project not found"});
            return;
        }

        const project_id = rows[0].project_id;

        if(!req.haveAccess(project_id, "manage models and classification")) {
            return res.json({ error: "you dont have permission to 'manage models and classification'" });
        }
        const model_id = req.params.mid
        model.models.delete(model_id, async function(err, row) {
            if(err) return next(err);
            res.json('Model deleted');
            const jobData = await model.models.getModelJobId(model_id)
            await model.jobs.hideAsync(jobData.job_id)
        });
    });
});

router.get('/project/:projectUrl/models/:modelId/validation-list', async function(req, res, next) {
    res.type('json');
    if (!req.params.modelId) return res.json({ error: 'missing values' });
    return model.projects.modelValidationUri(req.params.modelId, async function (err, row) {
        if (!row.length) {
            return res.sendStatus(404);
        }
        let validationUri = row[0].uri;
        validationUri = validationUri.replace('.csv','_vals.csv');
        await getModelsData(validationUri)
            .then(data => {
                res.json({ validations: data });
            })
            .catch(e => httpErrorHandler(req, res, 'Failed get validations')(e))
    })
});

async function getModelsData(validationUri) {
    return new Promise(async function (resolve, reject) {
        s3.getObject({
            Key: validationUri,
            Bucket: config('aws').bucketName
        }, async function(err, data) {
            if (err) {
                if (err.code == 'NoSuchKey') return reject('Validation list not found');
                else return reject('Failed get validations');
            }
            const outData = String(data.Body);
            let lines = outData.split('\n');
            lines = lines.filter(line => { return line !== ''; })
            let rowSent = []
            for (let line of lines) {
                const items = line.split(',');
                const prec = items[1].trim(' ') == 1 ? 'yes' :'no';
                const modelprec = items[2].trim(' ') == 'NA' ? '-' : ( items[2].trim(' ') == 1 ? 'yes' :'no');
                const entryType = items[3] ? items[3].trim(' '):'';
                const recData = await model.recordings.recordingInfoGivenUri(items[0])
                if(recData && recData.length) {
                    let recUriThumb = recData[0].uri.replace('.wav','.thumbnail.png');
                    recUriThumb = recUriThumb.replace('.flac','.thumbnail.png');

                    rowSent.push({
                        site: recData[0].site,
                        date: recData[0].date,
                        presence: prec,
                        model: modelprec,
                        id: recData[0].id,
                        url: 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + recUriThumb,
                        type: entryType
                    })
                }
            }
            const vals = rowSent.filter((vali) => { return !!vali; });
            resolve(vals)
        });
    })
}

router.get('/project/:projectUrl/models/:modelId/training-vector/:recId', function(req, res, next) {
    res.type('json');
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
    res.type('json');
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
    res.type('json');
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
