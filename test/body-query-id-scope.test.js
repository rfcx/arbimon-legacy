/* jshint node:true */
'use strict';
// Body/query-id audit (rfcx-local 2026-09-28): ids arriving in req.body / req.query
// must be bound to the URL's project. Exercises the REAL route files on a bare
// express app; the model + project-scope modules are stubbed in require.cache.
// Run: node test/body-query-id-scope.test.js
const path = require('path');
const http = require('http');
const express = require('express');

let pass = 0, fail = 0;
function ok (label, cond) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label); fail++; } }
const ROOT = path.join(__dirname, '..');
function stub (rel, exportsObj) {
    const file = require.resolve(path.join(ROOT, rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}

// World: project 7 (the URL project) owns site 71, playlist 72, training set 73,
// recording 74, aed 75. Project 9 (foreign, PRIVATE) owns site 91, playlist 92,
// training set 93, recording 94, aed 95. Site 81 belongs to 9 but is IMPORTED into 7.
const OWN = { site: [71, 81], playlist: [72], training_set: [73], recording: [74], aed: [75], template: [76] };
const calls = [];
const scope = {
    ownedByProject: (k, id, pid) => Promise.resolve(pid === 7 && (OWN[k] || []).includes(Number(id))),
    allOwnedByProject: (k, ids, pid) => {
        const l = ids === undefined || ids === null ? [] : [].concat(ids);
        return Promise.resolve(l.length > 0 && l.every(id => pid === 7 && (OWN[k] || []).includes(Number(id))));
    }
};
const sitesRows = { 71: { site_id: 71, project_id: 7 }, 81: { site_id: 81, project_id: 9 }, 91: { site_id: 91, project_id: 9 } };
const model = {
    projects: {
        // callback OR promise, like the real model (the OLD handler used the callback form)
        findById: (id, cb) => {
            const row = { 8869: { project_id: 8869, name: 'Priv', url: 'priv', is_private: 1, external_id: 'x' },
                          5: { project_id: 5, name: 'Pub', url: 'pub', is_private: 0, external_id: 'y' } }[Number(id)];
            if (cb) { cb(null, row); }
            return Promise.resolve(row);
        },
        // the index.js router.param('projectUrl') loader
        find: (q, cb) => cb(null, q.url === 'p7' ? [{ project_id: 7, url: 'p7', external_id: 'e7', is_private: 0 }] : []),
        getProjectClassesAsync: () => Promise.resolve([{ id: 1 }]),
        insertNews: () => {}, updateProjectLocation: () => {}
    },
    users: {
        getPermissions: (uid, pid, cb) => {
            const rows = pid === 7 ? [{ name: 'view project' }, { name: 'manage project settings' }]
                : pid === 11 ? [{ name: 'view project' }, { name: 'manage training sets' }] : [];
            return cb ? cb(null, rows) : Promise.resolve(rows);
        }
    },
    recordings: { countProjectRecordings: (p) => { calls.push(['searchcount', p.project_id]); return Promise.resolve([]); } },
    playlists: {
        rename: (b, cb) => { calls.push(['rename', b.project]); cb(null, {}); },
        remove: (ids, pid, cb) => { calls.push(['remove', pid]); cb(null, {}); },
        find: (q, o, cb) => (cb || o)(null, []), fetchData: (a, b, cb) => cb(null, [])
    },
    sites: {
        findById: (id, cb) => cb(null, sitesRows[id] ? [sitesRows[id]] : []),
        find: (q, cb) => cb(null, []),
        removeSite: (ids, pid) => { calls.push(['removeSite', ids]); return Promise.resolve(); },
        updateSite: (site) => { calls.push(['updateSite', site.site_id || site.id]); return Promise.resolve(); }
    },
    trainingSets: {
        find: (q, cb) => cb(null, (q.id && OWN.training_set.includes(Number(q.id)) && q.project === 7) ? [{ id: Number(q.id), project: 7 }] : []),
        shareTrainingSet: (o) => { calls.push(['share', o.trainingSetId, o.projectId]); return Promise.resolve(); },
        addData: (ts, body, cb) => { calls.push(['addData', body.recording]); cb(null, {}); }
    },
    AudioEventDetectionsClustering: {
        requestNewAudioEventDetectionClusteringJob: (d) => { calls.push(['aedNew', d.playlist_id]); return Promise.resolve({}); },
        getDetectionsByIds: () => Promise.resolve([{ recording_id: 1 }]),
        validateDetections: (ids) => { calls.push(['aedValidate', ids]); return Promise.resolve(); },
        updatePresentAedCount: () => Promise.resolve()
    },
    patternMatchings: { requestNewPatternMatchingJob: (d) => { calls.push(['pmNew', d.playlist, d.template]); return Promise.resolve({}); } },
    templates: { insert: (o) => { calls.push(['tplInsert', o.recording]); return Promise.resolve({ id: 1 }); } }
};
stub('app/model', model);
stub('app/utils/project-scope', scope);
stub('app/utils/cached-metrics', { getMetrics: (req, res, key, p) => { calls.push(['metric', p]); res.json(0); }, getCachedMetrics: (req, res) => res.json(0) });

function mount (rel, base, perms) {
    const r = require('../' + rel);
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.project = { project_id: 7, url: 'p7', external_id: 'e7' };
        req.session = { user: { id: 10, isSuper: 0, permissions: {} } };
        req.haveAccess = (pid, perm) => pid === 7 && (perms === 'all' || (perms || []).includes(perm));
        req.headers.authorization = 'Bearer t';
        next();
    });
    app.use(base, r);
    app.use((err, req, res, next) => res.status(err.status || 500).json({ error: String(err.message) }));
    return app;
}
function call (app, method, url, body) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const data = body ? JSON.stringify(body) : '';
            const r = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method, headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {} }, res => {
                let b = ''; res.on('data', d => { b += d; }); res.on('end', () => { server.close(); resolve({ s: res.statusCode, b }); });
            });
            r.setTimeout(3000, () => { r.destroy(); server.close(); resolve({ s: 0, b: 'HANG' }); });
            r.on('error', e => { server.close(); resolve({ s: 0, b: String(e) }); }); r.end(data);
        });
    });
}
const last = kind => calls.filter(c => c[0] === kind).pop();

