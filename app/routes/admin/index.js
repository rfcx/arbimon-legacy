/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:admin');
var express = require('express');
var request = require('request');
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


router.get('/job-queue', function(req, res, next) {
    res.type('json');
    request.get(config('hosts').jobqueue + '/stats')
        .on('error', function(err) {
            res.json({ error:'Could not read job queue stats.' });
        })
        .pipe(res);
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
