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
const { getMetrics, getCachedMetrics } = require('../../../utils/cached-metrics');
var model = require('../../../model');
const moment = require('moment-timezone');
let APIError = require('../../../utils/apierror');

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

        // rfcx-local 2026-08-31 (OPEN-ITEMS §40 rider #4): req.session.user can be
        // UNDEFINED on an anonymous / expired-session path. The unguarded property
        // read threw inside a `q` promise chain -> uncaughtException -> pod exit 1
        // (incident 2026-08-27T16:19:17Z). Same guard shape the codebase already
        // uses elsewhere (`req.session ? req.session.user : undefined`).
        let sessionUser = req.session && req.session.user
        if (!sessionUser) {
            // No hydrated session user: cannot resolve per-project permissions.
            return res.sendStatus(401);
        }
        let permissions = sessionUser.permissions && sessionUser.permissions[project.project_id]
        if (!permissions || (permissions && !permissions.length)) {
            model.users.getPermissions(sessionUser.id, project.project_id, function(err, rows) {
                if(req.session.isAnonymousGuest === true) {
                    // if not authorized to see project send 401
                    return res.sendStatus(401);
                }
                if (project.is_private && !rows.length && req.session.user.isSuper === 0) {
                    // if project is private and user hasn't permissions into the project send 401
                    return res.sendStatus(401);
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

router.use('/:projectUrl/sites', sites);

router.get('/:projectUrl/info', function(req, res, next) {
    res.type('json');
    res.json({ ...req.project, bioAnalyticsBaseUrl: rfcxConfig.bioAnalyticsBaseUrl });
});

router.get('/:projectUrl/tiering-usage', function(req, res, next) {
    res.type('json');
    model.tiering.getProjectTieringUsage(req.project.project_id)
        .then(function(usage) {
            res.json(usage);
        })
        .catch(next);
});

router.get('/:projectUrl/info/source-project', function(req, res, next) {
    res.type('json');
    model.projects.findById(req.query.project_id, function(err, result){
        if(err) return next(err);
        res.json(result);
    });

});

router.get('/:projectUrl/get-projects-by-role', function(req, res, next) {
    res.type('json');
    const userId = req.session.user.id;
    model.projects.getProjectsToShareModel(userId, function(err, result) {
        if(err) return next(err);
        res.json(result.filter(project => project.project_id !== req.project.project_id));
    });

});

// Dasboard page metrics
router.get('/:projectUrl/site-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-site-count': `project-${p}-si` }
    getMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/species-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-species-count': `project-${p}-sp` }
    getMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/playlist-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-playlist-count': `project-${p}-pl` }
    getMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/pm-species-detected', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-pm-sp-count': `project-${p}-pm-sp` }
    getMetrics(req, res, key, p, next);
});

router.get('/:projectUrl/pm-template-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-pm-t-count': `project-${p}-pm-t` }
    getMetrics(req, res, key, p, next);
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
                is_private: joi.number(),
                public_templates_enabled: joi.number(),
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
            // ANSWER ONLY AFTER THE TRANSACTION COMMITS.
            //
            // This step used to call updateProjectInArbimonAndCoreAPI WITHOUT awaiting it and
            // answer {success:true} immediately. That model call opens a transaction (the
            // arbimon `projects` UPDATE, then the core PATCH) and its catch ROLLS THE
            // TRANSACTION BACK, throwing into nothing because the response was already sent.
            // So ANY failure left the legacy/PG plane unchanged behind a success response, and
            // the SPA (biodiversity-api project-profile-bll) went on to write
            // insights.location_project -- three planes diverged with no error anywhere the
            // user could see, and every legacy /p/<new-slug>/* panel 404'd.
            // Two real user cases: project 9806 (broken 17 days) and 9809 (broken mid-flip).
            // Record: rfcx-local runbooks/FINDING-2026-09-12-spa-rename-no-legacy-propagation.md
            //
            // NOTE the earlier waterfall steps (verifyName/verifyUrl) answer and deliberately
            // never call `callback`, so the waterfall simply stops there and this step does not
            // run -- that shape is preserved, and the headersSent guard below keeps a late
            // rejection from ever answering twice (ERR_HTTP_HEADERS_SENT).
            model.projects.updateProjectInArbimonAndCoreAPI(newProjectInfo, req.session.idToken)
                .then(function() {
                    var url = urlChanged ? newProjectInfo.url : undefined;
                    if (res.headersSent) { return; }
                    res.json({ success: true , url: url });
                })
                .catch(function(err) {
                    // An EXPLICIT status rather than next(err): the generic handler in
                    // app/index.js answers an APIError as a bare JSON STRING (res.json(err.message)),
                    // whereas every other failure answer on this route is a
                    // {success:false, error:...} object -- so an explicit status keeps one
                    // response shape for all failures of this endpoint. What actually matters
                    // downstream is the 5xx itself: the SPA's unpackAxiosError re-throws any
                    // non-2xx, which aborts updateProjectAndProfile BEFORE its local insights
                    // write, and the legacy Angular settings page's .error() handler shows
                    // notify.serverError(). A failed rename now fails atomically for the user
                    // instead of silently diverging the planes.
                    console.error('Failed to update project', (err && err.stack) || err);
                    if (res.headersSent) { return; }
                    var status = (err && typeof err.status === 'number' && err.status >= 400)
                        ? err.status
                        : 500;
                    var message = (err instanceof APIError && err.message)
                        ? err.message
                        : 'Failed to update project';
                    res.status(status).json({ success: false, error: message });
                });
        }
    ]);
});

