/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();

var project = require('./project');
var dataApi = require('./data-api');
var site = require('./site');
var login = require('./login');
var acmeChallenge = require('./acme-challenge');
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;
var config = require('../config');
const auth0Service = require('../model/auth0')
const model = require('../model');
const authentication = require('../middleware/jwt');
const parseTokenData = authentication.parseTokenData;
const { getCachedMetrics } = require('../utils/cached-metrics');

router.get('/legacy-api/alive', function(req, res, next) { // for health checks
    res.type('json');
    queryHandler("SELECT project_id FROM projects LIMIT 1", function (err){
        if (err) {
            next(err);
            return;
        } else {
            res.status(200);
            res.json({ alive: true });
        }
    });
});


router.use('/', parseTokenData(), login);

router.get('/support', function(req, res) {
    res.redirect(config('hosts').support);
});

router.get('/classifiers', function(req, res) {
    res.type('html');
    res.render('classifiers', { user: req.session.user });
});

router.use('/', acmeChallenge);

// all routes after this middleware
// are available only to logged users
router.use(function(req, res, next) {
    console.log('\n\n---TEMP: auth req.originalUrl', req.originalUrl)
    if (['/legacy-api/recordings-species-count', '/legacy-api/projects-count', '/legacy-api/jobs-count', '/legacy-api/recordings-count'].includes(req.originalUrl)) { return next(); }
    if (!req.user) {
        if (req.session) {
            req.session.currentPath = req.protocol + '://' + req.get('host') + req.originalUrl;
        }
        return res.redirect('/legacy-login')
    }
    return next();
});

router.get('/projects/:externalId', async (req, res) => {
    res.type('html');
    try {
        const project = await model.projects.find({external_id: req.params.externalId}).get(0);
        return res.redirect(`/p/${project.url}`);
      }
      catch (e) {
        return res.redirect('/');
    }
});

router.get('/', function(req, res) {
    res.redirect('/my-projects');
});

router.get('/projects', function(req, res) {
    res.redirect('/my-projects');
});

router.get('/project/:projectUrl/dashboard', function(req, res, next) {
    res.type('json');
    return res.redirect(`/p/${req.params.projectUrl}/overview`)
});

router.get('/user-settings', function(req, res) {
    res.type('html');
    if (req.session.user && req.session.loggedIn) {
        res.render('user-settings', {
            title: "User settings",
            user: req.session.user,
            state: ''
        });
    } else {
        res.redirect('/');
    }
});

// Home page metrics

router.get('/legacy-api/projects-count', function(req, res, next) {
    res.type('json');
    const key = { 'project-count': 'project-count' }
    getCachedMetrics(req, res, key, null, next);
});

router.get('/legacy-api/jobs-count', function(req, res, next) {
    res.type('json');
    const key = { 'job-count': 'job-count' }
    getCachedMetrics(req, res, key, null, next);
});

router.get('/legacy-api/recordings-species-count', function(req, res, next) {
    res.type('json');
    const key = { 'species-count': 'species-count' }
    getCachedMetrics(req, res, key, null, next);
});

router.get('/legacy-api/recordings-count', function(req, res, next) {
    res.type('json');
    const key = { 'recording-count': 'recording-count' }
    getCachedMetrics(req, res, key, null, next);
});

router.use('/legacy-api', dataApi);
router.use('/project', project);
router.use('/site', site);
router.use('/citizen-scientist', require('./citizen-scientist'));
router.use('/visualizer', require('./visualizer'));
router.use('/', require('./access-token'));


module.exports = router;
