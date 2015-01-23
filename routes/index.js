var express = require('express');
var router = express.Router();


var project = require('./project');
var dataApi = require('./data-api');
var uploads = require('./uploads');
var admin = require('./admin');


router.get('/alive', function(req, res) { // for health checks
    res.sendStatus(200);
});


// all routes after this middleware
// are available only to logged users
router.use(function(req, res, next) {                
    if(req.session) { 
        if(req.session.loggedIn) return next(); 
    }   
    res.redirect('/login');
});

router.get('/', function(req, res) {
    res.redirect('/home');
});

router.get('/home', function(req, res) {
    res.render('home', { title: "Home", user: req.session.user });
});

// INCOMPLETE
router.get('/user-settings', function(req, res) {
    res.render('user-settings', { title: "User settings", user: req.session.user });
});

router.use('/api', dataApi);
router.use('/project', project);
router.use('/uploads', uploads);

router.use('/admin', admin);

module.exports = router;
