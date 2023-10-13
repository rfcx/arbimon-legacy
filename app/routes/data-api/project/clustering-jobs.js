/* jshint node:true */
"use strict";

const express = require('express');
const path = require('path')
const router = express.Router();
const model = require('../../../model');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const config = require('../../../config');
const csv_stringify = require("csv-stringify");
const q = require('q');
const fs = require('fs');

router.get('/', function(req, res, next) {
    res.type('json');

    return model.ClusteringJobs.find({
        project_id: req.project.project_id,
        ...!!req.query.job_id && { job_id: req.query.job_id },
        ...!!req.query.completed && { completed: req.query.completed },
        deleted: 0
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
    const recId = req.body.rec_id
    const params = {
        aed: req.body.aed,
        rec_id: recId
    };
    if (req.body.perSite) params.perSite = req.body.perSite;
    if (req.body.perDate) params.perDate = req.body.perDate;
    else params.all = req.body.all;
    return model.ClusteringJobs.findRois(params)
        .then(async function(data){
            if (recId) {
                const playlists = await model.ClusteringJobs.getClusteringPlaylist(recId)
                const result = playlists.map(pl => {
                    const aed = data.find(aed => aed.aed_id === pl.aed_id)
                    return { ...aed, ...pl }
                })
                res.json(result);
            }
            else res.json(data);
        }).catch(next);
});

router.get('/:recId/audio/:aedId', function(req, res, next) {
    model.ClusteringJobs.getRoiAudioFile({ recId: req.params.recId, aedId: req.params.aedId, gain: req.query.gain }).then(function(roiAudio) {
        if(!roiAudio){
            res.sendStatus(404);
        } else {
            res.sendFile(roiAudio.path, function () {
                if (fs.existsSync(roiAudio.path)) {
                    fs.unlink(roiAudio.path, function (err) {
                        if (err) console.error('Error deleting the Clustering roi file.', err);
                        console.info('Clustering roi file deleted.');
                    })
                }
            })
        }
    }).catch(next);
});

router.get('/:job_id/clustering-details', function (req, res, next) {
    res.type('json');
    const uri = `audio_events/${config('aws').env}/clustering/${req.params.job_id}/${req.params.job_id}_${req.query.aed_info ? 'aed_info' : 'lda'}.json`;
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
        project_id: req.project.project_id,
        ...!!req.query.completed && { completed: req.query.completed },
        deleted: 0
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.post('/:job_id/rois-export', function(req, res, next) {
    res.type('json');
    const bodyParams = req.body.params
    const userEmail = bodyParams.userEmail
    const userId = req.session.user.id
    const projection = {
        projectUrl: req.project.url,
        aed: bodyParams.aed,
        cluster: bodyParams.cluster,
        search: bodyParams.search
    }
    const filters = {
        project_id: req.project.project_id
    }
    model.recordings.writeExportParams(projection, filters, userId, userEmail).then(function(data) {
        res.json({ success: true })
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
    }, function(err, result) {
        if (err) return next(err);
        res.json({ create: true, result });
    })
});

router.post('/:clusteringJobId/remove', function(req, res, next) {
    res.type('json');

    const project_id = req.project.project_id;
    const job_id = req.params.clusteringJobId

    q.resolve().then(function(){
        if(!req.haveAccess(project_id, 'manage AED and Clustering job')){
            throw new Error("You don't have permission to remove Clustering job");
        }
    }).then(function(){
        return model.ClusteringJobs.delete(job_id);
    }).then(async function() {
        res.json({ ok: true });
        await model.jobs.hideAsync(job_id)
    }).catch(next);
});

module.exports = router;

