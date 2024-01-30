/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route');
var express = require('express');
var router = express.Router();
var async = require('async');
var joi = require('joi');
var gravatar = require('gravatar');
var config = require('../../../config');
const rfcxConfig = config('rfcx');
const csv_stringify = require('csv-stringify');
const { getCachedMetrics } = require('../../../utils/cached-metrics');
var model = require('../../../model');

// routes
var sites = require('./sites');
var recording_routes = require('./recordings');
var training_set_routes = require('./training_sets');
var playlist_routes = require('./playlists');
var template_routes = require('./templates');
var soundscape_routes = require('./soundscapes');
var jobsRoutes = require('./jobs');
var classiRoutes = require('./classifications');
var patternMatchingRoutes = require('./pattern_matchings');
var cnnRoutes = require('./cnns');
var tagRoutes = require('./tags');
var audioEventDetectionsClusteringRoutes = require('./audio-event-detections-clustering');
var clusteringRoutes = require('./clustering-jobs');

router.param('projectUrl', function(req, res, next, project_url){
    res.type('json');
    model.projects.find({ url: project_url }, function(err, rows) {
        if(err){
            return next(err);
        }

        if(!rows.length){
            return res.status(404).json({ error: "project not found"});
        }

        const project = rows[0];

        let permissionsMap = rows.reduce(function(_, p) {
            _[p.name] = true;
            return _;
        })
        // Allow the navigation to the Visualizer page for citizen scientist users
        if (permissionsMap['use citizen scientist interface'] &&
            (req.inAppUrl && !req.inAppUrl.startsWith('visualizer'))) {
                return res.redirect('/citizen-scientist/' + project.project_id + '/');
        }

        let permissions = req.session.user.permissions && req.session.user.permissions[project.project_id]
        if (!permissions || (permissions && !permissions.length)) {
            model.users.getPermissions(req.session.user.id, project.project_id, function(err, rows) {
                if(req.session.isAnonymousGuest === true) {
                    // if not authorized to see project send 401
                    return res.sendStatus(401);
                }
                if (project.is_private && !rows.length && req.session.user.isSuper === 0) {
                    // if project is private and user hasn't permissions into the project send 401
                    return res.sendStatus(401);
                }
                if (!project.is_private && !rows.length && req.session.user.isSuper === 0) {
                    return res.redirect(`/p/${req.params.projectUrl}/insights`)
                }
                if(!req.session.user.permissions)
                    req.session.user.permissions = {};

                req.session.user.permissions[project.project_id] = rows;
                req.session.loggedIn = true

                req.project = project;

                return next();
            });
        }
        else {
            req.project = project;

            return next();
        }
    });
});

router.get('/:projectUrl/', function(req, res, next) {
    res.type('json');
    return res.redirect(`/p/${req.params.projectUrl}/dashboard`)
});

router.use('/:projectUrl/sites', sites);

router.get('/:projectUrl/info', function(req, res, next) {
    res.type('json');
    res.json({ ...req.project, bioAnalyticsBaseUrl: rfcxConfig.bioAnalyticsBaseUrl });
});

router.get('/:projectUrl/info/source-project', function(req, res, next) {
    res.type('json');
    model.projects.findById(req.query.project_id, function(err, result){
        if(err) return next(err);
        res.json(result);
    });

});

// Home page metrics

router.get('/projects-count', function(req, res, next) {
    res.type('json');
    const key = { 'project-count': 'project-count' }
    getCachedMetrics(req, res, key, null, next);
});

router.get('/jobs-count', function(req, res, next) {
    res.type('json');
    const key = { 'job-count': 'job-count' }
    getCachedMetrics(req, res, key, null, next);
});

router.get('/recordings-species-count', function(req, res, next) {
    res.type('json');
    const key = { 'species-count': 'species-count' }
    getCachedMetrics(req, res, key, null, next);
});

