var debug = require('debug')('arbimon2:route:admin');
var express = require('express');
var request = require('request');
var router = express.Router();
var async = require('async');

var config = require('../config');
var model = require('../model');

// only super user can access admin section
router.use(function(req, res, next) {
    if(req.session.user.isSuper === 1) {
        return next();
    }
    
    res.sendStatus(403);
});


router.get('/', function(req, res) {
    res.render('admin', { user: req.session.user });
});


router.get('/job-queue', function(req, res, next) {
    request.get(config('hosts').jobqueue + '/stats')
        .on('error', function(err) {
            res.json({ error:'Could not read job queue stats.' });
        })
        .pipe(res);
});

router.get('/active-jobs', function(req, res, next) {
    model.jobs.activeJobs(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/projects', function(req, res, next) {
    model.projects.listAll(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.put('/projects/:projectId', function(req, res, next) {
    var project = req.body.project;
    
    project.project_id = req.params.projectId;
    
    model.projects.update(project, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/users', function(req, res, next) {
    model.users.list(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

module.exports = router;
