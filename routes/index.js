var express = require('express');
var router = express.Router();


var project = require('./project');
var dataApi = require('./data-api');
var uploads = require('./uploads');


router.get('/register', function(req, res) {
    res.render('index', { title: 'Express' });
});

router.get('/forgot', function(req, res) {
    res.render('index', { title: 'Express' });
});


// are available only to logged users

// all routes after this middleware
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

router.use('/api', dataApi);
router.use('/project', project);
router.use('/uploads', uploads);

module.exports = router;
