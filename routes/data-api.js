var express = require('express');
var router = express.Router();
var model = require('../models');
var async = require('async');
var util = require('util');

router.get('/user/projectlist', function(req, res, next) {
    model.users.projectList(req.session.user.id, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/user/feed', function(req, res) {
    res.status(200).end();
});

router.post('/project/create', function(req, res, next) {
    var project = req.body.project;
    project.owner_id = req.session.user.id;
    project.project_type_id = 1;
    
    async.parallel({   // check if there any conflict
        nameExists: function(callback) {
            model.projects.findByName(project.name, function(err, rows) {
                if(err) return next(err);
                
                if(!rows.length)
                    callback(null, false);
                else
                    callback(null, true);
            });
        },
        urlExists: function(callback) {
            model.projects.findByUrl(project.url, function(err, rows) {
                if(err) return next(err);
                
                if(!rows.length)
                    callback(null, false);
                else
                    callback(null, true);
            });
        }
    },
    function(err, results) {
        
        if(results.nameExists || results.urlExists) {
            // respond with error
            results.error = true;
            return res.json(results);
        }
        
        // no error create new project
        model.projects.insert(project, function(err, rows) {
            if(err) return next(err);
            
            var project_id = rows.insertId;
            
            model.projects.addUser({
                user_id: project.owner_id,
                project_id: project_id,
                role_id: 4 // owner role id
            },
            function(err, rows) {
                if(err) next(err);
                
                model.projects.insertNews({ 
                    news_type_id: 1, // project created
                    user_id: project.owner_id,
                    project_id: project_id,
                    description: util.format("Project '%s' created by %s", project.name, req.session.user.username)
                });
                res.json({ message: util.format("Project '%s' successfully created!", project.name) });
            });
        });
    });
});

router.get('/project/:projectUrl/getInfo', function(req, res) {
    var project_url  = req.param('projectUrl');
    
    model.projects.findByUrl(project_url, function(err, rows) {
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
