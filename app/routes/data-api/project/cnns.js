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
        resolveModelUri: true
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


module.exports = router;