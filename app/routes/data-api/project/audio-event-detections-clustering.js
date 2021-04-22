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
        ...!!req.query && !!req.query.playlist && { playlist: req.query.playlist }
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.post('/records', function(req, res, next) {
    res.type('json');

    return model.AudioEventDetectionsClustering.findClusteredRecords({
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


module.exports = router;