router.get('/:projectUrl/classes', function(req, res, next) {
    res.type('json');
    const classId = req.query.class_id || null;

    let opts = {
        q: req.query.q,
        limit: req.query.limit,
        offset: req.query.offset,
        sortBy: req.query.sortBy,
        sortRev: req.query.sortRev === 'true' || req.query.sortRev === true,
    };

    if(req.query.validations) {
        opts.countValidations = true;
    }

    if (req.query.limit) {
        model.projects.getProjectClassesWithPagination(req.project.project_id, opts)
            .then(data => {
                res.json(data);
            }).catch(next);
    }
    else {
        model.projects.getProjectClasses(req.project.project_id, classId, opts, function(err, classes){
            if(err) return next(err);
            res.json(classes);
        });
    }
});

router.post('/:projectUrl/class/recognize', function(req, res, next) {
    res.type('json');

    if(!req.body.classes.length) {
        return res.status(400).json({ error: "missing parameters"});
    }
    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        return res.status(401).json({ error: "you dont have permission to manage project species'" });
    }
    const projectClasses = req.body.classes;
    return model.projects.recognizeClasses(req.project.project_id, projectClasses)
        .then((result) => {
            res.status(200).json({classes: result})
        })
        .catch(next)
});

router.post('/:projectUrl/class/bulk-add', function(req, res, next) {
    res.type('json');

    if(!req.body.classes.length) {
        return res.status(400).json({ error: "missing parameters"});
    }
    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        return res.status(401).json({ error: "you dont have permission to manage project species'" });
    }
    const projectClasses = req.body.classes;
    return model.projects.insertBatchClassesAsync(req.project.project_id,projectClasses)
            .then(() => {
                res.status(201).json({ message: 'The classes were successfully added to the selected project.' })
            })
            .catch(next)
});

