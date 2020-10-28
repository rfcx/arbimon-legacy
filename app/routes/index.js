/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();

var project = require('./project');
var dataApi = require('./data-api');
var uploads = require('./uploads');
var site = require('./site');
var login = require('./login');
var acmeChallenge = require('./acme-challenge');
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;
const auth0Service = require('../model/auth0')


router.get('/alive', function(req, res, next) { // for health checks
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


router.use('/', login);

router.get('/support', function(req, res) {
    res.type('html');
    res.render('post-page', {
        title: "Support",
        content: 'support',
        user: req.session.user
    });
});

router.get('/classifiers', function(req, res) {
    res.type('html');
    res.render('classifiers', { user: req.session.user });
});

router.get('/connect-with-rfcx', function(req, res) {
    const query = req.query || {}
    res.type('html');
    res.render('connect-with-rfcx', {
        user: req.session.user,
        auth0UniversalLoginUrl: auth0Service.universalLoginUrl,
        error: query.error || null
    });
});


router.use('/', acmeChallenge);

router.use('/uploads', uploads);

// all routes after this middleware
// are available only to logged users
router.use(function(req, res, next) {
    if(req.session && (req.session.loggedIn || req.session.isAnonymousGuest)) {
        return next();
    }
    res.render('get_fragment_hack.ejs');
});

// TODO[gio]:: this route is unused, since / gets handled in login, maybe delete?
router.get('/', function(req, res) {
    res.type('html');
    res.redirect('/home');
});

router.get('/process-order/:orderId', function(req, res, next) {
    res.type('html');
    // render view to show progress
    res.render('processing-order');
});

router.get('/home', function(req, res) {
    res.type('html');
    res.render('home', {
        title: "Home",
        user: req.session.user,
        state: 'home.my'
    });
});

router.get('/home/all', function(req, res) {
    res.type('html');
    res.render('home', {
        title: "Home",
        user: req.session.user,
        state: 'home.all'
    });
});


router.get('/user-settings', function(req, res) {
    res.type('html');
    if (req.session.user && req.session.loggedIn) {
        res.render('user-settings', { title: "User settings", user: req.session.user });
    } else {
        res.redirect('/home');
    }
});

router.use('/api', dataApi);
router.use('/project', project);
router.use('/site', site);
router.use('/citizen-scientist', require('./citizen-scientist'));
router.use('/visualizer', require('./visualizer'));
router.use('/', require('./access-token'));


module.exports = router;
