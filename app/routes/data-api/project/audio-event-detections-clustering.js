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
    converter.convert('species_id').optional().toInt();
    converter.convert('songtype_id').optional().toInt();
    converter.convert('species_name').optional().toString();
    converter.convert('songtype_name').optional().toString();
    converter.convert('aed').toArray();
    converter.convert('validated').toString();

    return converter.validate()
        .then(async (params) => {
            let opts = {
                projectId: req.project.project_id,
                speciesId: params.species_id || null,
                songtypeId: params.songtype_id || null
            }
            const validated = JSON.parse(params.validated) === -1 ? null : JSON.parse(params.validated)
            for (let d of params.aed) {
                // get existing aed row
                const [aedRow] = await model.AudioEventDetectionsClustering.getDetectionsById([d]);
                await model.AudioEventDetectionsClustering.validateDetections(params.aed, opts.speciesId, opts.songtypeId, validated);
                await model.AudioEventDetectionsClustering.updatePresentAedCount({
                    ...opts,
                    speciesId: opts.speciesId || aedRow.species_id,
                    songtypeId: opts.songtypeId || aedRow.songtype_id,
                    recordingId: aedRow.recording_id
                });
            }
            if (validated === 1) {
                let existingClass = await model.projects.getProjectClassesAsync(opts.projectId, null, { speciesId: opts.speciesId, songtypeId: opts.songtypeId });
                // add a new class to the project
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
            }
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

