var console={log:require('debug')('arbimon2:route')};
var express = require('express');
var router = express.Router();
var async = require('async');
var util = require('util');
var gravatar = require('gravatar');

var model = require('../../../models');

// routes
var recording_routes = require('./recordings');
var training_set_routes = require('./training_sets');
var playlist_routes = require('./playlists');
var soundscape_routes = require('./soundscapes');


router.post('/create', function(req, res, next) {
    var project = req.body.project;
    project.owner_id = req.session.user.id;
    project.project_type_id = 1;

    async.parallel({   // check if there any conflict
        exceedsProjectLimit: function(callback) {
            model.users.ownedProjectsQty(req.session.user.id, function(err, rows) {
                if(err) return next(err);

                if(rows[0].count < req.session.user.projectLimit)
                    callback(null, false);
                else
                    callback(null, true);
            });
        },
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

        if(results.exceedsProjectLimit && !req.session.user.isSuper) {
            return res.json({ 
                error: true,
                projectLimit: true
            });
        }
        
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
                    data: JSON.stringify({})
                });
                res.json({ message: util.format("Project '%s' successfully created!", project.name) });
            });
        });
    });
});

router.param('projectUrl', function(req, res, next, project_url){
    model.projects.findByUrl(project_url, function(err, rows) {
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

router.get('/:projectUrl/info', function(req, res, next) {
    res.json(req.project);
});

router.post('/:projectUrl/info/update', function(req, res, next) {
    if(!req.body.project)
        return res.json({ error: "missing parameters" });
    
    
    model.projects.update(req.body.project, function(err, result){
        if(err) return next(err);
        
        console.log("update project:", result);
        res.json({ success: true });
    });
});


 /** Return a list of all the sites in a project.
 */

router.get('/:projectUrl/sites', function(req, res, next) {
    model.projects.getProjectSites(req.project.project_id, function(err, rows) {
        if(err) return next(err);
        res.json(rows);
        return null;
    });
});

router.post('/create/site', function(req, res, next) {
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
                news_type_id: 2, // site created
                user_id: req.session.user.id,
                project_id: project.project_id,
                data: JSON.stringify({ site: site.name })
            });

            res.json({ message: "New site created" });
        });
    });
});

router.post('/update/site', function(req, res, next) {
    var project = req.body.project;
    var site = req.body.site;

    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }

    site.project_id = project.project_id;

    model.sites.update(site, function(err, rows) {
        if(err) return next(err);

        model.projects.insertNews({
            news_type_id: 3, // site updated
            user_id: req.session.user.id,
            project_id: project.project_id,
            data: JSON.stringify({ site: site.name })
        });

        res.json({ message: "site updated" });
    });
});

router.post('/delete/sites', function(req, res, next) {
    var project = req.body.project;
    var sites = req.body.sites;

    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    
    var sitesNames = sites.map(function(row) {
        return row.name;
    });
    
    var sitesIds = sites.map(function(row) {
        return row.id;
    });

    model.sites.remove(sitesIds, function(err, rows) {
        if(err) return next(err);

        model.projects.insertNews({
            news_type_id: 4, // site deleted
            user_id: req.session.user.id,
            project_id: project.project_id,
            data: JSON.stringify({ sites: sitesNames.join(', ') })
        });

        res.json(rows);
    });
});

router.get('/:projectUrl/classes', function(req, res, next) {
    model.projects.getProjectClasses(req.project.project_id, function(err, classes){
        if(err) return next(err);
        res.json(classes);
    });
});

router.post('/:projectUrl/class/add', function(req, res, next) {

    if(!req.body.project_id || !req.body.species || !req.body.project_id) {
        return res.json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.body.project_id, "manage project species")) {
        return res.json({ error: "you dont have permission to 'manage project species'" });
    }

    projectClass = {
        songtype: req.body.songtype,
        species: req.body.species,
        project_id: req.body.project_id
    };

    model.projects.insertClass(projectClass, function(err, result){
        if(err) return next(err);
        
        model.projects.insertNews({
            news_type_id: 5, // class added
            user_id: req.session.user.id,
            project_id: req.body.project_id,
            data: JSON.stringify({ species: projectClass.species, song: projectClass.songtype })
        });
        
        console.log("class added:", result);
        res.json({ success: true });
    });
});
router.post('/:projectUrl/class/del', function(req, res, next){
    if(!req.body.project_id || !req.body.project_classes) {
        return res.json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.body.project_id, "manage project species")) {
        return res.json({ error: "you dont have permission to 'manage project species'" });
    }
    
    
    async.waterfall([
        function(callback) {
            model.projects.getProjectClasses(req.body.project_id, function(err, classes) {
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
                    project_id: req.body.project_id,
                    data: JSON.stringify({ classes: classesDeleted })
                });
                
                console.log("class removed:", result);
                res.json({ success: true });
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
    model.projects.getUsers(req.project.project_id, function(err, rows){
        if(err) return next(err);
        
        var users = rows.map(function(row){
            row.imageUrl = gravatar.url(row.email, { d: 'monsterid', s: 60 }, https=req.secure);
            
            return row;
        });
        
        res.json(users);
    });
});

router.post('/:projectUrl/user/add', function(req, res, next) {
    if(!req.body.project_id || !req.body.user_id) {
        return res.json({ error: "missing parameters"});
    }
    
    if(!req.haveAccess(req.body.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }
    
    model.projects.addUser({
        project_id: req.body.project_id,
        user_id: req.body.user_id,
        role_id: 2 // default to normal user
    },
    function(err, result){
        if(err) return next(err);
        
        console.log("add user:", result);
        res.json({ success: true });
    });
});

router.post('/:projectUrl/user/role', function(req, res, next) {
    
    console.log(req.body);
    
    if(!req.body.project_id || !req.body.user_id || !req.body.role_id) {
        return res.json({ error: "missing parameters"});
    }
    
    if(!req.haveAccess(req.body.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }
    
    model.projects.changeUserRole({
        project_id: req.body.project_id,
        user_id: req.body.user_id,
        role_id: req.body.role_id
    },
    function(err, result){
        if(err) return next(err);
        
        console.log("change user role:", result);
        res.json({ success: true });
    });
});

router.post('/:projectUrl/user/del', function(req, res, next) {
    if(!req.body.project_id || !req.body.user_id) {
        return res.json({ error: "missing parameters"});
    }
    
    if(!req.haveAccess(req.body.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }
    
    model.projects.removeUser(req.body.user_id, req.body.project_id, function(err, result){
        if(err) return next(err);
        
        console.log("remove user:", result);
        res.json({ success: true });
    });
});

router.get('/:projectUrl/validations/count', function(req, res, next) {
    model.projects.validationsCount(req.project.project_id, function(err, result) {
        if(err) return next(err);
        
        res.json({ count: result[0].count });
    });
});

router.use('/:projectUrl/recordings', recording_routes);
router.use('/:projectUrl/training-sets', training_set_routes);
router.use('/:projectUrl/playlists', playlist_routes);
router.use('/:projectUrl/soundscapes', soundscape_routes);


module.exports = router;
