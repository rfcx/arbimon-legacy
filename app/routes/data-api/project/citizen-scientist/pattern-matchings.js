/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../../model');
var csv_stringify = require("csv-stringify");



/** Return a list of all the pattern matchings in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    model.patternMatchings.find({
        project:req.project.project_id,
        citizen_scientist:1,
        deleted:0,
        showUserStatsFor: req.session.user.id,
        showSpecies: true,
        showTemplate: true,
        showPlaylist:true
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
    var user = req.session.user;
    model.patternMatchings.getRoisForId({
        patternMatchingId: req.params.patternMatching,
        csValidationsFor: user.id,
        limit: req.paging.limit || 100,
        offset: req.paging.offset || 0,
    }).then(function(rois) {
        res.json(rois);
    }).catch(next);
});

router.get('/:patternMatching/expert-rois/:paging', function(req, res, next) {
    res.type('json');
    var user = req.session.user;
    model.patternMatchings.getRoisForId({
        patternMatchingId: req.params.patternMatching,
        expertCSValidations: true,
        countCSValidations: true,
        whereConsensus: req.query.search == 'consensus',
        whereConflicted: req.query.search == 'conflicted',
        whereExpert: req.query.search == 'expert',
        limit: req.paging.limit || 100,
        offset: req.paging.offset || 0,
    }).then(function(rois) {
        res.json(rois);
    }).catch(next);
});

router.post('/:patternMatching/validate', function(req, res, next) {
    res.type('json');
    var user = req.session.user;
    model.CitizenScientist.validateCSRois(req.params.patternMatching, user.id, req.body.rois, req.body.validation).then(function(rois) {
        res.json({
            rois: req.body.rois,
            validation: req.body.validation,
        });
    }).catch(next);
});

router.post('/:patternMatching/expert-validate', function(req, res, next) {
    res.type('json');
    var user = req.session.user;
    model.CitizenScientist.expertValidateCSRois(req.params.patternMatching, req.body.rois, req.body.validation).then(function(rois) {
        res.json({
            rois: req.body.rois,
            validation: req.body.validation,
        });
    }).catch(next);
});

router.get('/:patternMatching/export.csv', function(req, res, next) {
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

    model.patternMatchings.findOne({ id: req.params.patternMatching }).then(function(pm) {
        res.attachment(pm.name + '-citizen-scientist-export.csv')

        return model.patternMatchings.exportRois(req.params.patternMatching, filters, {
            hideNormalValidations: true,
            countCSValidations: true
        }).then(function(results) {
            var datastream = results[0];
            var fields = results[1].map(function(f){return f.name;});
            var colOrder={
                id: -18,
                recording: -17,
                site: -16,
                year: -15,
                month: -14,
                day: -13,
                hour: -12,
                min: -11,
                species: -10,
                songtype: -9,
                x1: -8,
                x2: -7,
                y1: -6,
                y2: -5,
                cs_val_present: -4,
                cs_val_not_present: -3,
                consensus_validated: -2.5,
                validated: -2,
                uri: -1
            };
            fields.sort(function(a, b){
                var ca = colOrder[a] || 0, cb = colOrder[b] || 0;
                return ca < cb ? -1 : (
                    ca > cb ?  1 : ( a <  b ? -1 : ( a >  b ?  1 : 0 ) )
                );
            });

            datastream
                .pipe(csv_stringify({header:true, columns:fields}))
                .pipe(res);
        }).catch(next);
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


module.exports = router;
