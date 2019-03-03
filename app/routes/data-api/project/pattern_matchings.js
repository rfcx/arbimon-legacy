/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../../model');
var csv_stringify = require("csv-stringify");


/** Return a list of all the pattern matchings in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    model.patternMatchings.find({ project:req.project.project_id, showPlaylist:true}).then(function(count) {
        res.json(count);
    }).catch(next);
});

/** Return a pattern matching's data.
 */
router.get('/:patternMatching/details', function(req, res, next) {
    res.type('json');
    model.patternMatchings.findOne({ id: req.params.patternMatching, showPlaylist:true, showSpecies:true, showCounts: true }).then(function(pm) {
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

module.exports = router;
