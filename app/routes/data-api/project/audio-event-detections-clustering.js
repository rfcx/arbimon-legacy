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
        playlist: req.query.playlist,
        dataExtended: req.query.dataExtended,
        user: req.query.user
    })
    .then(function(data){
        res.json(data);
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
                            await model.AudioEventDetectionsClustering.updatePresentAedCount(params)
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

module.exports = router;

