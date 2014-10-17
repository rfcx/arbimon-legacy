var express = require('express');
var router = express.Router();
var async = require('async');
var util = require('util');

var model = require('../../../models');
var recording_routes = require('./recordings');
var training_set_routes = require('./training_sets');


router.post('/create', function(req, res, next) {
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
                news_type_id: 1, // project created
                user_id: req.session.user.id,
                project_id: project.project_id,
                description: util.format("Site '%s' created by %s", site.name, req.session.user.username)
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
            news_type_id: 1, // project created
            user_id: req.session.user.id,
            project_id: project.project_id,
            description: util.format("Site '%s' update by %s", site.name, req.session.user.username)
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

router.get('/:projectUrl/classes', function(req, res, next) {
    model.projects.getProjectClasses(req.project, function(err, classes){
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

        console.log("insert class:", result);
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

    model.projects.removeClasses(req.body.project_classes, function(err, result){
        if(err) return next(err);

        console.log("insert class:", result);
        res.json({ success: true });
    });
});

router.use('/:projectUrl/recordings', recording_routes);
router.use('/:projectUrl/training-sets', training_set_routes);

module.exports = router;
