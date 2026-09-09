/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:project:jobs');
var express = require('express');
var router = express.Router();

var model = require('../../../model');


// ---------------------- jobs routes -----------------------------------------

router.get('/progress', function(req, res, next) {
    res.type('json');

    const last3Months = req.query.last3Months
    model.jobs.activeJobs({ id: req.project.project_id, last3Months }, function(err, row) {
        if(err) return next(err);

        res.json(row);
    });
});

// ------------------- routes with restriction -------------------------------

router.use(function(req, res, next) { 
    if(!req.haveAccess(req.project.project_id, "manage project jobs")) {
        return res.status(401).json({ error: "you dont have permission to manage jobs" });
    }
    
    next();
});


router.get('/hide/:jId', function(req, res, next) {
    res.type('json');

    // 2026-09-09 (OPEN-ITEMS §292): bind the job id to the project in the URL.
    model.jobs.hide(req.params.jId, req.project.project_id, function(err, rows) {
        if(err) return next(err);
        model.jobs.activeJobs({ id: req.project.project_id, last3Months: true }, function(err, row) {
            if(err) return next(err);
            return res.json(row);
        });
    });
});

router.get('/cancel/:jId', function(req, res, next) {
    res.type('json');

    // 2026-09-09 (OPEN-ITEMS §292): bind the job id to the project in the URL.
    model.jobs.cancel(req.params.jId, req.project.project_id, function(err, rows) {
        if(err) return next(err);

        // 2026-09-09 (OPEN-ITEMS §292): this previously passed
        // `req.params.projectUrl`, which is ALWAYS `undefined` here -- this
        // router is a plain express.Router() with no `mergeParams`, so the
        // parent's `/:projectUrl` param is not inherited. `activeJobs(undefined)`
        // does not fail: it skips the whole `if (project)` block, leaving only
        // `J.hidden = 0`, so the response was FLEET-WIDE (measured: 134,558
        // unhidden jobs across 2,525 projects, each enriched with per-job
        // parameters) -- a cross-project disclosure on the RESPONSE side.
        //
        // Fixed by passing the project the handler already has, matching the
        // sibling /progress route. Deliberately NOT fixed with `mergeParams`:
        // that would make `projectUrl` resolve and switch activeJobs to its
        // `P.url = ...` branch, changing behaviour on four other routers that
        // rely on params NOT being inherited.
        model.jobs.activeJobs({ id: req.project.project_id }, function(err, row) {
            if(err) return next(err);

            res.json(row);
        });
    });
});

module.exports = router;
