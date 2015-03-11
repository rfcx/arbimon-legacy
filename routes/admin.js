var debug = require('debug')('arbimon2:route:admin');
var express = require('express');
var request = require('request');
var router = express.Router();
var async = require('async');

var config = require('../config');
var model = require('../model');

router.use(function(req, res, next) {
    if(!req.session.user.isSuper)
        res.sendStatus(403);
    next();
});


router.get('/', function(req, res) {
    res.render('admin', { title: "Home", user: req.session.user });
});


router.get('/job-queue', function(req, res, next) {
    request.get(config('hosts').jobqueue + '/stats').on('error', function(err) {
        res.json({error:'Could not read job queue stats.'});
    }).pipe(res);
});

router.get('/active-jobs', function(req, res, next) {
    model.jobs.activeJobs(function(err, rows) {
        if(err) return next(err);
        res.json(rows);
    });
});

module.exports = router;
