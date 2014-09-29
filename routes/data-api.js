var express = require('express');
var router = express.Router();
var model = require('../models');

router.get('/user/projectlist', function(req, res, next) {
    model.users.projectList(req.session.user.id, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/user/feed', function(req, res) {
    res.status(200).end();
});

router.get('/project/:projectUrl/getInfo', function(req, res) {
    var project_url  = req.param('projectUrl');
    
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
            
        res.json(rows);
    });
});

module.exports = router;
