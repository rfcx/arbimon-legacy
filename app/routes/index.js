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
const model = require('../model');
const authentication = require('../middleware/jwt');
const parseTokenData = authentication.parseTokenData;
const { getCachedMetrics } = require('../utils/cached-metrics');

router.get('/legacy-api/alive', function(req, res, next) { // for health checks
    res.type('json');
    queryHandler("SELECT project_id FROM projects LIMIT 1", function (err){
        if (err) {
            console.error('[legacy-api/alive]', err)
            next(err);
        } else {
            res.status(200);
            res.json({ alive: true });
        }
    });
});

router.get(['/', '/projects'], function(req, res) {
    res.redirect('/my-projects');
});

router.get(['/project/:projectUrl', '/project/:projectUrl/dashboard'], function(req, res) {
    res.redirect(`/p/${req.params.projectUrl}`);
});

router.get('/projects/:externalId', async (req, res) => {
    try {
        const project = await model.projects.find({external_id: req.params.externalId}).get(0);
        return res.redirect(`/p/${project.url}`);
    }
    catch (e) {
        return res.redirect('/');
    }
});

// Home page metrics
router.get('/legacy-api/projects-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'project-count': 'project-count' }, null, next);
});
router.get('/legacy-api/jobs-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'job-count': 'job-count' }, null, next);
});
router.get('/legacy-api/recordings-species-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'species-count': 'species-count' }, null, next);
});
router.get('/legacy-api/recordings-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'recording-count': 'recording-count' }, null, next);
});

router.use('/', parseTokenData(), login);

router.use('/', acmeChallenge);

// Force login for routes after this
router.use(function(req, res, next) {
    if (!req.user) {
        if (req.session) {
            req.session.currentPath = req.protocol + '://' + req.get('host') + req.originalUrl;
        }
        return res.redirect('/legacy-login')
    }
    return next();
});

router.use('/legacy-api', dataApi);
router.use('/project', project);
router.use('/site', site);
router.use('/citizen-scientist', require('./citizen-scientist'));
router.use('/visualizer', require('./visualizer'));
router.use('/', require('./access-token'));


module.exports = router;
