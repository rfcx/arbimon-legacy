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
        ...req.query.rec_id && { rec_id: req.query.rec_id },
        ...req.query.playlist && { playlist: req.query.playlist }
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.get('/records', function(req, res, next) {
    res.type('json');

    return model.AudioEventDetectionsClustering.findClusteredRecords({
        project_id: req.project.project_id,
        aed_id: req.query.aed_id,
        aed_id_in: req.query.aed_id_in
    })
    .then(function(data){
        res.json(data);
    }).catch(next);
});

router.post('/new', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    return model.AudioEventDetectionsClustering.requestNewAudioEventDetectionClusteringJob({
        project    : project_id,
        user       : req.session.user.id,
        name       : req.body.name,
        playlist   : req.body.playlist_id,
        params     : req.body.params,
    })
    .then(function(result){
        res.json({ create: true, result: result });
    }).catch(next);
});


module.exports = router;

