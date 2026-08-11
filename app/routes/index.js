/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();

var project = require('./project');
var dataApi = require('./data-api');
var login = require('./login');
var acmeChallenge = require('./acme-challenge');
var dbpool = require('../utils/dbpool');
const model = require('../model');
const authentication = require('../middleware/jwt');
const parseTokenData = authentication.parseTokenData;
const { getCachedMetrics } = require('../utils/cached-metrics');

router.get('/legacy-api/alive', function(req, res, next) { // for health checks
    model.projects.getFirstProjectId(function(err, id) {
        if (err) {
            console.error('[legacy-api/alive]', err)
            return next(err);
        }
        res.status(200);
        res.json({ alive: true });
    });
});

router.get(['/', '/projects'], function(req, res) {
    res.redirect('/my-projects');
});

router.get(['/project/:projectUrl', '/project/:projectUrl/dashboard'], function(req, res) {
    res.redirect(`/p/${req.params.projectUrl}`);
});

router.get(['/project/:projectUrl/audiodata/uploads'], function(req, res) {
    res.redirect(`/p/${req.params.projectUrl}/import-recordings`);
});

router.get(['/project/:projectUrl/audiodata/sites'], function(req, res) {
    res.redirect(`/p/${req.params.projectUrl}/audiodata/sites`);
});

router.get(['/project/:projectUrl/audiodata/recordings'], function(req, res) {
    res.redirect(`/p/${req.params.projectUrl}/audiodata/recordings`);
});

router.get(['/project/:projectUrl/audiodata/species'], function(req, res) {
    res.redirect(`/p/${req.params.projectUrl}/audiodata/species`);
});

// router.get(['/project/:projectUrl/visualizer*'], function(req, res) {
//     const rest = req.params[0] || ''
//     res.redirect(`/p/${req.params.projectUrl}/visualizer${rest}`)
// });

router.get('/projects/:externalId', async (req, res) => {
    try {
        const project = await model.projects.find({external_id: req.params.externalId}).get(0);
        return res.redirect(`/p/${project.url}`);
    }
    catch (e) {
        return res.redirect('/');
    }
});

// Home page metrics
router.get('/legacy-api/projects-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'project-count': 'project-count' }, null, next);
});
router.get('/legacy-api/jobs-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'job-count': 'job-count' }, null, next);
});
router.get('/legacy-api/recordings-species-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'species-count': 'species-count' }, null, next);
});
router.get('/legacy-api/recordings-count', function(req, res, next) {
    res.type('json');
    getCachedMetrics(req, res, { 'recording-count': 'recording-count' }, null, next);
});

router.use('/', parseTokenData(), login);

router.use('/', acmeChallenge);

// Force login for routes after this
router.use(function(req, res, next) {
    if (!req.user) {
        if (req.session) {
            req.session.currentPath = req.protocol + '://' + req.get('host') + req.originalUrl;
        }
        return res.redirect('/legacy-login')
    }
    return next();
});

// Media asset proxy -- MUST stay below the "Force login" gate above.
// `GET /legacy-api/ingest/recordings/:attr` renders spectrograms/audio for an
// arbitrary stream+window and has no guard of its own; the session IS its
// authentication. Mounted here (not in non-session.js) since 2026-08-10 to
// close the f6240fd2 regression -- see app/routes/data-api/ingest-assets.js.
//
// 🔴 STILL REQUIRED AS OF 2026-08-11 -- DO NOT DELETE WITHOUT READING THIS.
// All four SERVER-side callers were migrated off it today (#99): the recordings
// thumbnail, the models + classifications strips and the template 302 now emit
// direct media-api urls carrying a per-window signed stream-token.
//
// The remaining consumer is the LEGACY ANGULARJS VISUALIZER, which builds these
// urls IN THE BROWSER -- assets/app/app/visualizer/visobjects/recording.js
// composes `/legacy-api/ingest/recordings/<streamId>_t<start>Z.<end>Z_...
// d1023.255.png` client-side. A browser has no STREAM_TOKEN_SALT and therefore
// cannot mint a token, so it CANNOT use the direct route: retiring this mount
// would leave the legacy visualizer with blank spectrograms. Verified live --
// the built bundle `public/includes/js/arbimon2.min.js` still contains that
// path, and it is served in production.
//
// Retiring this therefore requires one of: porting the legacy visualizer to
// server-minted tokens (as the SPA was in #1806), or confirming the legacy
// visualizer route is unreachable and removing it too.
router.use('/legacy-api/ingest', require('./data-api/ingest-assets'));

router.use('/legacy-api', dataApi);
router.use('/project', project);
router.use('/citizen-scientist', require('./citizen-scientist'));


module.exports = router;