router.post('/:projectUrl/class/add', function(req, res, next) {
    res.type('json');

    if(!req.body.species || !req.body.songtype) {
        return res.status(400).json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        return res.status(401).json({ error: "you dont have permission to manage project species'" });
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
    model.projects.exportProjectSites(project).then(async (results) => {
        const datastream = results[0];
        let fields = results[1].map(f => f.name)
        const updated_at_idx = fields.indexOf('updated_at');
        if (updated_at_idx !== -1) {
            fields.splice(updated_at_idx, 1);
        }
        const external_idx = fields.indexOf('external_id');
        if (external_idx !== -1) {
            fields.splice(external_idx, 1);
        }
        fields.push('Deployed')
        fields.push('Updated')

        let deploymentData, deploymentBySite = {}
        try {
            deploymentData = await model.sites.getDeployedData(req.project.external_id, req.session.idToken)
            deploymentData = JSON.parse(deploymentData)
            if (deploymentData && deploymentData.length) {
                deploymentData.forEach(data => { return deploymentBySite[data.streamId] = {
                    streamId: data.streamId,
                    deployedAt: data.deployedAt
                }})
            }
        } catch (e) {}

        datastream
            .on('data', (data) => {
                if (deploymentBySite && deploymentBySite[data.external_id]) {
                    data['Deployed'] = deploymentBySite[data.external_id].deployedAt ? moment.tz(moment.utc(deploymentBySite[data.external_id].deployedAt), data.Timezone).format('YYYY-MM-DD HH:mm:ss') : 0
                } else data['Deployed'] = 'no data'
                delete data.external_id
                data['Updated'] = moment.tz(moment.utc(data.updated_at), data.Timezone).format('YYYY-MM-DD HH:mm:ss')
                delete data.updated_at
            })
            .pipe(csv_stringify({ header: true, columns:fields }))
            .pipe(res);
    }).catch(next);
});

router.get('/:projectUrl/species-export.csv', function(req, res, next) {
    res.type('text/csv');
    const project = req.project.project_id;
    model.projects.exportProjectSpecies(project).then(async (results) => {
        const datastream = results[0];
        const fields = results[1].map(f => f.name)
        datastream
            .pipe(csv_stringify({ header: true, columns:fields }))
            .pipe(res);
    }).catch(next);
})

router.post('/:projectUrl/user/add', async function(req, res, next) {
    res.type('json');
    if(!req.body.user_email) {
        return res.json({ error: "missing parameters"});
    }

    if(!req.haveAccess(req.project.project_id, "manage project settings")) {
        return res.json({ error: "you don't have permission to manage project settings and users" });
    }

    const token = req.headers.authorization || req.session.idToken || req.cookies.id_token

    const userRole = {
        project_id: req.project.project_id,
        user_email: req.body.user_email,
        role_id: req.body.role_id ? Number(req.body.role_id) : 2
    }
    model.projects.updateUserRoleInArbimonAndCoreAPI({userRole: userRole}, token, 'add').then(function() {
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

    const token = req.headers.authorization || req.session.idToken || req.cookies.id_token

    const userRole = {
        project_id: req.project.project_id,
        user_email: req.body.user_email,
        role_id: Number(req.body.role_id)
    }
    model.projects.updateUserRoleInArbimonAndCoreAPI({ userRole: userRole }, token, 'change').then(function() {
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

    const token = req.headers.authorization || req.session.idToken || req.cookies.id_token

    const options = {
        project_id: req.project.project_id,
        user_email: req.body.user_email
    }

    model.projects.updateUserRoleInArbimonAndCoreAPI(options, token, 'remove').then(function() {
        res.json({ success: true });
    }).catch(next);
});

// ⛔ RETIRED 2026-09-16 — THIS ROUTE IS SEALED. It answers 410 Gone and deletes
// nothing.
//
// WHY (rfcx-local OPEN-ITEMS §330 item (6); evidence
// runbooks/evidence/legacy-settings-page-usage-2026-09-16.md +
// legacy-delete-route-usage-census-2026-09-16.md):
//
// 1. NOBODY REACHES IT. Its only client was the legacy AngularJS settings page
//    (`assets/app/app/settings/details.html` → `settings/index.js` →
//    `a2services/project-service.js`), and that page is UNUSED: measured at the
//    edge over 14 d, `GET /legacy/project/<slug>/settings` = 1 and that one hit
//    was an engineer's own curl; the Angular `#/settings` route = 0; all 21
//    `/legacy/...` hits were hostile scanners (`phpinfo.php`, `.env`). The
//    modern SPA settings page served the real traffic. The UI is removed in this
//    same commit, so the route has no client at all.
// 2. IT IS THE WEAKER DELETE, AND THAT IS THE HAZARD. It calls `removeProject`,
//    which soft-deletes on LEGACY only: no membership snapshot, no ownership
//    reassignment to the `arbimon-deleted@` tombstone, other members left
//    attached, and — critically — **insights is never told**, because the
//    arbimon→bio ingest leg cannot carry it (§332). A project deleted here stays
//    LIVE on insights indefinitely. That is the 296-project divergence class
//    that §329 spent a session driving to zero.
// 3. OPERATOR RULING 2026-09-16 02:31: "delete should work the same for SPA and
//    legacy." With exactly ONE delete path that is true by construction.
//    Retirement is the cheapest way to satisfy it, and it REMOVES the hazard
//    rather than building parity machinery around a path no user reaches.
//
// THE ONE REAL DELETE PATH IS NOW: SPA → bio-api `DELETE /projects/:id`
// (snapshot → verify → reassign owner → soft-delete + actor attribution, one
// transaction), which then chains `/soft-remove` below for the legacy plane.
//
// ⚠️ 410, NOT 404, AND NOT A SILENT DELETION OF THE ROUTE. 410 Gone is the
// honest status for "this existed and was withdrawn", it is greppable in the
// edge logs, and it means any UNKNOWN caller (a saved curl, a partner script —
// code search cannot see those) gets a loud, diagnosable failure instead of a
// silent behaviour change. If such a caller surfaces, the fix is to point it at
// bio-api, not to unseal this.
//
// ⚠️ `removeProject` is deliberately LEFT IN PLACE: `/soft-remove` below still
// uses it as the SPA's legacy leg. Only this ENTRY POINT is sealed.
router.post('/:projectUrl/remove', function(req, res, next) {
    res.type('json');
    console.log('SEALED_ROUTE_CALLED ' + JSON.stringify({
        route: 'project/:projectUrl/remove',
        project_id: req.project && req.project.project_id,
        user: req.session && req.session.user && req.session.user.email,
        at: new Date().toISOString()
    }));
    next(new APIError('This endpoint has been retired. Delete a project from the project settings page.', 410));
});

router.post('/:projectUrl/soft-remove', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, 'delete project')) {
        next(new APIError('You do not have permission to delete this project'));
        return;
    }
    const idToken = req.headers.authorization?.split(' ')[1];
    model.projects.removeProject({
        project_id: req.project.project_id,
        idToken: req.session.idToken === undefined ? idToken : req.session.idToken,
        // See the `/remove` route above: `user.id`, not `user_id`.
        deleted_by: req.session.user && req.session.user.id
    }).then(function() {
        res.json({ message: 'Removed' });
    }).catch(next);
});

// Compensation counterpart of `/soft-remove` (rfcx-local OPEN-ITEMS §330 item (6);
// design runbooks/DESIGN-2026-09-16-project-delete-one-path.md §3).
//
// WHY THIS EXISTS: with the delete chain consolidated into bio-api, legacy's
// soft-delete is leg 2 of an ordered chain (legacy → core → insights-commit).
// If leg 3 (core) or leg 4 (insights commit) fails, bio-api must be able to
// UNDO this leg — the compensation is one UPDATE on a row the chain just wrote.
// Every leg being a reversible SOFT delete is the premise that makes
// compensate-backwards possible at all; without this route the premise was true
// in the schema and false over HTTP.
//
// SAME GATE AS THE DELETE ('delete project'): the caller is bio-api forwarding
// the deleting user's bearer, so the identity that was allowed to delete is the
// identity allowed to un-delete. A restore is not a privilege escalation — it
// undoes what the same caller just did.
//
// ⚠️ THIS IS NOT A GENERAL UNDELETE ENDPOINT and must not grow into one: it
// restores ONLY the project row marker (`deleted_at`/`deleted_by`). It does not
// un-archive recordings, restore memberships, or touch any other plane — the
// admin three-plane restore runbook
// (rfcx-local RUNBOOK-admin-project-undelete-2026-09-15.md) owns that shape.
router.post('/:projectUrl/soft-restore', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, 'delete project')) {
        next(new APIError('You do not have permission to delete this project'));
        return;
    }
    model.projects.restoreLegacy(req.project.project_id).then(function(restored) {
        // `restored` is the affected-row count. 0 means the project was not
        // soft-deleted — for a compensation call that is already the desired
        // end state, so it is reported, not errored.
        res.json({ message: 'Restored', restored: restored });
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

router.use('/:projectUrl/streams', require('./streams'));
router.use('/:projectUrl/recordings', recording_routes);
router.use('/:projectUrl/training-sets', training_set_routes);
router.use('/:projectUrl/playlists', playlist_routes);
router.use('/:projectUrl/templates', template_routes);
router.use('/:projectUrl/soundscapes', soundscape_routes);
router.use('/:projectUrl/jobs', jobsRoutes);
router.use('/:projectUrl/classifications', classiRoutes);
router.use('/:projectUrl/pattern-matchings', patternMatchingRoutes);
router.use('/:projectUrl/audio-event-detections-clustering', audioEventDetectionsClusteringRoutes);
router.use('/:projectUrl/clustering-jobs', clusteringRoutes);
router.use('/:projectUrl/tags', tagRoutes);
router.use('/:projectUrl/soundscape-composition', require('./soundscape-composition'));
router.use('/:projectUrl/citizen-scientist', require('./citizen-scientist'));

module.exports = router;
