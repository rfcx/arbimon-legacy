/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:admin');
var express = require('express');
var request = require('request');
var router = express.Router();
var async = require('async');

var config = require('../../config');
var model = require('../../model');

// only super user can access admin section
router.use(function(req, res, next) {
    if(
        req.session && 
        req.session.user && 
        req.session.user.isSuper === 1
    ) {
        return next();
    }
    
    res.status(404).render('not-found');
});


router.get('/', function(req, res) {
    res.render('admin', { user: req.session.user });
});


router.get('/dashboard-stats', function(req, res, next) {
    async.series([
        model.jobs.status,
        model.news.countProjectsCreatedToday,
        model.users.countCreatedToday,
    ], 
    function(err, results) {
        if(err) return next(err);
        
        
        var stats = {
            jobsStatus: results[0],
            newProjects: results[1][0][0].count,
            newUsers: results[2][0][0].count,
        };
        
        res.json(stats);
    });
});

router.get('/job-queue', function(req, res, next) {
    request.get(config('hosts').jobqueue + '/stats')
        .on('error', function(err) {
            res.json({ error:'Could not read job queue stats.' });
        })
        .pipe(res);
});

router.get('/jobs', function(req, res, next) {
    model.jobs.find(req.query, function(err, jobs) {
        if(err) return next(err);
        
        res.json(jobs);
    });
});

router.get('/system-settings', function(req, res, next) {
    model.settings.get(function(err, rows) {
        if(err) return next(err);
        
        
        console.log(rows);
        
        var settings = {};
        async.each(rows, 
            function(s, callback) {
                settings[s.key] = s.value;
                callback();
            }, 
            function done() {
                res.json(settings);
            }
        );
        
    });
});

// update system setting value
router.put('/system-settings', function(req, res, next) {
    model.settings.set(req.body.setting, req.body.value, function(err, results) {
        if(err) return next(err);
        
        debug('setting update:', results);
        res.sendStatus(200);
    });
});

router.use('/projects', require('./projects'));
router.use('/users', require('./users'));





module.exports = router;
