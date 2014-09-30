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
            
        res.json(rows[0]);
    });
});

 /**
 * Return a list of all the sites in a project.
 */
router.get('/project/:projectUrl/sites', function(req, res) {
    var project_url  = req.param('projectUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.projects.getProjectSites(project_id, function(err, rows) {
            if(err) return next(err);
                
            res.json(rows);
            return null;
        });
        return null;
    });
    
});

/**
 * Return a list of all the sites in a project.
 */
router.get('/project/:projectUrl/recordings/:recUrl?', function(req, res) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, function(err, rows) {
            if(err) return next(err);
                
            res.json(rows);
            return null;
        });
        return null;
    });
    
});


module.exports = router;
