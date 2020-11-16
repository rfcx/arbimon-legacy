/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../../model');

router.get('/', function(req, res, next) {
    res.type('json');

    return model.ClusteringJobs.find({
        project_id: req.project.project_id
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.get('/audio-event-detections', function(req, res, next) {
    res.type('json');

    return model.ClusteringJobs.audioEventDetections({
        project_id: req.project.project_id
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.post('/new', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    return model.ClusteringJobs.requestNewClusteringJob({
        project: project_id,
        name: req.body.name,
        audioEventDetectionJob: req.body.aed_job,
        params: req.body.params,
    })
    .then(function(result){
        res.json({ create: true, result: result });
    }).catch(next);
});

module.exports = router;

