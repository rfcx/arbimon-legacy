/* jshint node:true */
"use strict";

const express = require('express');
const async = require('async');
const AWS = require('aws-sdk');
const q = require('q');

const model = require('../../model');
const pokeDaMonkey = require('../../utils/monkey');
const config = require('../../config');
const { arbimon2PublicUrl, mediaStreamId } = require('../../utils/asset-url');
const APIError = require('../../utils/apierror');
const router = express.Router();
const { createS3Client } = require('../../utils/storage');
// endpoint-aware: route through s3-proxy/s3-reader/s3-writer chain.
const s3 = createS3Client('aws');
const s3RFCx = createS3Client('aws_rfcx');
const { httpErrorHandler } = require('@rfcx/http-utils');
const moment = require('moment');

// ------------------------ models routes -------------------------------------

router.get('/project/:projectUrl/models', function(req, res, next) {
    res.type('json');

    model.projects.modelList(req.params.projectUrl, async function(err, rows) {
        if (err) return next(err);
        for (let row of rows) {
            row.retrained = await model.models.isModelRetrained(row.job_id);
        }
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
            isRetrain: isRetrain
        }, function(err, data) {
            if (err) return res.json({ err: `Could not create ${isRetrain ? 'retraining' : 'training'} job` });
            res.json({ ok: `Job created, ${isRetrain ? 'retraining' : 'training'} Job: ${job_id}` });
        })
    }).catch(next);
});

router.get('/project/:projectUrl/models/:mid', function(req, res, next) {
    res.type('json');
    model.models.getModelById(req.params.mid, async function(err, modelData) {
        // Guarded 2026-08-09: err was ignored and `[data]` destructured
        // unchecked -- an empty result (bad id today; at DB_ENGINE=pg any
        // just-created model not yet on the */2 delta tick) threw on
        // `data.uri` inside an un-awaited async callback = pod kill.
        if (err) return next(err);
        const [data] = modelData || [];
        if (!data) return res.status(404).json({ error: 'model not found' });
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

router.post('/project/:projectUrl/models/:mid/unshare', function(req, res, next) {
    res.type('json');
    let opts = {
        modelId: req.body.model,
        projectId: req.body.project,
    }
    model.models.unshareModel(opts)
        .then((rows) => {
            res.status(201).json({ message: 'The model was successfully unshared from the project.' });
        })
        .catch(next)
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
            // CRASH CONTAINMENT (2026-08-09). This tail runs AFTER res.json in an
            // async callback that nothing awaits, so any throw here is an
            // unhandled rejection -> fatal under node 16 -> POD RESTART. That
            // happened 3x on 2026-08-08 22:04-22:06Z: each training job writes
            // TWO model rows and job_params_training links only ONE, so deleting
            // the unlinked twin makes getModelJobId() return undefined and the
            // bare `jobData.job_id` deref killed the pod (51 such live models).
            // TWO layers, both required (proven in-container 2026-08-09):
            //  1. the guard: skip hide() when no jpt row links this model. This
            //     is semantically CORRECT, not a fallback -- the row that IS
            //     linked may belong to a still-alive twin model (6394/6395
            //     from job 168730), so resolving the job any other way (e.g.
            //     from the uri) would hide a LIVE model's job.
            //  2. the try/catch: a guard alone still dies when the READ itself
            //     rejects (DB error; at 6.4, any PG-side failure). Nothing
            //     awaits this callback, so the tail must contain its own errors.
            try {
                const jobData = await model.models.getModelJobId(model_id)
                if (jobData && jobData.job_id) {
                    await model.jobs.hideAsync(jobData.job_id)
                } else {
                    console.log(`models/${model_id}/delete: no training-job row; nothing to hide`)
                }
            } catch(e) {
                console.error(`models/${model_id}/delete: post-delete job-hide failed (model already deleted, response already sent):`, e && e.message)
            }
        });
    });
});

router.get('/project/:projectUrl/models/:modelId/validation-list', async function(req, res, next) {
    res.type('json');
    if (!req.params.modelId) return res.json({ error: 'missing values' });
    return model.projects.modelValidationUri(req.params.modelId, async function (err, row) {
        // Guarded 2026-08-09: `row.length` itself threw when row was
        // undefined (err path / empty result) -- check err and shape first.
        if (err) return next(err);
        if (!row || !row.length) {
            return res.sendStatus(404);
        }
        let validationUri = row[0].uri;
        validationUri = validationUri.replace('.csv','_vals.csv');
        await getModelsData(validationUri, +req.query.limit, +req.query.offset)
            .then(data => {
                res.json({ validations: data });
            })
            .catch(e => httpErrorHandler(req, res, 'Failed get validations')(e))
    })
});

