/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../../model');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var config = require('../../../config');

router.get('/', function(req, res, next) {
    res.type('json');

    return model.ClusteringJobs.find({
        project_id: req.project.project_id
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});
router.get('/:job_id/job-details', function (req, res, next) {
    res.type('json');
    model.ClusteringJobs.findOne(req.params.job_id, {
        project: req.project.project_id,
    }).then(function (data) {
        res.json(data);
    }).catch(next);
});
router.get('/:job_id/clustering-details', function (req, res, next) {
    res.type('json');
    var uri = `audio_events/${config('aws').env}/clustering/${req.params.job_id}.json`;
    if (!s3) {
        s3 = new AWS.S3();
    }
    s3.getObject({
        Bucket: config('aws').bucketName,
        Key: uri
    }, function(err, data){
        if (err) {
            return next(err);
        }
        return res.json(JSON.parse(data.Body));
    });
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

