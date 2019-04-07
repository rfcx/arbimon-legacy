/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');
var csv_stringify = require("csv-stringify");


/** Return a list of all the pattern matchings in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    model.patternMatchings.find({ project:req.project.project_id, showTemplate: true, showPlaylist:true}).then(function(count) {
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

router.param('paging', function(req, res, next, paging){
    const components = paging.split('_');
    console.log('paging components', components);
    req.paging = {
        offset: (components[0] | 0),
        limit: (components[1] | 0),
    }
    return next();
});

router.get('/:patternMatching/rois/:paging', function(req, res, next) {
    res.type('json');
    model.patternMatchings.getRoisForId(req.params.patternMatching, req.paging.limit || 100, req.paging.offset || 0).then(function(rois) {
        res.json(rois);
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
