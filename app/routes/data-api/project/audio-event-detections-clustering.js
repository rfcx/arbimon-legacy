/* jshint node:true */
"use strict";

const q = require('q');
const express = require('express');
const router = express.Router();
const model = require('../../../model');
const { httpErrorHandler, Converter } = require('@rfcx/http-utils');

router.get('/', function(req, res, next) {
    res.type('json');

    return model.AudioEventDetectionsClustering.find({
        project_id: req.project.project_id,
        ...!!req.query && !!req.query.rec_id && { rec_id: req.query.rec_id },
        ...!!req.query.completed && { completed: req.query.completed },
        playlist: req.query.playlist,
        dataExtended: req.query.dataExtended,
        user: req.query.user,
        deleted: 0,
        aedCount: req.query.aedCount
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.get('/total-recordings', function(req, res, next) {
    res.type('json');
    return model.AudioEventDetectionsClustering.getTotalRecInLast24Hours({
        project_id: req.project.project_id
    })
    .then(function(result) {
        res.json(result);
    }).catch(next);
});


router.post('/new', function(req, res, next) {
    res.type('json');
    return model.AudioEventDetectionsClustering.requestNewAudioEventDetectionClusteringJob({
        user_id: req.session.user.id,
        name: req.body.name,
        playlist_id: req.body.playlist_id,
        params: req.body.params,
    })
    .then(function(result){
        res.json({ create: true, result: result });
    }).catch(next);
});

router.post('/validate', function(req, res, next) {
    res.type('json');
    const userId = req.session.user.id
    const converter = new Converter(req.body, {});
    converter.convert('species_id').toInt();
    converter.convert('songtype_id').toInt();
    converter.convert('species_name').toString();
    converter.convert('songtype_name').toString();
    converter.convert('aed').toArray();

    return converter.validate()
        .then(async (params) => {
            let opts = {
                projectId: req.project.project_id,
                speciesId: params.species_id,
                songtypeId: params.songtype_id
            }
            for (let d of params.aed) {
                // Get existing aed row.
                const aedRow = await model.AudioEventDetectionsClustering.getDetectionsById([d]);
                // Check new species/songtype in the recording_validations
                let newValidation = await model.recordings.getRecordingValidation({ ...opts, recordingId: aedRow[0].recording_id });
                // If aed box is validated
                if (aedRow[0].species_id && aedRow[0].songtype_id) {
                    // If species/songtype are diffrent - decrease or remove the old present_aed count from the recording_validations
                    // If species/songtype are the same do nothing!
                    if (aedRow[0].species_id !== opts.speciesId || aedRow[0].songtype_id !== opts.songtypeId) {
                        const params = {
                            projectId: opts.projectId,
                            speciesId: aedRow[0].species_id,
                            songtypeId: aedRow[0].songtype_id,
                            recordingId: aedRow[0].recording_id
                        }
                        let oldValidation = await model.recordings.getRecordingValidation(params);
                        if (oldValidation[0].present_aed > 1) {
                            await model.AudioEventDetectionsClustering.updatePresentAedCount({ ...params, validate: false })
                        }
                        if (oldValidation[0].present_aed === 1 && oldValidation[0].present_review === 0 && oldValidation[0].present === null) {
                            await model.AudioEventDetectionsClustering.deletePresentAedCount(params)
                        }
                        // if species/songtype exists - increase a count of validations in the present_aed column
                        // if species/songtype is new - add a new row to the recording_validations
                        if (newValidation.length) {
                            await model.AudioEventDetectionsClustering.updatePresentAedCount({ ...opts, recordingId: aedRow[0].recording_id, validate: true });
                        }
                        else {
                            await model.recordings.addRecordingValidation({ ...opts, recordingId: aedRow[0].recording_id, userId })
                            await model.AudioEventDetectionsClustering.updatePresentAedCount({ ...opts, recordingId: aedRow[0].recording_id, validate: true });
                        }
                    }
                }
                else {
                    // if species/songtype exists - increase a count of validations in the present_aed column
                    // if species/songtype is new - add a new row to the recording_validations
                    if (newValidation.length) {
                        await model.AudioEventDetectionsClustering.updatePresentAedCount({ ...opts, recordingId: aedRow[0].recording_id, validate: true });
                    }
                    else {
                        await model.recordings.addRecordingValidation({ ...opts, recordingId: aedRow[0].recording_id, userId })
                        await model.AudioEventDetectionsClustering.updatePresentAedCount({ ...opts, recordingId: aedRow[0].recording_id, validate: true });
                    }
                }
            }
            await model.AudioEventDetectionsClustering.validateDetections(params.aed, opts.speciesId, opts.songtypeId)
            let existingClass = await model.projects.getProjectClassesAsync(opts.projectId, null, { speciesId: opts.speciesId, songtypeId: opts.songtypeId });
            // Add a new class to the project
            if (!existingClass.length) {
                const projectClass = {
                    project_id: opts.projectId,
                    species: params.species_name,
                    songtype: params.songtype_name
                };
                model.projects.insertClass(projectClass, function(err, result){
                    if(err) return next(err);
                });
            };
            res.sendStatus(200)
        })
        .catch(httpErrorHandler(req, res, 'Failed audio event detections validation'))
});

router.post('/unvalidate', function(req, res, next) {
    res.type('json');
    const converter = new Converter(req.body, {});
    converter.convert('aed').toArray();
    return converter.validate()
        .then(async (params) => {
            for (let d of params.aed) {
                // Get existing aed row
                const [aedRow] = await model.AudioEventDetectionsClustering.getDetectionsById([d]);
                // If aed box is validated decrease or remove the old present_aed count from the recording_validations first
                if (aedRow.species_id && aedRow.songtype_id) {
                    const params = {
                        projectId: req.project.project_id,
                        speciesId: aedRow.species_id,
                        songtypeId: aedRow.songtype_id,
                        recordingId: aedRow.recording_id
                    }
                    let [oldValidation] = await model.recordings.getRecordingValidation(params);
                    if (oldValidation.present_aed > 1) {
                        await model.AudioEventDetectionsClustering.updatePresentAedCount({ ...params, validate: false })
                    }
                    if (oldValidation.present_aed === 1 && oldValidation.present_review === 0 && oldValidation.present === null) {
                        await model.AudioEventDetectionsClustering.deletePresentAedCount(params)
                    }
                    await model.AudioEventDetectionsClustering.validateDetections([d], null, null);
                }
            }
            res.sendStatus(200)
        })
        .catch(httpErrorHandler(req, res, 'Error while removing audio event detections validation'))
});

router.post('/:aedJobId/remove', function(req, res, next) {
    res.type('json');

    const project_id = req.project.project_id;
    const job_id = req.params.aedJobId

    q.resolve().then(function(){
        if(!req.haveAccess(project_id, 'manage AED and Clustering job')){
            throw new Error({
                error: "You don't have permission to remove Audio Event Detection job"
            });
        }
    }).then(function(){
        return model.AudioEventDetectionsClustering.delete(job_id);
    }).then(async function(){
        res.json({ ok: true });
        await model.jobs.hideAsync(job_id)
    }).catch(next);
});

module.exports = router;

