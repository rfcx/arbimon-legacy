/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route');
var express = require('express');
var router = express.Router();
var async = require('async');
var joi = require('joi');
var util = require('util');
var gravatar = require('gravatar');
var paypal = require('paypal-rest-sdk');
var uuid = require('node-uuid');

var model = require('../../../model');

// routes
var sites = require('./sites');
var recording_routes = require('./recordings');
var training_set_routes = require('./training_sets');
var playlist_routes = require('./playlists');
var soundscape_routes = require('./soundscapes');
var jobsRoutes = require('./jobs');


router.param('projectUrl', function(req, res, next, project_url){
    model.projects.find({ url: project_url }, function(err, rows) {
        if(err){
            return next(err);
        }

        if(!rows.length){
            return res.status(404).json({ error: "project not found"});
        }

        req.project = rows[0];
        return next();
    });
});

router.use('/:projectUrl/sites', sites);

router.get('/:projectUrl/info', function(req, res, next) {
    res.json(req.project);
});

router.post('/:projectUrl/info/update', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you dont have permission to 'manage project settings'" });
    }
    
    if(!req.body.project) {
        return res.status(400).json({ error: "missing parameters" });
    }
    
    // make sure project requested is the one updated
    req.body.project.project_id = req.project.project_id;
    
    var newProjectInfo;
    
    async.waterfall([
        function(callback) {
            var schema = {
                project_id: joi.number().required(),
                name: joi.string(),
                url: joi.string(),
                description: joi.string(),
                is_private: joi.number(),
            };
            
            joi.validate(req.body.project, schema, { stripUnknown: true }, 
                function(err, projectInfo){ 
                    newProjectInfo = projectInfo;
                    callback();
            });
        },
        function verifyName(callback) {
            if(req.project.name !== newProjectInfo.name) {
                model.projects.findByName(newProjectInfo.name, function(err, rows){
                    if(rows.length > 0 && rows[0].project_id !== req.project.project_id) {
                        return res.json({ success: false , error: "Name " + newProjectInfo.name +" not available" });
                    }
                    callback(null);
                });
            }
            else {
                callback(null);
            }
        },
        function verifyUrl(callback) {
            if(req.project.url !== newProjectInfo.url) {
                model.projects.findByUrl(newProjectInfo.url, function(err, rows){
                    if(rows.length > 0 && rows[0].project_id !== req.project.project_id) {
                        return res.json({ success: false , error: "URL " + newProjectInfo.url +" not available" });
                    }
                    callback(null, true);
                });
            }
            else {
                callback(null, false);
            }
        },
        function(urlChanged, callback) {
            model.projects.update(newProjectInfo, function(err, result){
                if(err) return next(err);
                
                var url = urlChanged ? newProjectInfo.url : undefined;
                
                debug("update project:", result);
                res.json({ success: true , url: url });
            });
        }
    ]);
});

router.get('/:projectUrl/classes', function(req, res, next) {
    model.projects.getProjectClasses(req.project.project_id, function(err, classes){
        if(err) return next(err);
        res.json(classes);
    });
});

router.post('/:projectUrl/class/add', function(req, res, next) {

    if(!req.body.species || !req.body.songtype) {
        return res.status(400).json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        return res.status(401).json({ error: "you dont have permission to 'manage project species'" });
    }

    var projectClass = {
        songtype: req.body.songtype,
        species: req.body.species,
        project_id: req.project.project_id
    };

    model.projects.insertClass(projectClass, function(err, result){
        if(err) return next(err);
        
        if(result.error) {
            return res.json(result);
        }
        
        model.projects.insertNews({
            news_type_id: 5, // class added
            user_id: req.session.user.id,
            project_id: req.project.project_id,
            data: JSON.stringify({ species: projectClass.species, song: projectClass.songtype })
        });
        
        debug("class added:", result);
        res.json({ success: true });
    });
});

