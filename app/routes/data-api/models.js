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
const s3RFCx = new AWS.S3(getS3ClientConfig('aws_rfcx'))
const { httpErrorHandler } = require('@rfcx/http-utils');
const moment = require('moment');

function getS3ClientConfig (type) {
    return {
        accessKeyId: config(type).accessKeyId,
        secretAccessKey: config(type).secretAccessKey,
        region: config(type).region
    }
}

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
    let project_id, name, train_id, classifier_id, usePresentTraining;
    let useNotPresentTraining, usePresentValidation, useNotPresentValidation, user_id;
    let job_id, params1, params2, trainedJobId, isRetrain;
    
    return model.projects.findByUrl(req.params.projectUrl).then(function gather_job_params(rows){
        if(!rows.length){
            throw new APIError({ error: "project not found"}, 404);
        }
        
        project_id = rows[0].project_id;
        
        if(!req.haveAccess(project_id, "manage models and classification")){
            throw new APIError({ error: "you dont have permission to 'manage models and classification'"});
        }
        isRetrain = req.body.isRetrain;
        name = (req.body.n);
        train_id = req.body.t;
        classifier_id = req.body.c;
        usePresentTraining = req.body.tp;
        useNotPresentTraining = req.body.tn;
        usePresentValidation = req.body.vp;
        useNotPresentValidation  = req.body.vn;
        user_id = req.session.user.id;
        if (isRetrain) {
            const reg = /job_(\d+)_/.exec(req.body.modelUri);
            trainedJobId = +reg[1];
        }
        params1 = {
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
        params2 = {
            trained_job_id: trainedJobId,
            user: user_id,
            project: project_id
        };
        if (isRetrain) return;
        return q.ninvoke(model.jobs, 'modelNameExists', {
            name: name,
            classifier: classifier_id,
            user: user_id,
            pid: project_id
        }).get(0);
    }).then(function abort_if_already_exists(row) {
        if (row && row[0] && row[0].count !== 0 && !isRetrain) {
            throw new APIError({ error:"Name is repeated"});
        }
        return model.jobs.newJob(isRetrain ? params2 : params1, isRetrain ? 'retraining_job' : 'training_job').catch(function(err) {
            throw new APIError({ name: `Could not create ${isRetrain ? 'retraining' : 'training'} job` });
        });
    }).then(function get_job_id(_job_id) {
        job_id = _job_id;
        pokeDaMonkey(); // parallel promise

        return model.models.createRFM({
            jobId: job_id,
            isRetrain: true
        }, function(err, data) {
            if (err) return res.json({ err: `Could not create ${isRetrain ? 'retraining' : 'training'} job` });
            res.json({ ok: `Job created, ${isRetrain ? 'retraining' : 'training'} Job: ${job_id}` });
        })
    }).catch(next);
});

