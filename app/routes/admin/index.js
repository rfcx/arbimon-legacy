/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:admin');
var express = require('express');
var router = express.Router();
var async = require('async');
var csv_stringify = require("csv-stringify");

var config = require('../../config');
var model = require('../../model');
const auth0Service = require('../../model/auth0')

// only super user can access admin section
router.use(function(req, res, next) {
    if(
        req.session &&
        req.session.user &&
        req.session.user.isSuper === 1
    ) {
        return next();
    }

    res.status(404).render('not-found', { user: req.session.user });
});


router.get('/', function(req, res) {
    res.type('html');
    res.render('admin', {
        user: req.session.user,
        auth0UniversalLoginUrl: auth0Service.universalLoginUrl
    });
});

router.get('/all-users', function(req, res) {
    res.type('json');
    model.users.listUser(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/dashboard-stats', function(req, res, next) {
    res.type('json');
    async.series([
        model.jobs.status,
        model.news.countProjectsCreatedToday,
        model.sites.countSitesToday,
        model.users.countCreatedToday,
        model.projects.countAllProjects,
        model.sites.countAllSites,
        model.users.countAllUsers
    ],
    function(err, results) {
        if(err) return next(err);


        var stats = {
            jobsStatus: results[0],
            newProjects: results[1][0][0].count,
            newSites: results[2][0][0].count,
            newUsers: results[3][0][0].count,
            allProjects: results[4],
            allSites: results[5][0][0].count,
            allUsers: results[6][0][0].count
        };

        res.json(stats);
    });
});

router.get('/plot-data/data.txt', function(req, res, next) {
    var query={};
    var output='csv', groupby;
    if (req.query) {
        if (req.query.get && req.query.get == 'dates') {
            query.only_dates = true;
            output='json';
            groupby='dates';
        } else {
            if(req.query.stat){
                query.stat = req.query.stat; //.split(',');
            }
            if(req.query.from){
                query.from = new Date(+req.query.from);
            }
            if(req.query.to){
                query.to = new Date(+req.query.to);
            }
            if (req.query.date) {
                query.dates = req.query.date.split(',');
                output='csv';
            }
            if(req.query.q){
                query.quantize = req.query.q;
            }
        }
    }
    console.log("query", query);
    model.AdminPlots.queryStatsData(query).then(function(results){
        var datastream = results[0];
        var fields = results[1].map(function(f){return f.name;});
        switch(output){
            case 'json':
                res.type('application/json');
                var rows;
                if(groupby){
                    rows = {};
                    fields = fields.filter(function(f){return f != groupby;});
                    datastream.on('data', function(row){
                        var idx = row[groupby];
                        delete row[groupby];
                        rows[idx] = fields.length == 1 ? row[fields[0]] : row;
                    });
                    datastream.on('end', function(row){
                        res.json(rows);
                    });
                }
            break;
            default:
                res.type('text/plain');
                datastream
                    .pipe(csv_stringify({
                        header:true,
                        columns:fields
                    }))
                    .pipe(res);
        }
    }).catch(next);
});


// RETIRED 2026-07-12: the live "job queue status" widget (Queue ID /
// Iteration / Waiting / Max concurrent) described the AWS SQS-style queue
// daemon that ran the analysis pipeline pre-migration. That service is gone;
// `config('hosts').jobqueue` still points at the dead AWS-era address
// (10.0.0.4:3007), so this endpoint hung until TCP timeout then errored.
// The modern pipeline is the in-cluster jobqueue-dispatcher (ns apps-prod),
// which polls arbimon2.jobs (state='waiting') and launches per-type k8s
// Jobs — there is NO persistent queue object with those fields to report.
// Return an explicit retired marker instantly (no network call) so the UI
// can show an honest note instead of a spinner/timeout. Real live job data
// is still available via the Job List below (GET /admin/jobs) and the
// per-type traffic light on the dashboard. See rfcx-local OPEN-ITEMS #52.
router.get('/job-queue', function(req, res) {
    res.type('json');
    res.json({
        retired: true,
        error: 'The legacy job-queue daemon was retired in the AWS\u2192cluster migration. Analysis jobs now run via the in-cluster jobqueue-dispatcher; see the Job List below for live jobs.'
    });
});

router.get('/jobs', function(req, res, next) {
    res.type('json');
    model.jobs.find(req.query, function(err, jobs) {
        if(err) return next(err);

        res.json(jobs);
    });
});

router.use('/projects', require('./projects'));
router.use('/users', require('./users'));





module.exports = router;
