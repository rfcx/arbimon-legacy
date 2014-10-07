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

router.get('/project/:projectUrl/info', function(req, res, next) {
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
router.get('/project/:projectUrl/sites', function(req, res, next) {
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

router.post('/project/create/site', function(req, res, next) {
    var project = req.body.project;
    var site = req.body.site;
        
    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    
    model.sites.exists(site.name, project.project_id, function(err, exists) {
        if(err) return next(err);
        
        if(exists)
            return res.json({ error: 'site with same name already exists'});
        
        site.project_id = project.project_id;
        
        model.sites.insert(site, function(err, rows) {
            if(err) return next(err);
            
            model.projects.insertNews({ 
                news_type_id: 1, // project created
                user_id: req.session.user.id,
                project_id: project.project_id,
                description: util.format("Site '%s' created by %s", site.name, req.session.user.username)
            });
            
            res.json({ message: "New site created" });
        });
    });
});

router.post('/project/update/site', function(req, res, next) {
    var project = req.body.project;
    var site = req.body.site;
    
    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
            
    site.project_id = project.project_id;
        
    model.sites.update(site, function(err, rows) {
        if(err) return next(err);
        
        model.projects.insertNews({ 
            news_type_id: 1, // project created
            user_id: req.session.user.id,
            project_id: project.project_id,
            description: util.format("Site '%s' update by %s", site.name, req.session.user.username)
        });
        
        res.json({ message: "site updated" });
    });
});

router.post('/project/delete/sites', function(req, res, next) {
    var project = req.body.project;
    var sites = req.body.sites;
    
    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    
    var sitesIds = $scope.checked.map(function(site) {
        return site.id;
    });
    
    var sitesNames = $scope.checked.map(function(site) {
        return site.name;
    }).join(', ');
        
    model.sites.remove(sitesIds, function(err, rows) {
        if(err) return next(err);
        
        model.projects.insertNews({ 
            news_type_id: 1, // project created
            user_id: req.session.user.id,
            project_id: project.project_id,
            description: util.format("Sites '%s' deleted by %s", sitesNames, req.session.user.username)
        });
        
        res.json(rows);
    });
});

/**
 * Return a list of all the sites in a project.
 */
router.get('/project/:projectUrl/recordings/count/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {count_only:true}, function(err, count) {
            if(err) return next(err);
                
            res.json(count);
            return null;
        });
        return null;
    });
});

router.get('/project/:projectUrl/recordings/available/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {count_only:true, group_by:'next', collapse_single_leaves:true}, function(err, count) {
            if(err) return next(err);
                
            res.json(count);
            return null;
        });
        return null;
    });
});

router.get('/project/:projectUrl/recordings/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;

        model.recordings.findByUrlMatch(recording_url, project_id, {}, function(err, rows, fields) {
            if(err) return next(err);
                
            res.json(rows);
            return null;
        });
        return null;
    });
    
});

router.get('/project/:projectUrl/recordings/info/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err){ next(err); return;}
        
        if(!rows.length){ res.status(404).json({ error: "project not found"}); return; }
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {limit:1}, function(err, recordings) {
            if(err){ next(err); return;}
            var recording = recordings[0];
            var url_comps = /(.*)\/([^/]+)\/([^/]+)/.exec(req.originalUrl);
            recording.audioUrl = url_comps[1] + "/audio/" + recording.id;
            recording.imageUrl = url_comps[1] + "/image/" + recording.id;
            model.recordings.fetchInfo(recording, function(err, recording){
                if(err){ next(err); return;}
                model.recordings.fetchValidations(recording, function(err, validations){
                    if(err){ next(err); return;}
                    recording.validations = validations;
                    res.json(recording);
                })
            });
        });
    });
    
});

router.get('/project/:projectUrl/recordings/audio/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {limit:1}, function(err, recordings) {
            if(err) return next(err);
            var recording = recordings[0];
            model.recordings.fetchAudioFile(recording, function(err, audio_file){
                res.sendFile(audio_file.path);
            })
            return null;
        });
        return null;
    });
    
});

router.get('/project/:projectUrl/recordings/image/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {limit:1}, function(err, recordings) {
            if(err) return next(err);
            var recording = recordings[0];
            model.recordings.fetchSpectrogramFile(recording, function(err, spectrogram_file){
                if(err) return next(err);
                return res.sendFile(spectrogram_file.path);
            })
            return null;
        });
        return null;
    });
    
});

router.get('/project/:projectUrl/species', function(req, res, next) {
    var project_url   = req.param('projectUrl');
});

module.exports = router;
