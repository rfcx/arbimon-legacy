/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../../model');
var APIError = require('../../../../utils/apierror');
var csv_stringify = require("csv-stringify");
var projectScope = require('../../../../utils/project-scope');
var PM_NOT_FOUND = { error: 'pattern matching not found' };

/**
 * Return a list of all the pattern matchings in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    const opts = {
        project:req.project.project_id,
        citizen_scientist: 1,
        deleted: 0,
    }
    // get stats for validated vs total rois first
    model.patternMatchings.find({
        ...opts,
        showUserStatsFor: req.session.user.id,
        userStats: ['validated'],
        showTemplate: true
    }).then(async function(pms1) {
        // then get additional data about species and songtype
        const pms2 = await model.patternMatchings.find({
            ...opts,
            showSpecies: true,
        })
        // match first set of data with second set
        const result = pms1.map((pm1) => {
            const additionalPm = pms2.find(pm2 => pm2.id === pm1.id)
            return {
                ...pm1,
                ...additionalPm
            }
        })
        res.json(result);
    }).catch(next);
});

/** Return a list of all the pattern matchings in a project visible to an expert.
 */
router.get('/expert', function(req, res, next) {
    res.type('json');
    model.patternMatchings.find({
        project:req.project.project_id,
        cs_expert:1,
        deleted:0,
        showUserStatsFor: req.session.user.id,
        showSpecies: true,
        showTemplate: true,
        showPlaylistName: true
    }).then(function(count) {
        res.json(count);
    }).catch(next);
});

// §393 (rfcx-local OPEN-ITEMS §393, 2026-09-25): every :patternMatching route
// below resolved the PM by id ALONE -- CS details/rois/exports and the two
// VALIDATE writes of
// ANY project's PM were readable by quoting its id under a project the caller
// can open (proven on prod as a non-super user: a private project's CS export,
// 2 MB, 200). The PM must now be the URL project's; a foreign id gets the
// SAME 404 as an unknown one (no existence oracle). Bound HERE, once, so every
// route under the param is covered by construction and a new one cannot forget.
// Handlers keep reading req.params.patternMatching -- now proven owned.
router.param('patternMatching', function(req, res, next, patternMatching) {
    projectScope.ownedByProject('pattern_matching', patternMatching, req.project.project_id).then(function(owned) {
        if (!owned) { return res.status(404).json(PM_NOT_FOUND); }
        return next();
    }).catch(next);
});

/** Return a pattern matching's data.
 */
router.get('/:patternMatching/details', function(req, res, next) {
    res.type('json');
    var user = req.session.user;
    model.patternMatchings.findOne({
        id: req.params.patternMatching,
        showUserStatsFor: user.id,
        showTemplate: true,
        showPlaylistName: true,
        showCounts: true,
        showSpecies: true,
    }).then(function(pm) {
        res.json(pm);
    }).catch(next);
});

router.get('/:patternMatching/expert/details', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, "view citizen scientist expert interface")){
        return next(new APIError({
            error: "You don't have permission to view expert details"
        }));
    }

    var user = req.session.user;
    model.patternMatchings.findOne({
        id: req.params.patternMatching,
        showCSExpertStats: true,
        showTemplate: true, showPlaylist:true, showCounts: true,
        showSpecies: true,
    }).then(function(pm) {
        res.json(pm);
    }).catch(next);
});

// project-scope: allow offset_limit paging, not an entity id
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
    var user = req.session.user;
    model.patternMatchings.getRoisForId({
        projectId: req.project.project_id,
        patternMatchingId: req.params.patternMatching,
        csValidationsFor: user.id,
        whereNotConsensus: true,
        whereNotExpert: true,
        limit: req.paging.limit || 100,
        offset: req.paging.offset || 0,
    }).then(function(rois) {
        res.json(rois);
    }).catch(next);
});

router.get('/:patternMatching/expert-rois/:paging', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, "view citizen scientist expert interface")){
        return next(new APIError({
            error: "You don't have permission to view expert roi details"
        }));
    }
    model.patternMatchings.getRoisForId({
        projectId: req.project.project_id,
        patternMatchingId: req.params.patternMatching,
        expertCSValidations: true,
        countCSValidations: true,
        whereNotConsensus: req.query.search == 'pending',
        whereConsensus: req.query.search == 'consensus',
        whereConflicted: req.query.search == 'conflicted',
        whereExpert: req.query.search == 'expert',
        limit: req.paging.limit || 100,
        offset: req.paging.offset || 0,
    }).then(function(rois) {
        res.json(rois);
    }).catch(next);
});

// The PM is bound by the param above; the body's roi ids are constrained to
// that PM INSIDE validateCSRois (a roi of another PM is silently skipped), so a
// bound PM cannot be used as a carrier to validate another project's rois.
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

// Body roi ids: expertValidateCSRois' UPDATE already carries
// `pattern_matching_id = <bound PM>`, so a foreign roi id updates nothing.
router.post('/:patternMatching/expert-validate', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, "view citizen scientist expert interface")){
        return next(new APIError({
            error: "You don't have permission to validate as an expert"
        }));
    }

    var user = req.session.user;
    model.CitizenScientist.expertValidateCSRois(
        req.session.user.id,
        req.params.patternMatching,
        req.body.rois,
        req.body.validation
    ).then(function(rois) {
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
            expertCSValidations: true,
            countCSValidations: true
        }).then(function(results) {
            var datastream = results[0];
            var fields = results[1].map(function(f){return f.name;});
            var colOrder={
                id: -18,
                recording: -17,
                site_id: -16.5,
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
                score: -4.5,
                cs_val_present: -4,
                cs_val_not_present: -3,
                consensus_validated: 5,
                expert_validated: 6,
                expert_validation_user: 7,
                uri: 10
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

router.get('/:patternMatching/export-per-user.csv', function(req, res, next) {
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
        res.attachment(pm.name + '-citizen-scientist-per-user-export.csv')

        return model.patternMatchings.exportRois(req.params.patternMatching, filters, {
            hideNormalValidations: true,
            expertCSValidations: true,
            perUserCSValidations: true
        }).then(function(results) {
            var datastream = results[0];
            var fields = results[1].map(function(f){return f.name;});
            var colOrder={
                id: -18,
                recording: -17,
                site_id: -16.5,
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
                score: -4.5,
                user: -4,
                cs_validation: -3,
                consensus_validated: 5,
                expert_validated: 6,
                expert_validation_user: 7,
                uri: 10
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


// project-scope: model delete
router.post('/:patternMatching/remove', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        if(!req.haveAccess(project_id, "manage pattern matchings")){
            throw new Error("You don't have permission to delete pattern matchings");
        }
    }).then(function(){
        // 2026-09-09 (OPEN-ITEMS §291): scope the delete to the URL's project.
        // A THIRD instance of the same shape, found by enumerating every caller
        // of the changed signature rather than by reading the routers -- the
        // project_id was already in scope here and simply was not passed.
        return model.patternMatchings.delete(req.params.patternMatching | 0, project_id);
    }).then(function(){
        res.json({ok: true});
    }).catch(next);
});


module.exports = router;
