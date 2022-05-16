/* jshint node:true */
"use strict";

var express = require('express');
var path = require('path')
var router = express.Router();
var model = require('../../../model');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var config = require('../../../config');

router.get('/', function(req, res, next) {
    res.type('json');

    return model.ClusteringJobs.find({
        project_id: req.project.project_id,
        ...!!req.query.job_id && { job_id: req.query.job_id },
        ...!!req.query.completed && { completed: req.query.completed }
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.get('/asset', function(req, res, next) {
    res.attachment(path.basename(req.query.path))
    return model.ClusteringJobs.getAsset(req.query.path, res)
});

router.get('/:job_id/job-details', function (req, res, next) {
    res.type('json');
    model.ClusteringJobs.findOne(req.params.job_id, {
        project: req.project.project_id,
    }).then(function (data) {
        res.json(data);
    }).catch(next);
});

router.post('/:job_id/rois-details', function(req, res, next) {
    res.type('json');
    var params = {
        aed: req.body.aed,
        rec_id: req.body.rec_id
    };
    if (req.body.perSite) params.perSite = req.body.perSite;
    if (req.body.perDate) params.perDate = req.body.perDate;
    else params.all = req.body.all;
    return model.ClusteringJobs.findRois(params)
        .then(function(data){
            res.json(data);
        }).catch(next);
});

router.get('/:recId/audio/:aedId', function(req, res, next) {
    model.ClusteringJobs.getRoiAudioFile({ recId: req.params.recId, aedId: req.params.aedId, gain: req.query.gain }).then(function(roiAudio) {
        if(!roiAudio){
            res.sendStatus(404);
        } else {
            res.sendFile(roiAudio.path);
        }
    }).catch(next);
});

router.get('/:job_id/clustering-details', function (req, res, next) {
    res.type('json');
    const uri = `audio_events/${config('aws').env}/clustering/${req.params.job_id}/${req.params.job_id}_${req.query.aed_info ? 'aed_info' : req.query.type? req.query.type : 'lda'}.json`;
    if (!s3) {
        s3 = new AWS.S3();
    }
    s3.getObject({
        Bucket: config('aws').mlSpecsName,
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
        project_id: req.project.project_id,
        ...!!req.query.completed && { completed: req.query.completed }
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.post('/new', function(req, res, next) {
    res.type('json');

    return model.ClusteringJobs.requestNewClusteringJob({
        project_id: req.project.project_id,
        user_id: req.session.user.id,
        name: req.body.name,
        audioEventDetectionJob: req.body.aed_job,
        params: req.body.params,
    })
    .then(function(result){
        res.json({ create: true, result: result });
    }).catch(next);
});

module.exports = router;

