/* jshint node:true */
"use strict";

/**
 * /legacy-api/project/:projectUrl/models/*  (mounted by ./index.js)
 *
 * rfcx-local OPEN-ITEMS §394 (2026-09-25). These routes used to live in
 * app/routes/data-api/models.js, mounted at the data-api ROOT, so index.js's
 * `router.param('projectUrl')` -- the only thing that checks the session user
 * can open the project -- never ran for them (Express params are per-router).
 * Measured on prod before the move, as a NON-member, non-super user:
 * `/project/<private project>/models` → 200 with all 469 models;
 * `/project/<own project>/models/<another project's model id>` → 200 details.
 * Three write routes had no permission check at all (savethreshold,
 * share-model, :mid/unshare) and share-model string-interpolated the body
 * into an INSERT … SELECT.
 *
 * Now: mounted as `router.use('/:projectUrl/models', …)` inside the project
 * router, so `req.project` is the URL's project, already authorised; every
 * model id is bound to it (build/check-project-scope.js enforces that); every
 * write asks `req.haveAccess(…, 'manage models and classification')`.
 *
 * OWNERSHIP (app/utils/project-scope.js):
 *   'model'     readable from P: the row is P's (an original, or a SHARED COPY
 *               share-model inserted into P) OR it is imported into P via
 *               project_imported_models. Used by every read.
 *   'model_own' writable from P: the row is P's. An imported model is another
 *               project's row; writing it from P would change the source.
 * A foreign id is answered EXACTLY like an unknown one (404 "model not found").
 */

const express = require('express');
const async = require('async');
const q = require('q');

const model = require('../../../model');
const pokeDaMonkey = require('../../../utils/monkey');
const config = require('../../../config');
const { mediaAssetUrl, mediaStreamId } = require('../../../utils/asset-url');
const { arbimon2AssetUrl } = require('../../../utils/arbimon2-asset-url');
const APIError = require('../../../utils/apierror');
const projectScope = require('../../../utils/project-scope');
const router = express.Router();
const { createS3Client } = require('../../../utils/storage');
// endpoint-aware: route through s3-proxy/s3-reader/s3-writer chain.
const s3 = createS3Client('aws');
const s3RFCx = createS3Client('aws_rfcx');
const { httpErrorHandler } = require('@rfcx/http-utils');
const moment = require('moment');

const MANAGE = 'manage models and classification';
const NOT_FOUND = { error: 'model not found' };
const NO_PERMISSION = { error: "you dont have permission to 'manage models and classification'" };

/** The models row for `mid` (or undefined). An explicit callback, not
 *  q.ninvoke: ninvoke's resolved shape depends on how many args queryHandler
 *  passes (rows vs [rows, fields]). */
function modelRow(mid) {
    return new Promise(function(resolve, reject) {
        model.models.getModelById(mid, function(err, rows) {
            if (err) { return reject(err); }
            resolve(rows && rows[0]);
        });
    });
}

/** 404 unless model `mid` is readable ('model') / writable ('model_own') from the URL project. */
function requireModel(kind, mid, req, res, next, then) {
    projectScope.ownedByProject(kind, mid, req.project.project_id).then(function(owned) {
        if (!owned) { return res.status(404).json(NOT_FOUND); }
        return then();
    }).catch(next);
}

// ------------------------ models routes -------------------------------------

router.get('/', function(req, res, next) {
    res.type('json');

    model.projects.modelList(req.project.url, async function(err, rows) {
        if (err) return next(err);
        try {
            for (let row of rows) {
                row.retrained = await model.models.isModelRetrained(row.job_id);
            }
        } catch (e) { return next(e); }
        res.json(rows);
    });
});

router.get('/forminfo', function(req, res, next) {
    res.type('json');

    model.models.types(function(err, row1) {
        if(err) return next(err);

        model.projects.trainingSets( req.project.url, function(err, row2) {
            if(err) return next(err);

            res.json({ types:row1 , trainings:row2});
        });
    });
});

