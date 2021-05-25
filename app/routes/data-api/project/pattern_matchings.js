/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');
var csv_stringify = require("csv-stringify");


// global project.pattern_matching_enabled check
router.use(function(req, res, next) {
    if(!req.project.pattern_matching_enabled) {
        return res.status(401).json({ error: "Pattern matching features are not enabled for your project." });
    }

    next();
});


/** Return a list of all the pattern matchings in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    model.patternMatchings.find({
        project:req.project.project_id,
        deleted:0,
        showUser:true,
        showTemplate: true,
        showPlaylist:true,
        ...!!req.query.completed && { completed: req.query.completed }
    }).then(function(count) {
        res.json(count);
    }).catch(next);
});

/** Return a pattern matching's data.
 */
router.get('/:patternMatching/details', function(req, res, next) {
    res.type('json');
    model.patternMatchings.findOne({
        id: req.params.patternMatching,
        showTemplate: true, showPlaylist:true, showCounts: true,
        showSpecies: true,
    }).then(function(pm) {
        res.json(pm);
    }).catch(next);
});

router.get('/count', function(req, res, next) {
    res.type('json');
    model.patternMatchings.totalPatternMatchings(req.project.project_id, function(err, count) {
        if(err) return next(err);
        res.json(count[0]);
    });
});

router.param('paging', function(req, res, next, paging){
    const components = paging.split('_');
    req.paging = {
        offset: (components[0] | 0),
        limit: (components[1] | 0),
    }
    return next();
});

router.get('/:patternMatching/rois/:paging', function(req, res, next) {
    res.type('json');
    model.patternMatchings.getRoisForId({
        patternMatchingId: req.params.patternMatching,
        wherePresent: req.query.search == 'present',
        whereNotPresent: req.query.search == 'not_present',
        whereUnvalidated: req.query.search == 'unvalidated',
        bestPerSite: req.query.search == 'best_per_site',
        bestPerSiteDay: req.query.search == 'best_per_site_day',
        byScorePerSite: req.query.search == 'by_score_per_site',
        byScore: req.query.search == 'by_score',
        limit: req.paging.limit || 100,
        offset: req.paging.offset || 0,
    }).then(function(rois) {
        res.json(rois);
    }).catch(next);
});

router.get('/:patternMatching/site-index', function(req, res, next) {
    res.type('json');
    model.patternMatchings.getSitesForPM(req.params.patternMatching)
        .then(function(sites) {
            res.json(sites)
        }).catch(next);
});

router.get('/:patternMatching/rois.csv', function(req, res, next) {
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

    model.patternMatchings.exportRois(req.params.patternMatching, filters).then(function(results) {
        var datastream = results[0];
        var fields = results[1].map(function(f){return f.name;});
        var colOrder={
            id: -16,
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
            uri: -1
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

        datastream
            .pipe(csv_stringify({header:true, columns:fields}))
            .pipe(res);
    }).catch(next);
});

router.get('/:patternMatching/audio/:roiId', function(req, res, next) {
    model.patternMatchings.getRoiAudioFile(req.params.patternMatching, req.params.roiId, { gain: req.query.gain }).then(function(roiAudio) {
        if(!roiAudio){
            res.sendStatus(404);
        } else {
            res.sendFile(roiAudio.path);
        }
    }).catch(next);
});


router.post('/:patternMatching/validate', function(req, res, next) {
    res.type('json');
    model.patternMatchings.validateRois(req.params.patternMatching, req.body.rois, req.body.validation).then(function(rois) {
        res.json({
            rois: req.body.rois,
            validation: req.body.validation,
        });
    }).catch(next);
});

router.post('/:patternMatching/remove', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        if(!req.haveAccess(project_id, "manage pattern matchings")){
            throw new Error({
                error: "You don't have permission to delete pattern matchings"
            });
        }
    }).then(function(){
        return model.patternMatchings.delete(req.params.patternMatching | 0);
    }).then(function(){
        res.json({ok: true});
    }).catch(next);
});

router.post('/new', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        if(!req.haveAccess(project_id, "manage pattern matchings")){
            throw new Error({
                error: "You don't have permission to run pattern matchings"
            });
        }
    }).then(function(){
        return model.patternMatchings.requestNewPatternMatchingJob({
            project    : project_id,
            user       : req.session.user.id,
            name       : req.body.name,
            template   : req.body.template,
            playlist   : req.body.playlist,
            params   : req.body.params,
        });
    //     return model.jobs.newJob({
    //         project    : project_id,
    //         user       : req.session.user.id,
    //         name       : req.body.name,
    //         template   : req.body.template,
    //         playlist   : req.body.playlist,
    //         params   : req.body.params,
    //     }, 'pattern_matching_job');
    // }).then(function get_job_id(job_id){
    //     pokeDaMonkey(); // this happens in 'parallel'
    //     return job_id;
}).then(function(result){
        res.json({ ok: true, result: result });
    }).catch(next);
});


module.exports = router;