router.get('/project/:projectUrl/models/:mid', function(req, res, next) {
    res.type('json');
    model.models.getModelById(req.params.mid, async function(err, modelData) {
        const [data] = modelData;
        const isSharedModel = !data.uri.startsWith(`project_${data.project_id}`)
        let opts = {
            isSharedModel
        };
        if (isSharedModel) {
            opts.sourceTrainingSetId = data.training_set_id;
            const regexResult = /project_(\d+)/.exec(data.uri);
            const sourceProjectId = +regexResult[1];
            const sourceModelData = await model.models.getModelByUri(sourceProjectId, data.uri);
            opts.sourceModelId = sourceModelData.model_id;
            const reg = /job_(\d+)_/.exec(data.uri);
            opts.sourceJobId = +reg[1];
        }
        model.models.details(req.params.mid, opts, function(err, model) {
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
    })
});

router.post('/project/:projectUrl/models/savethreshold', function(req, res, next) {
    res.type('json');
    model.models.savethreshold(req.body.m,req.body.t, function(err, row) {
        if(err) return next(err);

        res.json({ok:'saved'});
    });
});

router.post('/project/:projectUrl/models/share-model', function(req, res, next) {
    res.type('json');
    const opts = {
        modelId: req.body.modelId,
        modelName: req.body.modelName,
        projectIdTo: req.body.projectId,
    }
    model.models.checkExistingModel(opts, function(err, result) {
        if (err) return next(err);
        if (result.length) return res.json({ ok:'This model has been shared to selected project.' });
        return model.models.shareModel(opts, function(err, result) {
            if(err) return next(err);
            res.json({ ok:'The model was successfully shared with the selected project.' });
        });
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
    const isProd = process.env.NODE_ENV === 'production';
    const awsConfig = isProd ? config('aws') : config('aws_rfcx');
    const awsBucket = isProd ? awsConfig.bucketName : awsConfig.bucketNameStaging;
    const awsRegion = isProd ? awsConfig.region : awsConfig.region;
    return new Promise(async function (resolve, reject) {
        (isProd ? s3 : s3RFCx).getObject({
            Key: validationUri,
            Bucket: awsBucket
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
                const [recording] = await model.recordings.recordingInfoGivenUri(items[0]);
                if (!recording) continue
                const meta = recording.meta ? model.recordings.__parse_meta_data(recording.meta) : null;
                const filename = meta && meta.filename ? meta.filename : meta && meta.file ? meta.file : '---';
                const site = await model.sites.findByIdAsync(recording.site_id)
                let recUrl;
                if (recording.uri.startsWith('project_')) {
                    const thumbnailUri = recording.uri.replace('.flac', '.thumbnail.png');
                    const recThumbnail = 'https://' + awsBucket + '.s3.' + awsRegion + '.amazonaws.com/' + thumbnailUri;
                    recUrl = recThumbnail;
                }
                else {
                    const momentStart = moment.utc(recording.datetime_utc ? recording.datetime_utc : recording.datetime)
                    const momentEnd = momentStart.clone().add(recording.duration, 'seconds')
                    const dateFormat = 'YYYYMMDDTHHmmssSSS'
                    const start = momentStart.format(dateFormat)
                    const end = momentEnd.format(dateFormat)
                    recUrl = `/legacy-api/ingest/recordings/${site[0].external_id}_t${start}Z.${end}Z_rfull_g1_fspec_d600.512_wdolph_z120.png`
                }
                rowSent.push({
                    site: recording.site,
                    recording: filename,
                    date: recording.date,
                    presence: prec,
                    model: modelprec,
                    id: recording.id,
                    url: recUrl,
                    type: entryType
                })
            }
            const vals = rowSent.length ? rowSent.filter((vali) => { return !!vali; }) : [];
            resolve(vals)
        });
    })
}

router.get('/project/:projectUrl/models/:modelId/training-vector/:recId', function(req, res, next) {
    res.type('json');
    if(!req.params.modelId || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }
    model.models.getModelById(req.params.modelId, async function(err, modelData) {
        const [data] = modelData;
        const isSharedModel = !data.uri.startsWith(`project_${data.project_id}`);
        let sourceModelId;
        if (isSharedModel) {
            const regexResult = /project_(\d+)/.exec(data.uri);
            const sourceProjectId = +regexResult[1];
            const sourceModelData = await model.models.getModelByUri(sourceProjectId, data.uri);
            sourceModelId = sourceModelData.model_id;
        }
        model.models.getTrainingVector(isSharedModel ? sourceModelId : req.params.modelId, req.params.recId, function(err, result) {
            if(err) return next(err);
            
            const vectorUri = result;
            const isProd = process.env.NODE_ENV === 'production';
            const awsConfig = isProd ? config('aws') : config('aws_rfcx');
            const awsBucket = isProd ? awsConfig.bucketName : awsConfig.bucketNameStaging;
            (isProd ? s3 : s3RFCx).getObject({
                Key: vectorUri,
                Bucket: awsBucket
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

router.post('/project/:projectUrl/soundscape/multiple-batch', function(req, res, next) {
    res.type('json');
    let siteNames = req.body.s.split(',')
    let isSearchResult = false
    let isSearchAll = false
    siteNames.forEach(site => {
        if (site.includes('Select all search result')) return isSearchResult = true
        if (site.includes('Select all')) return isSearchAll = true
    })
    if (isSearchResult) {
        const names = siteNames.filter(site => !site.includes('Select all search result'))
        const filteredSite = siteNames.filter(site => site.includes('Select all search result'))
        const filteredSiteNames = filteredSite.map(site => {
            const reg = /Select all search result \((.*?)\)/.exec(site)
            return reg[1]
        })
        const finalArray = names.concat(filteredSiteNames)
        siteNames = finalArray.join(",")
    }
    else if (isSearchAll) {
        siteNames = ''
    }
    else siteNames = req.body.s
    console.log('<- soundscape/multiple-batch siteNames', siteNames)
    return model.soundscapes.createMultipleSoundscape({
        projectUrl: req.body.projectUrl,
        sites: siteNames,
        year: req.body.y.toString(),
        aggregation: req.body.a,
        binSize: req.body.b.toString(),
        normalize: req.body.nv.toString(),
        threshold: req.body.t.toString(),
        userId: req.body.u.toString()
    }, function(err, data) {
        if (err) return next(err);
        res.json({ create: data });
    })
})

router.post('/project/:projectUrl/soundscape/single-batch', function(req, res, next) {
    res.type('json');
    const normalized = req.body.nv === true ? 1 : 0;
    return model.soundscapes.createSingleSoundscape({
        playlistId: req.body.p.id,
        jobName: req.body.n.toString(),
        aggregation: req.body.a,
        binSize: req.body.b.toString(),
        normalize: normalized.toString(),
        threshold: req.body.t.toString(),
        userId: req.body.u.toString()
    }, function(err, data) {
        if (err) return next(err);
        res.json({ create: data });
    })
})

router.post('/project/:projectUrl/soundscape/new', function(req, res, next) {
    res.type('json');
    let response_already_sent;
    let params, job_id;

    async.waterfall([
        function find_project_by_url(next){
            model.projects.findByUrl(req.params.projectUrl, next);
        },
        function gather_job_params(rows){
            let next = arguments[arguments.length -1];
            if(!rows.length){
                res.status(404).json({ err: "project not found"});
                response_already_sent = true;
                next(new Error());
                return;
            }
            let project_id = rows[0].project_id;

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
            let next = arguments[arguments.length -1];
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
            let next = arguments[arguments.length -1];
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