router.post('/:projectUrl/class/del', function(req, res, next){
    if(!req.body.project_classes) {
        return res.status(400).json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        return res.status(401).json({ error: "you dont have permission to 'manage project species'" });
    }
    
    
    async.waterfall([
        function(callback) {
            model.projects.getProjectClasses(req.project.project_id, function(err, classes) {
                if(err) return next(err);
                
                callback(null, classes);
            });
        },
        function(classes) {
            model.projects.removeClasses(req.body.project_classes, function(err, result){
                if(err) return next(err);
                
                var classesDeleted = classes.filter(function(clss) {
                    return req.body.project_classes.indexOf(clss.id) >= 0;
                });
                
                classesDeleted = classesDeleted.map(function(clss){
                    return clss.species_name + " " + clss.songtype_name;
                });
                
                model.projects.insertNews({
                    news_type_id: 6, // class removed
                    user_id: req.session.user.id,
                    project_id: req.project.project_id,
                    data: JSON.stringify({ classes: classesDeleted })
                });
                
                debug("class removed:", result);
                res.json({ success: true, deleted: classesDeleted });
            });
        }
    ]);
});

router.get('/:projectUrl/roles', function(req, res, next) {
    model.projects.availableRoles(function(err, roles){
        if(err) return next(err);
        
        res.json(roles);
    });
});

router.get('/:projectUrl/users', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }
    
    model.projects.getUsers(req.project.project_id, function(err, rows){
        if(err) return next(err);
        
        var users = rows.map(function(row){
            row.imageUrl = gravatar.url(row.email, { d: 'monsterid', s: 60 }, req.secure == 'https');
            
            return row;
        });
        
        res.json(users);
    });
});

router.post('/:projectUrl/user/add', function(req, res, next) {
    if(!req.body.user_id) {
        return res.json({ error: "missing parameters"});
    }
    
    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }
    
    model.projects.addUser({
        project_id: req.project.project_id,
        user_id: req.body.user_id,
        role_id: 2 // default to normal user
    },
    function(err, result){
        if(err) return next(err);
        
        debug("add user:", result);
        res.json({ success: true });
    });
});

router.post('/:projectUrl/user/role', function(req, res, next) {
    
    if(!req.body.user_id || !req.body.role_id) {
        return res.json({ error: "missing parameters"});
    }
    
    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }
    
    model.projects.changeUserRole({
        project_id: req.project.project_id,
        user_id: req.body.user_id,
        role_id: req.body.role_id
    },
    function(err, result){
        if(err) return next(err);
        
        debug("change user role:", result);
        res.json({ success: true });
    });
});

router.post('/:projectUrl/user/del', function(req, res, next) {
    if(!req.body.user_id) {
        return res.json({ error: "missing parameters"});
    }
    
    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }
    
    model.projects.removeUser(req.body.user_id, req.project.project_id, function(err, result){
        if(err) return next(err);
        
        debug("remove user:", result);
        res.json({ success: true });
    });
});

router.get('/:projectUrl/user-permissions', function(req, res, next) {
    model.users.getPermissions(
        req.session.user.id, 
        req.project.project_id, 
        function(err, rows) {
            if(err) return next(err);
            
            if(!rows.length && req.project.is_private && !req.session.user.isSuper) {
                return res.json({ authorized: false });
            }
            
            var result = { 
                authorized: true,
                public: !req.project.is_private,
                super: !!req.session.user.isSuper,
                permissions: rows.map(function(perm) { return perm.name; }),
            };
            
            res.json(result);
        }
    );
});

router.get('/:projectUrl/validations/count', function(req, res, next) {
    model.projects.validationsCount(req.project.project_id, function(err, result) {
        if(err) return next(err);
        
        res.json({ count: result[0].count });
    });
});

router.get('/:projectUrl/usage', function(req, res, next) {
    model.projects.getStorageUsage(req.project.project_id, function(err, result) {
        if(err) return next(err);
        
        res.json({ min_usage: result[0].min_usage });
    });
});

router.use('/:projectUrl/recordings', recording_routes);
router.use('/:projectUrl/training-sets', training_set_routes);
router.use('/:projectUrl/playlists', playlist_routes);
router.use('/:projectUrl/soundscapes', soundscape_routes);
router.use('/:projectUrl/jobs', jobsRoutes);


module.exports = router;
