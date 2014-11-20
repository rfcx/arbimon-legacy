var express = require('express');
var router = express.Router();
var async = require('async');

var jobQueue = require('../utils/jobqueue');
var model = require('../models');

router.use(function(req, res, next) {
    if(!req.session.user.isSuper)
        res.sendStatus(403);
    next();
});


router.get('/', function(req, res) {
    res.render('admin', { title: "Home", user: req.session.user });
});


router.get('/job-queue', function(req, res, next) {
    console.log(jobQueue);
    
    res.json({
        length: jobQueue.length(),
        running: jobQueue.running(),
        isIdle: jobQueue.idle(),
        concurrency: jobQueue.concurrency
    });
});

router.get('/active-jobs', function(req, res, next) {
    model.jobs.allActiveJobs(function(err, rows) {
        if(err) return next(err);
            console.log(rows);
        res.json(rows);
    });
});

module.exports = router;
