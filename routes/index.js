var express = require('express');
var router = express.Router();


var project = require('./project');
var dataApi = require('./data-api');


router.get('/register', function(req, res) {
    res.render('index', { title: 'Express' });
});

router.get('/forgot', function(req, res) {
    res.render('index', { title: 'Express' });
});

router.use(function (req, res, next) {                 // all routes after this middleware
    if (req.isAuthenticated()) { return next(); }   // are available only to logged users
    res.redirect('/login');
});

router.get('/', function(req, res) {
    res.redirect('/home');
});

router.get('/home', function(req, res) {
    res.render('home', { title: "home", user: req.user });
});

router.use('/api', dataApi);

router.use('/project', project);


module.exports = router;