(async () => {
    const idx = mount('app/routes/data-api/project/index', '/', 'all');
    console.log('R1 info/source-project');
    let r = await call(idx, 'GET', '/p7/info/source-project?project_id=8869');
    ok('private project the user cannot view -> 404 (was the full row)', r.s === 404);
    r = await call(idx, 'GET', '/p7/info/source-project?project_id=5');
    ok('public project -> 200 with ONLY {project_id,name,url}', r.s === 200 && JSON.stringify(Object.keys(JSON.parse(r.b)).sort()) === '["name","project_id","url"]');

    console.log('R2 dashboard metrics');
    calls.length = 0;
    await call(idx, 'GET', '/p7/site-count?project_id=8869');
    ok('site-count ignores ?project_id (uses the URL project)', (last('metric') || [])[1] === 7);
    await call(idx, 'GET', '/p7/soundscape-job-count?project_id=8869');
    ok('soundscape-job-count ignores ?project_id', (last('metric') || [])[1] === 7);

    console.log('R3 recordings/search-count');
    const rec = mount('app/routes/data-api/project/recordings', '/', 'all');
    await call(rec, 'GET', '/search-count?project_id=8869');
    ok('search-count ignores ?project_id', (last('searchcount') || [])[1] === 7);

    console.log('W3/W4 playlists');
    const pl = mount('app/routes/data-api/project/playlists', '/', ['manage playlists']);
    await call(pl, 'POST', '/rename', { id: 92, name: 'x' });
    ok('rename passes the URL project to the model', (last('rename') || [])[1] === 7);
    await call(pl, 'POST', '/delete', { playlists: [92] });
    ok('delete passes the URL project to the model', (last('remove') || [])[1] === 7);

    console.log('W1/W2 sites');
    const st = mount('app/routes/data-api/project/sites', '/', ['delete site', 'manage project sites']);
    calls.length = 0;
    r = await call(st, 'POST', '/delete', { sites: [91] });
    ok('delete a FOREIGN site -> 404, removeSite never called', r.s === 404 && !last('removeSite'));
    r = await call(st, 'POST', '/delete', { sites: [71, 91] });
    ok('one foreign id among own -> 404 (all-or-nothing)', r.s === 404 && !last('removeSite'));
    r = await call(st, 'POST', '/delete', { sites: [71, 81] });
    ok('own + imported sites -> removeSite called', r.s === 200 && !!last('removeSite'));
    r = await call(st, 'POST', '/update', { site: { id: 91, name: 'x' } });
    ok('update a FOREIGN site -> 404, updateSite never called', r.s === 404 && !last('updateSite'));
    r = await call(st, 'POST', '/update', { site: { id: 81, name: 'x' } });
    ok('update an IMPORTED (not own) site -> 404', r.s === 404 && !last('updateSite'));
    r = await call(st, 'POST', '/update', { site: { id: 71, name: 'x' } });
    ok('update own site -> 200', r.s === 200 && (last('updateSite') || [])[1] === 71);

    console.log('W5/R5 training sets');
    const ts = mount('app/routes/data-api/project/training_sets', '/', ['manage training sets']);
    calls.length = 0;
    r = await call(ts, 'POST', '/share', { projectIdTo: 11, trainingSetId: 93, trainingSetName: 'n' });
    ok('share a FOREIGN training set -> 404', r.s === 404 && !last('share'));
    r = await call(ts, 'POST', '/share', { projectIdTo: 12, trainingSetId: 73, trainingSetName: 'n' });
    ok('share own set into a project the user cannot manage -> 403', r.s === 403 && !last('share'));
    r = await call(ts, 'POST', '/share', { projectIdTo: 11, trainingSetId: 73, trainingSetName: 'n' });
    ok('share own set into a managed project -> 201', r.s === 201 && (last('share') || [])[2] === 11);
    r = await call(ts, 'POST', '/add-data/73', { recording: 94 });
    ok('add-data with a FOREIGN recording -> 404', r.s === 404 && !last('addData'));
    r = await call(ts, 'POST', '/add-data/73', { recording: 74 });
    ok('add-data with an own recording -> 200', r.s === 200 && (last('addData') || [])[1] === 74);

    console.log('W6/W7 AED clustering');
    const aedNoPerm = mount('app/routes/data-api/project/audio-event-detections-clustering', '/', []);
    r = await call(aedNoPerm, 'POST', '/validate', { aed: [75], validated: '1' });
    ok('/validate without the manage permission -> 403 (had NO check)', r.s === 403);
    const aed = mount('app/routes/data-api/project/audio-event-detections-clustering', '/', ['manage AED and Clustering job']);
    calls.length = 0;
    r = await call(aed, 'POST', '/validate', { aed: [95], validated: '1' });
    ok('/validate a FOREIGN aed -> 404, nothing updated', r.s === 404 && !last('aedValidate'));
    r = await call(aed, 'POST', '/validate', { aed: [75], validated: '1' });
    ok('/validate own aed -> 200', r.s === 200 && !!last('aedValidate'));
    r = await call(aed, 'POST', '/new', { playlist_id: 92, name: 'x', params: {} });
    ok('/new over a FOREIGN playlist -> 404', r.s === 404 && !last('aedNew'));
    r = await call(aed, 'POST', '/new', { playlist_id: 72, name: 'x', params: {} });
    ok('/new over own playlist -> 200', r.s === 200 && (last('aedNew') || [])[1] === 72);

    console.log('W8 pattern matching new');
    const pm = mount('app/routes/data-api/project/pattern_matchings', '/', ['manage pattern matchings']);
    calls.length = 0;
    r = await call(pm, 'POST', '/new', { playlist: 92, template: 76, name: 'x', params: {} });
    ok('PM /new over a FOREIGN playlist -> 404, no job', r.s === 404 && !last('pmNew'));
    r = await call(pm, 'POST', '/new', { playlist: 72, template: 999, name: 'x', params: {} });
    ok('PM /new with a foreign private template -> 404', r.s === 404 && !last('pmNew'));
    r = await call(pm, 'POST', '/new', { playlist: 72, template: 76, name: 'x', params: {} });
    ok('PM /new own playlist + template -> 200', r.s === 200 && !!last('pmNew'));

    console.log('R4 templates/add');
    const tp = mount('app/routes/data-api/project/templates', '/', 'all');
    calls.length = 0;
    r = await call(tp, 'POST', '/add', { name: 't', recording: 94, species: 1, songtype: 1, roi: { x1: 0, y1: 0, x2: 1, y2: 1 } });
    ok('template ORIGINAL on a FOREIGN recording -> 404', r.s === 404 && !last('tplInsert'));
    r = await call(tp, 'POST', '/add', { name: 't', recording: 74, species: 1, songtype: 1, roi: { x1: 0, y1: 0, x2: 1, y2: 1 } });
    ok('template on an own recording -> 200', r.s === 200 && (last('tplInsert') || [])[1] === 74);
    r = await call(tp, 'POST', '/add', { name: 't', recording: 94, species: 1, songtype: 1, source_project_id: 9, roi: { x1: 0, y1: 0, x2: 1, y2: 1 } });
    ok('public-template COPY (source_project_id) keeps its source recording -> 200', r.s === 200);

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 120000).unref();