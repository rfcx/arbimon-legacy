/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');
var csv_stringify = require("csv-stringify");


router.get('/', function (req, res, next) {
    res.type('json');
    model.CNN.find({
        project: req.project.project_id,
        showPlaylist: true,
        showModelName: true,
        showUser: true,
        playlistCount: true,
        resolveModelUri: true,
        showDeleted: false
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/:job_id/details', function (req, res, next) {
    res.type('json');
    model.CNN.findOne(req.params.job_id, {
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/:job_id/countROIsBySpecies', function (req, res, next) {
    res.type('json');
    model.CNN.countROIsBySpecies(req.params.job_id, {
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/models/', function (req, res, next) {
    res.type('json');
    model.CNN.listModels({
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/results/:job_id', function (req, res, next) {
    res.type('json');
    model.CNN.listResults(req.params.job_id, {
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/rois/:job_id', function (req, res, next) {
    console.log("**********THIS ONE************");
    res.type('json');
    model.CNN.listROIs(req.params.job_id, {
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/roisBySpecies/:job_id/:species_id', function (req, res, next) {
    console.log("**********THIS ONE************");
    res.type('json');
    model.CNN.listROIs(req.params.job_id, {
        species_id:  req.params.species_id,
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/:cnnId/audio/:roiId', function(req, res, next) {
    model.CNN.getRoiAudioFile(req.params.cnnId, req.params.roiId).then(function(roiAudio) {
        if(!roiAudio){
            res.sendStatus(404);
        } else {
            res.sendFile(roiAudio.path);
        }
    }).catch(next);
});

router.param('paging', function(req, res, next, paging){
    const components = paging.split('_');
    console.log('paging components', components);
    req.paging = {
        offset: (components[0] | 0),
        limit: (components[1] | 0),
    }
    return next();
});

router.get('/:cnn/rois/:paging', function(req, res, next) {
console.log("TCL****************************************: paging", paging)
    
    res.type('json');
    model.CNN.getRoisForId({
        cnnId: req.params.cnn,
        wherePresent: req.query.search == 'present',
        whereNotPresent: req.query.search == 'not_present',
        whereUnvalidated: req.query.search == 'unvalidated',
        limit: req.paging.limit || 100,
        offset: req.paging.offset || 0,
    }).then(function(rois) {
        res.json(rois);
    }).catch(next);
});


router.post('/new/', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        /*
        if(!req.haveAccess(project_id, "manage pattern matchings")){
            throw new Error({
                error: "You don't have permission to run pattern matchings"
            });
        }
        */
    }).then(function(){
        return model.CNN.requestNewCNNJob({
            project_id    : project_id,
            user_id       : req.session.user.id,
            name       : req.body.name,
            cnn_id        : req.body.cnn_id,
            playlist_id   : req.body.playlist_id,
            lambda        : req.body.lambda,
            params     : req.body.params
        });
    }).then(function(result){
            res.json({ ok: true, result: result });
    }).catch(next);
});

router.post('/:cnn/remove', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        /*
        if(!req.haveAccess(project_id, "manage pattern matchings")){
            throw new Error({
                error: "You don't have permission to delete pattern matchings"
            });
        }
        */
    }).then(function(){
        return model.CNN.delete(req.params.cnn | 0);
    }).then(function(){
        res.json({ok: true});
    }).catch(next);
});

module.exports = router;