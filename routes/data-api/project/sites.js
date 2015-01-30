var debug = require('debug')('arbimon2:route:playlists');
var express = require('express');
var router = express.Router();

var model = require('../../../model');

router.get('/', function(req, res, next) {
    model.projects.getProjectSites(req.project.project_id, function(err, rows) {
        if(err) return next(err);
        res.json(rows);
        return null;
    });
});

router.post('/create', function(req, res, next) {
    var project = req.project;
    var site = req.body.site;

    if(!req.haveAccess(req.project.project_id, "manage project sites")) {
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

router.post('/import', function(req, res, next) { 
    var project = req.project;
    var site = req.body.site;
    
    model.sites.importSiteToProject(site.id, project.project_id, function(err, rows) {
        if(err) return next(err);
        
        debug(rows);
        res.json({ msg: "site imported", success: true });
    });
});

router.post('/update', function(req, res, next) {
    var project = req.project;
    var site = req.body.site;
    
    console.log(req.body);
    
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

router.post('/delete', function(req, res, next) {
    var project = req.project;
    var site = req.body.site;

    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    
    model.sites.removeFromProject(site.id, project.project_id, function(err, rows) {
        if(err) return next(err);

        model.projects.insertNews({
            news_type_id: 4, // site deleted
            user_id: req.session.user.id,
            project_id: project.project_id,
            data: JSON.stringify({ sites: site.name })
        });

        res.json(rows);
    });
});



module.exports = router;
