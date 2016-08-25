/* jshint node:true */
"use strict";

var q = require('q');
var debug = require('debug')('arbimon2:route:project:audio-event-detections');
var router = require('express').Router();
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');

router.get('/', function(req, res, next) {
    model.AudioEventDetections.getFor({
        project: req.project.project_id,
        showAlgorithm: true,
        showPlaylist: true,
    }).then(function(aeds) {
        res.json(aeds);
    }).catch(next);
});

router.get('/algorithms', function(req, res, next) {
    model.AudioEventDetections.getAlgorithms().then(function(algorithms) {
        res.json(algorithms);
    }).catch(next);
});

router.get('/statistics', function(req, res, next) {
    model.AudioEventDetections.getStatistics().then(function(statistics) {
        res.json(statistics);
    }).catch(next);
});

router.get('/data/:aed/:x/:y/:z', function(req, res, next) {
    model.AudioEventDetections.getData({
        aed : req.params.aed,
        x : req.params.x,
        y : req.params.y,
        z : req.params.z,
        bins : req.query.bins,
        binsx : req.query.binsx,
        binsy : req.query.binsy,
    }).then(function(data) {
        return res.json(data);
    }).catch(next);
});

router.post('/new', function(req, res, next) {
    res.type('json');
    
    var project_id = req.project.project_id;
    
    q.resolve().then(function(){
        if(!req.haveAccess(project_id, "manage soundscapes")){
            throw new Error({
                error: "You don't have permission to run audio event detections"
            });
        }
    }).then(function(){
        return model.AudioEventDetections.newConfiguration({
            algorithm  : req.body.algorithm,
            params     : req.body.parameters,
        });
    }).then(function(aedc){
        debug("AED configuration", aedc);
        return model.jobs.newJob({
            project    : project_id,
            user       : req.session.user.id,
            name       : req.body.name,
            playlist   : req.body.playlist,
            configuration: aedc.aedc_id,
            statistics : req.body.statistics,
        }, 'audio_event_detection_job');
    }).then(function get_job_id(job_id){
        pokeDaMonkey(); // this happens in 'parallel'
        return job_id;
    }).then(function(job_id){
        res.json({ ok:"Audio event detection job created (id:"+job_id + ")."});
    }).catch(next);
});



module.exports = router;