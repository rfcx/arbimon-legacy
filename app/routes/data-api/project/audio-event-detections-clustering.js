/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');

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

router.post('/records', function(req, res, next) {
    res.type('json');

    return model.AudioEventDetectionsClustering.findClusteredDetections({
        project_id: req.project.project_id,
        aed_id: req.body.aed_id,
        aed_id_in: req.body.aed_id_in
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
    const validation = req.body.validation
    return model.AudioEventDetectionsClustering.validateDetections(req.body.aed, validation)
        .then(async function(result) {
            let existingClass = await model.projects.getProjectClassesAsync(req.project.project_id, null, { speciesId: validation.speciesId, songtypeId: validation.songtypeId });
            if (!existingClass.length) {
                const projectClass = {
                    project_id: req.project.project_id,
                    species: validation.speciesName,
                    songtype: validation.songtypeName
                };
                model.projects.insertClass(projectClass, function(err, result){
                    if(err) return next(err);
                });
            };
            res.json({
                aed: req.body.aed,
                validation: req.body.validation,
            });
        }).catch(next);
});

module.exports = router;

