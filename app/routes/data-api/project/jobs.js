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
    // 2026-09-20 (OPEN-ITEMS §357): the model now also marks the row terminal
    // in the same guarded statement; affectedRows distinguishes "cancelled"
    // from "already finished/cancelled" (the state guard matches 0 rows), so
    // the UI can say which happened instead of silently succeeding.
    model.jobs.cancel(req.params.jId, req.project.project_id, function(err, result) {
        if(err) return next(err);

        if (!result || !result.affectedRows) {
            return res.json({ cancelled: false,
                              reason: "job is not running (already finished or cancelled)" });
        }

        // (§292 note carried from below: pass the project the handler already
        // has -- this router has no `mergeParams`, so `req.params.projectUrl`
        // is ALWAYS undefined here, and `activeJobs(undefined)` returns the
        // FLEET. See the longer comment in the /hide twin.)
        model.jobs.activeJobs({ id: req.project.project_id }, function(err, row) {
            if(err) return next(err);

            res.json(row);
        });
    });
});

module.exports = router;
