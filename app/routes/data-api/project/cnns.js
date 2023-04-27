/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');
var csv_stringify = require("csv-stringify");
const fs = require('fs');

router.get('/:cnnId/rois.csv', function(req, res, next) {
    if(req.query.out=="text"){
        res.type('text/plain');
    } else {
        res.type('text/csv');
    }

    try {
        var filters = JSON.parse(req.query.filters || '{}') || {};
    } catch(e) {
        return next(e);
    }

    filters.project_id = req.project.project_id | 0;

    model.CNN.exportRois(req.params.cnnId, filters).then(function(results) {
        var datastream = results[0];
        var fields = results[1].map(function(f){return f.name;});

        var colOrder={
            cnn_result_roi_id: -17,
            score: -16,
            recording: -15,
            site: -14,
            year: -13,
            month: -12,
            day: -11,
            hour: -10,
            min: -9,
            species: -8,
            songtype: -7,
            x1: -6,
            x2: -5,
            y1: -4,
            y2: -3,
            validated: -2,
            roi_thumbnail_uri: -1
        };
        fields.sort(function(a, b){
            var ca = colOrder[a] || 0, cb = colOrder[b] || 0;
            return ca < cb ? -1 : (
                   ca > cb ?  1 : (
                    a <  b ? -1 : (
                    a >  b ?  1 :
                    0
            )));
        });
        fields = fields.filter(field => field in colOrder);
        datastream
            .pipe(csv_stringify({header:true, columns:fields}))
            .pipe(res);
    }).catch(next);
});


router.param('paging', function(req, res, next, paging){
    const components = paging.split('_');
    req.paging = {
        offset: (components[0] | 0),
        limit: (components[1] | 0),
    }
    return next();
});

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
        project: req.project.project_id,
        showPlaylist: true,
        showModelName: true,
        showUser: true,
        playlistCount: true,
        resolveModelUri: true,
        showCounts: true
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/:job_id/countROIsBySpecies/:search', function (req, res, next) {
    res.type('json');
    model.CNN.countROIsBySpecies(req.params.job_id, {
        project: req.project.project_id,
        search: req.params.search
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/:job_id/countROIsBySites', function (req, res, next) {
    res.type('json');
    model.CNN.countROIsBySites(req.params.job_id, {
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/:job_id/countROIsBySpeciesSites/:search', function (req, res, next) {
    res.type('json');
    model.CNN.countROIsBySpeciesSites(req.params.job_id, {
        project: req.project.project_id,
        search: req.params.search
    }).then(function (response) {
        res.json(response);
    }).catch(next);
});

router.post('/:job_id/validate', function(req, res, next) {
    res.type('json');
    model.CNN.validateRois(req.params.job_id, req.body.rois, req.body.validation).then(function(rois) {
        res.json({
            rois: req.body.rois,
            validation: req.body.validation,
        });
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
    res.type('json');
    model.CNN.listROIs(req.params.job_id, {
        project: req.project.project_id
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/rois/:job_id/:species_id/:site_id/:search/:paging', function (req, res, next) {
    res.type('json');
    model.CNN.listROIs(req.params.job_id, {
        project: req.project.project_id,
        limit: req.paging.limit,
        offset: req.paging.offset,
        species_id: req.params.species_id,
        site_id: req.params.site_id,
        search: req.params.search
    }).then(function (count) {
        res.json(count);
    }).catch(next);
});

router.get('/roisBySpecies/:job_id/:species_id', function (req, res, next) {
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
        if (!roiAudio){
            res.sendStatus(404);
        } if (roiAudio.path.includes('/internal')) {
            roiAudio.pipe(res)
        } else {
            res.sendFile(roiAudio.path, function () {
                if (fs.existsSync(roiAudio.path)) {
                    fs.unlink(roiAudio.path, function (err) {
                        if (err) console.error('Error deleting the CNN file.', err);
                        console.info('CNN file deleted.');
                    })
                }
            })
        }
    }).catch(next);
});

router.get('/:cnn/rois/:paging', function(req, res, next) {
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

    const job_id = req.params.cnn
    q.resolve().then(function(){
        /*
        if(!req.haveAccess(project_id, "manage pattern matchings")){
            throw new Error({
                error: "You don't have permission to delete pattern matchings"
            });
        }
        */
    }).then(function(){
        return model.CNN.delete(job_id | 0);
    }).then(async function(){
        res.json({ok: true});
        await model.jobs.hideAsync(job_id)
    }).catch(next);
});

module.exports = router;