router.get('/recordings-count', function(req, res, next) {
    res.type('json');
    const key = { 'recording-count': 'recording-count' }
    getCachedMetrics(req, res, key, null, next);
});

// Dasboard page metrics
router.get('/:projectUrl/playlist-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-playlist-count': `project-${p}-pl` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/pm-species-detected', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-pm-sp-count': `project-${p}-pm-sp` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/pm-template-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-pm-t-count': `project-${p}-pm-t` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/rfm-classif-job-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-rfm-classif-job-count': `project-${p}-rfm-cl` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/rfm-species-detected', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-rfm-sp-count': `project-${p}-rfm-sp` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/rfm-training-job-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-rfm-training-job-count': `project-${p}-rfm-tr` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/aed-job-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-aed-job-count': `project-${p}-aed-job` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/clustering-job-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-clustering-job-count': `project-${p}-cl-job` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/clustering-species-detected', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-clustering-sp-count': `project-${p}-cl-sp` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/soundscape-job-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-soundscape-job-count': `project-${p}-soundsc` }
    getCachedMetrics(req, res, key, p, next);
});

// TODO reuse the router
router.post('/:projectUrl/info/update', function(req, res, next) {
    res.type('json');
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
                description: joi.string().allow(null, '').optional(),
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
            model.projects.updateProjectInArbimonAndCoreAPI(newProjectInfo, req.session.idToken);
            var url = urlChanged ? newProjectInfo.url : undefined;
            res.json({ success: true , url: url });
        }
    ]);
});

router.get('/:projectUrl/classes', function(req, res, next) {
    res.type('json');
    var classId = req.query.class_id || null;
    var options = {};
    if(req.query.validations) {
        options.countValidations = true;
    }

    model.projects.getProjectClasses(req.project.project_id, classId, options, function(err, classes){
        if(err) return next(err);
        res.json(classes);
    });
});

router.post('/:projectUrl/class/add', function(req, res, next) {
    res.type('json');

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
            data: JSON.stringify({
                class: [result.class],
                species: [result.species, projectClass.species],
                song: [result.songtype, projectClass.songtype]
            })
        });

        debug("class added:", result);
        res.json({ success: true });
    });
});

router.post('/:projectUrl/class/del', function(req, res, next){
    res.type('json');
    if(!req.body.project_classes) {
        return res.status(400).json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        return res.status(401).json({ error: "you dont have permission to 'manage project species'" });
    }

    removeClasses(req, res, next);
});

async function removeClasses(req, res, next) {
    const projectId = req.project.project_id
    const classIds = req.body.project_classes
    const classDeleted = await model.projects.getProjectClassesAsync(projectId, null, { ids: classIds })
    if (classDeleted.length) {
        await model.projects.removeClassesAsync(classIds)
        // Insert project news
        const deleted = classDeleted.map(function(clss){
            return clss.species_name + " " + clss.songtype_name;
        });

        model.projects.insertNews({
            news_type_id: 6, // class removed
            user_id: req.session.user.id,
            project_id: projectId,
            data: JSON.stringify({ classes: deleted })
        });

        res.json({ success: true, deleted });

        // Delete project species data
        const speciesAndSongtypeIds = classDeleted.map(function(cl) {
            return {
                speciesId: cl.species,
                songtypeId: cl.songtype
            }
        })
        await model.recordings.resetRecordingValidation(projectId, speciesAndSongtypeIds)
    }

}

router.get('/:projectUrl/roles', function(req, res, next) {
    res.type('json');
    model.projects.availableRoles(function(err, roles){
        if(err) return next(err);

        res.json(roles);
    });
});

router.get('/:projectUrl/users', function(req, res, next) {
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }

    model.projects.getUsers(req.project.project_id, function(err, rows){
        if(err) return next(err);

        var users = rows.map(function(row){
            row.imageUrl = gravatar.url(row.email, { d: 'monsterid', s: 60 }, req.secure);

            return row;
        });

        res.json(users);
    });
});