async function getModelsData(validationUri, limit, offset) {
    const isProd = process.env.NODE_ENV === 'production';
    const awsConfig = isProd ? config('aws') : config('aws_rfcx');
    const awsBucket = isProd ? awsConfig.bucketName : awsConfig.bucketNameStaging;
    const awsRegion = isProd ? awsConfig.region : awsConfig.region;
    // CRASH CONTAINMENT (2026-08-08). This was `new Promise(async ...)` with
    // an ASYNC s3 callback inside it. A throw in either position escapes as an
    // UNHANDLED REJECTION rather than rejecting this promise -- fatal under
    // node 16 (process exits, pod restarts, all in-flight requests die).
    // Proven live in-container; see the note on jobs.getJobUrl.
    //
    // The reachable throw here is `site[0].external_id` below: findByIdAsync
    // can legitimately return an empty array (deleted/hidden site), and the
    // sibling `recording.meta` access is already defensively guarded.
    // The async callback body is now wrapped so any throw REJECTS this
    // promise, which the caller already handles.
    return new Promise(function (resolve, reject) {
        (isProd ? s3 : s3RFCx).getObject({
            Key: validationUri,
            Bucket: awsBucket
        }, async function(err, data) {
            if (err) {
                if (err.code == 'NoSuchKey') return reject('Validation list not found');
                else return reject('Failed get validations');
            }
            try {
            const outData = String(data.Body);
            let lines = outData.split('\n');
            lines = lines.filter(line => { return line !== ''; })
            let rowSent = [];
            for (let line of lines.slice(offset,offset+limit)) {
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
                // Guarded: an empty site lookup used to throw here and kill
                // the pod. A row we cannot resolve simply gets no thumbnail.
                const siteExternalId = (site && site[0]) ? site[0].external_id : null;
                if (recording.uri.startsWith('project_')) {
                    const thumbnailUri = recording.uri.replace('.flac', '.thumbnail.png');
                    recUrl = arbimon2PublicUrl(thumbnailUri);
                }
                else {
                    const momentStart = moment.utc(recording.datetime_utc ? recording.datetime_utc : recording.datetime)
                    const momentEnd = momentStart.clone().add(recording.duration, 'seconds')
                    const dateFormat = 'YYYYMMDDTHHmmssSSS'
                    const start = momentStart.format(dateFormat)
                    const end = momentEnd.format(dateFormat)
                    // `mtrue` = MONOCHROME. Without it media-api defaults
                    // monochrome to false (segment-file-parsing.js) and returns an
                    // 8-bit RGB spectrogram -- inconsistent with every other ROI
                    // surface and ~2.8x the bytes (measured 2026-08-10).
                    //
                    // 1200x160 for the SAME reason as classifications.js: this url
                    // is bound to `selected.url` on modelinfo.html:413, which is the
                    // SAME `.sm-result-thumb` strip (height:100px; width:100%)
                    // that surface -- measured 700x100 / 920x100 / 1120x100 across
                    // the Bootstrap-3 container widths, i.e. 7:1 to 11.2:1. The old
                    // 600x512 (1.17:1) was stretched 6-9.6x horizontally at only
                    // 0.54-0.86 source px per displayed px while wasting 5.12x
                    // vertical resolution. Keeping the two endpoints on the SAME
                    // geometry also keeps them sharing one cache object per window.
                    // uri-first stream id (site external_id is wrong/NULL for 11
                    // sites — OPEN-ITEMS #107; same derivation as buildMediaApiAttr).
                    const streamId = mediaStreamId(recording.uri, siteExternalId)
                    recUrl = streamId
                        ? `/legacy-api/ingest/recordings/${streamId}_t${start}Z.${end}Z_rfull_g1_fspec_mtrue_d1200.160_wdolph_z120.png`
                        : null
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
            } catch (e) {
                // Never let this become an unhandled rejection.
                reject(e)
            }
        });
    })
}

router.get('/project/:projectUrl/models/:mid/retraining', function(req, res, next) {
    res.type('json');
    model.models.getModelRetrainingDates(req.query.jobId, function(err, rows) {
        if(err) return next(err);
        res.json(rows);
    });
});

router.get('/project/:projectUrl/models/:mid/shared', function(req, res, next) {
    res.type('json');
    let opts = {
        modelName: req.query.modelName
    }
    return model.projects.find({ url: req.params.projectUrl }, function(err, data) {
        opts.projectId = data[0].project_id;
        model.models.getSharedModels(opts)
            .then((rows) => {
                res.status(200).json(rows);
            })
            .catch(next)
    })
});

router.get('/project/:projectUrl/models/:modelId/training-vector/:recId', function(req, res, next) {
    res.type('json');
    if(!req.params.modelId || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }
    model.models.getModelById(req.params.modelId, async function(err, modelData) {
        // Guarded 2026-08-09: same shape as the /models/:mid route above.
        if (err) return next(err);
        const [data] = modelData || [];
        if (!data) return res.status(404).json({ error: 'model not found' });
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

router.post('/project/:projectUrl/soundscape/single-batch', function(req, res, next) {
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
        function add_job(next) {
            model.jobs.newJob(params, 'soundscape_job', next);
        },
        function get_job_id(_job_id){
            let next = arguments[arguments.length -1];
            job_id = _job_id;
            return model.soundscapes.createSingleSoundscape(job_id, function(err, data) {
                if (err) return next(err);
                next();
            })
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
