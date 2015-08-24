/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:project:jobs');
var express = require('express');
var router = express.Router();

var model = require('../../../model');


// ---------------------- jobs routes -----------------------------------------

router.get('/progress', function(req, res, next) {
    model.jobs.activeJobs({ id: req.project.project_id }, function(err, row) {
        if(err) return next(err);

        res.json(row);
    });
});

router.get('/types', function(req, res, next) {
    model.jobs.getJobTypes(function(err, types) {
        if(err){ next(err); return; }
        res.json(types);
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

    model.jobs.hide(req.params.jId, function(err, rows) {
        if(err) return next(err);
        
        model.jobs.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) return next(err);
            
            res.json(row);
        });
    });
});

router.get('/cancel/:jId', function(req, res, next) {

    model.jobs.cancel(req.params.jId, function(err, rows) {
        if(err) return next(err);
        
        model.jobs.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) return next(err);

            res.json(row);
        });
    });
});

module.exports = router;