router.get('/:projectUrl/sites-export.csv', function(req, res, next) {
    res.type('text/csv');
    const project = req.project.project_id;
    model.projects.exportProjectSites(project).then((results) => {
        const datastream = results[0];
        const fields = results[1].map(f => f.name);
        datastream
            .pipe(csv_stringify({ header: true, columns:fields }))
            .pipe(res);
    }).catch(next);
});

router.post('/:projectUrl/user/add', async function(req, res, next) {
    res.type('json');
    if(!req.body.user_email) {
        return res.json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }

    const userRole = {
        project_id: req.project.project_id,
        user_email: req.body.user_email,
        role_id: req.body.role_id ? req.body.role_id : 2
    }
    model.projects.updateUserRoleInArbimonAndCoreAPI({userRole: userRole}, req.session.idToken, 'add').then(function() {
        res.json({ success: true });
    }).catch(next);
});

router.post('/:projectUrl/user/role', async function(req, res, next) {
    res.type('json');

    if(!req.body.user_email) {
        return res.json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }

    const userRole = {
        project_id: req.project.project_id,
        user_email: req.body.user_email,
        role_id: req.body.role_id
    }
    model.projects.updateUserRoleInArbimonAndCoreAPI({ userRole: userRole }, req.session.idToken, 'change').then(function() {
        res.json({ success: true });
    }).catch(next);
});

router.post('/:projectUrl/user/del', async function(req, res, next) {
    res.type('json');
    if(!req.body.user_email) {
        return res.json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }

    const options = {
        project_id: req.project.project_id,
        user_email: req.body.user_email
    }

    model.projects.updateUserRoleInArbimonAndCoreAPI(options, req.session.idToken, 'remove').then(function() {
        res.json({ success: true });
    }).catch(next);
});

router.post('/:projectUrl/remove', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, "delete project")) {
        next(new APIError('You do not have permission to delete this project'));
        return;
    }
    model.projects.removeProject({
        project_id: req.project.project_id,
        external_id: req.body.external_id,
        idToken: req.session.idToken
    }).then(function() {
        res.json({ result: 'success' });
    }).catch(next);
});

router.get('/:projectUrl/user-permissions', function(req, res, next) {
    res.type('json');
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
    res.type('json');
    model.projects.validationsCount(req.project.project_id, function(err, result) {
        if(err) return next(err);

        res.json({ count: result[0].count });
    });
});

router.get('/:projectUrl/usage', function(req, res, next) {
    res.type('json');
    model.projects.getStorageUsage(req.project.project_id).then(function(result) {
        res.json({ min_usage: result.min_usage });
    }).catch(next);
});

router.use('/:projectUrl/streams', require('./streams'));
router.use('/:projectUrl/recordings', recording_routes);
router.use('/:projectUrl/training-sets', training_set_routes);
router.use('/:projectUrl/playlists', playlist_routes);
router.use('/:projectUrl/templates', template_routes);
router.use('/:projectUrl/soundscapes', soundscape_routes);
router.use('/:projectUrl/jobs', jobsRoutes);
router.use('/:projectUrl/classifications', classiRoutes);
router.use('/:projectUrl/pattern-matchings', patternMatchingRoutes);
router.use('/:projectUrl/cnn', cnnRoutes);
router.use('/:projectUrl/audio-event-detections-clustering', audioEventDetectionsClusteringRoutes);
router.use('/:projectUrl/clustering-jobs', clusteringRoutes);
router.use('/:projectUrl/tags', tagRoutes);
router.use('/:projectUrl/audio-event-detections', require('./audio-event-detections'));
router.use('/:projectUrl/soundscape-composition', require('./soundscape-composition'));
router.use('/:projectUrl/citizen-scientist', require('./citizen-scientist'));
router.use('/:projectUrl/uploads', require('./uploads'));

module.exports = router;
