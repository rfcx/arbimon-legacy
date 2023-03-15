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

    model.jobs.hide(req.params.jId, function(err, rows) {
        if(err) return next(err);
        
        model.jobs.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) return next(err);
            
            res.json(row);
        });
    });
});

router.get('/cancel/:jId', function(req, res, next) {
    res.type('json');

    model.jobs.cancel(req.params.jId, function(err, rows) {
        if(err) return next(err);
        
        model.jobs.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) return next(err);

            res.json(row);
        });
    });
});

module.exports = router;