router.post('/new', function(req, res, next) {
    res.type('application/json');
    let project_id, name, train_id, classifier_id, usePresentTraining;
    let useNotPresentTraining, usePresentValidation, useNotPresentValidation, user_id;
    let job_id, params1, params2, trainedJobId, isRetrain;

    return q.fcall(function gather_job_params(){
        project_id = req.project.project_id;

        if(!req.haveAccess(project_id, MANAGE)){
            throw new APIError(NO_PERMISSION);
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
            const reg = /job_(\d+)_/.exec(req.body.modelUri || '');
            if (!reg) { throw new APIError({ error: 'model not found' }, 404); }
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
        // §394: the job's INPUTS come from the body, so bind them to this
        // project too -- a retrain retrains one of this project's jobs; a new
        // model trains on one of this project's training sets.
        return (isRetrain
            ? projectScope.ownedByProject('job', trainedJobId, project_id)
            : projectScope.ownedByProject('training_set', train_id, project_id)
        ).then(function(owned) {
            if (!owned) {
                throw new APIError({ error: isRetrain ? 'model not found' : 'training set not found' }, 404);
            }
        });
    }).then(function check_name() {
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

        // rfcx-local 2026-09-13 (OPEN-ITEMS §300 item 2): the `jobs` row from
        // newJob() above IS the enqueue; the k8s Job POST is the upstream
        // AWS-EKS execution path and its failure does not un-create the job.
        // Answering `err` here reported a SUCCESSFUL create as a failure
        // (job 169894 ran to `completed` while the user saw an error).
        return model.models.createRFM({
            jobId: job_id,
            isRetrain: isRetrain
        }, function(err, data) {
            if (err) {
                console.error('createRFM unexpected error for job ' + job_id + ':', err);
            }
            const body = { ok: `Job created, ${isRetrain ? 'retraining' : 'training'} Job: ${job_id}` };
            if (data && data.warning) { body.warning = data.warning; }
            res.json(body);
        })
    }).catch(next);
});

// Body-addressed writes. Declared BEFORE `/:mid` so the literal segments win.

// The body model id is bound to req.project (model_own) before the UPDATE.
router.post('/savethreshold', function(req, res, next) {
    res.type('json');
    if (!req.haveAccess(req.project.project_id, MANAGE)) {
        return res.status(403).json(NO_PERMISSION);
    }
    requireModel('model_own', req.body.m, req, res, next, function() {
        model.models.savethreshold(req.body.m, req.body.t, req.project.project_id, function(err, row) {
            if(err) return next(err);

            res.json({ok:'saved'});
        });
    });
});

// share-model copies one of THIS project's models into another project. It is
// a cross-project write by design, so both ends are authorised: the source
// must be an ORIGINAL of this project (a copy or an import is not ours to
// re-share -- the legacy UI already hides those), and the user must be able to
// manage models in the TARGET (the same Admin/Owner/Expert set the picker,
// /get-projects-by-role, offers).
router.post('/share-model', function(req, res, next) {
    res.type('json');
    const projectIdTo = Number(req.body.projectId);
    const modelId = req.body.modelId;
    if (!req.haveAccess(req.project.project_id, MANAGE)) {
        return res.status(403).json(NO_PERMISSION);
    }
    if (!(projectIdTo > 0) || Math.floor(projectIdTo) !== projectIdTo || projectIdTo === req.project.project_id) {
        return res.status(400).json({ error: 'invalid target project' });
    }
    requireModel('model_own', modelId, req, res, next, function() {
        modelRow(modelId).then(function(source) {
            if (!source || !String(source.uri || '').startsWith(`project_${req.project.project_id}/`)) {
                return res.status(404).json(NOT_FOUND);
            }
            return canManageModelsIn(req, projectIdTo).then(function(allowed) {
                if (!allowed) {
                    return res.status(403).json({ error: "you dont have permission to 'manage models and classification' in the selected project" });
                }
                const opts = { modelId: source.model_id, modelName: source.name, projectIdTo: projectIdTo };
                model.models.checkExistingModel(opts, function(err, result) {
                    if (err) return next(err);
                    if (result.length) return res.json({ ok:'This model has been shared to selected project.' });
                    return model.models.shareModel(opts, function(err) {
                        if(err) return next(err);
                        res.json({ ok:'The model was successfully shared with the selected project.' });
                    });
                });
            });
        }).catch(next);
    });
});

/** req.haveAccess for a project the session may not have loaded permissions for yet. */
function canManageModelsIn(req, projectId) {
    const user = req.session && req.session.user;
    if (!user) { return Promise.resolve(false); }
    const cached = user.permissions && user.permissions[projectId];
    if ((cached && cached.length) || user.isSuper === 1) {
        return Promise.resolve(req.haveAccess(projectId, MANAGE));
    }
    return Promise.resolve(model.users.getPermissions(user.id, projectId)).then(function(rows) {
        return (rows || []).some(function(p) { return p && p.name === MANAGE; });
    });
}

// ------------------------ :mid routes ---------------------------------------

// Every :mid / :modelId below is READABLE-bound to the URL project (own row,
// shared copy in it, or imported into it) before any handler runs. Writes
// re-check with 'model_own'.
router.param('mid', function(req, res, next, mid) {
    requireModel('model', mid, req, res, next, next);
});
router.param('modelId', function(req, res, next, modelId) {
    requireModel('model', modelId, req, res, next, next);
});

router.get('/:mid', function(req, res, next) {
    res.type('json');
    model.models.getModelById(req.params.mid, async function(err, modelData) {
        // Guarded 2026-08-09: err was ignored and `[data]` destructured
        // unchecked -- an empty result (bad id today; at DB_ENGINE=pg any
        // just-created model not yet on the */2 delta tick) threw on
        // `data.uri` inside an un-awaited async callback = pod kill.
        if (err) return next(err);
        const [data] = modelData || [];
        if (!data) return res.status(404).json(NOT_FOUND);
        const isSharedModel = !data.uri.startsWith(`project_${data.project_id}`)
        let opts = {
            isSharedModel
        };
        try {
            if (isSharedModel) {
                opts.sourceTrainingSetId = data.training_set_id;
                const regexResult = /project_(\d+)/.exec(data.uri);
                const sourceProjectId = +regexResult[1];
                const sourceModelData = await model.models.getModelByUri(sourceProjectId, data.uri);
                // A copy whose source row is gone (33 of 67 copies on
                // 2026-09-25) has nothing to read details from.
                if (!sourceModelData) return res.status(404).json(NOT_FOUND);
                opts.sourceModelId = sourceModelData.model_id;
                const reg = /job_(\d+)_/.exec(data.uri);
                opts.sourceJobId = +reg[1];
            }
        } catch (e) { return next(e); }
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

// unshare is called from the SOURCE model's page: `:mid` is this project's
// original, and the body names one of its copies in another project (a row of
// GET /:mid/shared). The copy may be deleted only when it is a copy OF `:mid`
// (same uri) and lives elsewhere; the DELETE itself repeats both predicates.
// (:mid is read-bound by router.param above; the handler re-binds it as model_own.)
router.post('/:mid/unshare', function(req, res, next) {
    res.type('json');
    if (!req.haveAccess(req.project.project_id, MANAGE)) {
        return res.status(403).json(NO_PERMISSION);
    }
    requireModel('model_own', req.params.mid, req, res, next, function() {
        modelRow(req.params.mid).then(function(source) {
            if (!source || !String(source.uri || '').startsWith(`project_${req.project.project_id}/`)) {
                return res.status(404).json(NOT_FOUND);
            }
            return model.models.unshareModel({
                modelId: req.body.model,
                projectId: req.body.project,
                sourceUri: source.uri,
                sourceProjectId: req.project.project_id
            }).then(function(result) {
                const affected = result && (result.affectedRows !== undefined ? result.affectedRows : result.rowCount);
                if (affected === 0) {
                    return res.status(404).json({ error: 'shared model not found' });
                }
                res.status(201).json({ message: 'The model was successfully unshared from the project.' });
            });
        }).catch(next);
    });
});

// (:mid is read-bound by router.param above; the handler re-binds it as model_own.)
router.get('/:mid/delete', function(req, res, next) {
    res.type('json');
    const project_id = req.project.project_id;

    if(!req.haveAccess(project_id, MANAGE)) {
        return res.json(NO_PERMISSION);
    }
    const model_id = req.params.mid
    requireModel('model_own', model_id, req, res, next, function() {
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
                    // 2026-09-09 (OPEN-ITEMS §292): hide is now project-scoped.
                    // `project_id` here is the URL's project, which the
                    // haveAccess check above already used.
                    await model.jobs.hideAsync(jobData.job_id, project_id)
                } else {
                    console.log(`models/${model_id}/delete: no training-job row; nothing to hide`)
                }
            } catch(e) {
                console.error(`models/${model_id}/delete: post-delete job-hide failed (model already deleted, response already sent):`, e && e.message)
            }
        });
    });
});

router.get('/:modelId/validation-list', async function(req, res, next) {
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
                    recUrl = arbimon2AssetUrl(thumbnailUri); // 2026-09-24: auth-gated, never a public s3.arbimon.org/arbimon2 url
                }
                else {
                    const momentStart = moment.utc(recording.datetime_utc ? recording.datetime_utc : recording.datetime)
                    const baseMs = momentStart.valueOf()
                    // Math.trunc reproduces moment .add()'s truncation of
                    // fractional milliseconds; Math.round (mediaAssetUrl's own
                    // rounding) would shift the window by 1 ms for durations
                    // like 1.4999 s, and 1 ms of drift silently 401s a signed
                    // url. Non-finite -> 0, matching moment's treatment of
                    // null/undefined. Verified equivalent over a 4,000-case fuzz.
                    const durationSec = Number(recording.duration)
                    const durationMs = isFinite(durationSec) ? Math.trunc(durationSec * 1000) : 0
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
                    // DIRECT to media-api with a server-minted token (#99),
                    // replacing the session-gated `/legacy-api/ingest` proxy.
                    const minted = streamId && isFinite(baseMs)
                        ? mediaAssetUrl(streamId, baseMs, baseMs + durationMs, 'rfull_g1_fspec_mtrue_d1200.160_wdolph_z120.png')
                        : null
                    recUrl = minted ? minted.url : null
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

// ?jobId= is the model's training job, as GET /:mid reported it: the jpt job
// for an original, the SOURCE job (named in the copied uri) for a shared copy.
// Any other job id reads nothing. (uri job == jpt job for 6,469 of 6,484
// originals; accepting both keeps the other 15 working.)
router.get('/:mid/retraining', function(req, res, next) {
    res.type('json');
    model.models.getModelById(req.params.mid, function(err, rows) {
        if (err) return next(err);
        const data = rows && rows[0];
        const reg = data && /job_(\d+)_/.exec(data.uri || '');
        const asked = String(req.query.jobId);
        Promise.resolve(model.models.getModelJobId(req.params.mid)).then(function(jpt) {
            const allowed = [reg && reg[1], jpt && jpt.job_id !== undefined && String(jpt.job_id)].filter(Boolean);
            if (allowed.indexOf(asked) < 0) {
                return res.json([]);
            }
            model.models.getModelRetrainingDates(asked, function(err, rows) {
                if(err) return next(err);
                res.json(rows);
            });
        }).catch(next);
    });
});

router.get('/:mid/shared', function(req, res, next) {
    res.type('json');
    let opts = {
        modelName: req.query.modelName,
        projectId: req.project.project_id
    }
    model.models.getSharedModels(opts)
        .then((rows) => {
            res.status(200).json(rows);
        })
        .catch(next)
});

// project-scope: params recId read through the bound model's training vectors (an S3 key under the model's job)
router.get('/:modelId/training-vector/:recId', function(req, res, next) {
    res.type('json');
    if(!req.params.modelId || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }
    model.models.getModelById(req.params.modelId, async function(err, modelData) {
        // Guarded 2026-08-09: same shape as the /:mid route above.
        if (err) return next(err);
        const [data] = modelData || [];
        if (!data) return res.status(404).json(NOT_FOUND);
        const isSharedModel = !data.uri.startsWith(`project_${data.project_id}`);
        let sourceModelId;
        try {
            if (isSharedModel) {
                const regexResult = /project_(\d+)/.exec(data.uri);
                const sourceProjectId = +regexResult[1];
                const sourceModelData = await model.models.getModelByUri(sourceProjectId, data.uri);
                if (!sourceModelData) return res.status(404).json(NOT_FOUND);
                sourceModelId = sourceModelData.model_id;
            }
        } catch (e) { return next(e); }
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

module.exports = router;