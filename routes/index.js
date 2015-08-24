/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();

var project = require('./project');
var dataApi = require('./data-api');
var uploads = require('./uploads');
var login = require('./login');


router.use('/', login);

router.get('/terms', function(req, res) {
    res.render('terms');
});

router.get('/support', function(req, res) {
    res.render('support');
});

router.get('/classifiers', function(req, res) {
    res.render('classifiers');
});

router.use('/uploads', uploads);

// all routes after this middleware
// are available only to logged users
router.use(function(req, res, next) {
    if(req.session && req.session.loggedIn) { 
        return next(); 
    }
    res.render('get_fragment_hack.ejs');
});

// TODO[gio]:: this route is unused, since / gets handled in login, maybe delete?
router.get('/', function(req, res) {
    res.redirect('/home');
});

router.get('/process-order/:orderId', function(req, res, next) {
    // render view to show progress
    res.render('processing-order');
});

router.get('/home', function(req, res) {
    res.render('home', { title: "Home", user: req.session.user });
});


router.get('/user-settings', function(req, res) {
    res.render('user-settings', { title: "User settings", user: req.session.user });
});

router.use('/api', dataApi);
router.use('/project', project);



module.exports = router;
