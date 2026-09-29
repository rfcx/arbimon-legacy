/* jshint node:true */
'use strict';
// rfcx-local 2026-09-28 (finding F2 of the #1981 sandbox E2E): AED /validate and PM /:id/validate added the
// project class fire-and-forget, with `if(err) return next(err)` in the callback. When the class add failed
// (unknown species/songtype name, missing names, DB error) next(err) ran AFTER the success response ->
// ERR_HTTP_HEADERS_SENT / a torn response (seen as a Cloudflare 520). This drives the REAL route files with
// insertClass REJECTING, and asserts: exactly ONE response, it is the success response, the validation
// write still happened, and no ERR_HTTP_HEADERS_SENT reached the error handler. Controls: insertClass
// resolving (normal path) must behave the same.
// Run: node test/validate-class-add-single-response.test.js   (exit 1 on any FAIL, 2 on harness error)
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

let classMode = 'reject';            // 'reject' | 'resolve'
const calls = [];
const insertClass = (pc, cb) => {
    calls.push(['insertClass', pc.species]);
    // Mirror the real model: a q/promise chain ending in .nodeify(callback) -- settles on a LATER tick,
    // which is what let the old callback fire after the response.
    const p = new Promise((resolve, reject) => setTimeout(() => classMode === 'reject'
        ? reject(new Error("species '" + pc.species + "' not in system"))
        : resolve({ class: 1, species: 3126, songtype: 1 }), 15));
    if (cb) { p.then(r => cb(null, r), e => cb(e)); }
    return p;
};
const model = {
    projects: {
        getProjectClassesAsync: () => Promise.resolve([]),       // class NOT in project -> the add path runs
        insertClass: insertClass,
        insertNews: () => { calls.push(['news']); }
    },
    AudioEventDetectionsClustering: {
        getDetectionsByIds: () => Promise.resolve([{ recording_id: 1, species_id: 3126, songtype_id: 1 }]),
        validateDetections: (ids) => { calls.push(['aedValidate', ids]); return Promise.resolve(); },
        updatePresentAedCount: () => Promise.resolve()
    },
    recordings: {
        getRecordingValidation: () => Promise.resolve([{}]),
        addRecordingValidation: () => Promise.resolve(),
        validate: () => { calls.push(['recValidate']); return Promise.resolve(); }
    },
    patternMatchings: {
        getRoi: () => Promise.resolve([{ pattern_matching_roi_id: 5, validated: null, species_id: 3126, songtype_id: 1, recording_id: 1 }]),
        validateRois: () => { calls.push(['pmValidate']); return Promise.resolve([]); }
    }
};
stub('app/model', model);
stub('app/utils/project-scope', {
    ownedByProject: () => Promise.resolve(true),
    allOwnedByProject: () => Promise.resolve(true)
});

const handlerErrors = [];
function mount (rel) {
    const r = require('../' + rel);
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.project = { project_id: 7, url: 'p7' };
        req.session = { user: { id: 10 } };
        req.haveAccess = () => true;
        next();
    });
    app.use('/', r);
    app.use((err, req, res, next) => {
        handlerErrors.push(String(err && (err.code || err.message)));
        if (res.headersSent) { return; }
        res.status(500).json({ error: String(err.message) });
    });
    return app;
}
// Count what actually reaches the socket: status line + how many times the handler tried to write headers.
function call (app, url, body) {
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const data = JSON.stringify(body);
            const r = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method: 'POST',
                headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => {
                let b = ''; res.on('data', d => { b += d; });
                res.on('end', () => { setTimeout(() => { server.close(); resolve({ s: res.statusCode, b }); }, 60); });
            });
            r.setTimeout(3000, () => { r.destroy(); server.close(); resolve({ s: 0, b: 'HANG' }); });
            r.on('error', e => { server.close(); resolve({ s: 0, b: String(e) }); }); r.end(data);
        });
    });
}
const unhandled = [];
process.on('unhandledRejection', e => unhandled.push(String(e && (e.code || e.message))));

(async () => {
    const aed = mount('app/routes/data-api/project/audio-event-detections-clustering');
    const pm = mount('app/routes/data-api/project/pattern_matchings');
    const AED_BODY = { aed: [1], validated: 1, species_id: 3126, songtype_id: 1, species_name: 'Nope nope', songtype_name: 'Common Song' };
    const PM_BODY = { rois: [5], validation: 1, cls: { species: 'Nope nope', songtype: 'Common Song' } };

    for (const mode of ['reject', 'resolve']) {
        classMode = mode;
        console.log('AED /validate, class add ' + mode);
        calls.length = 0; handlerErrors.length = 0; unhandled.length = 0;
        let r = await call(aed, '/validate', AED_BODY);
        ok('responds 200 once', r.s === 200);
        ok('class add was attempted', calls.some(c => c[0] === 'insertClass'));
        ok('validation write happened', calls.some(c => c[0] === 'aedValidate'));
        ok('no error reached the handler (no next(err) after the response)', handlerErrors.length === 0);
        ok('no unhandled rejection', unhandled.length === 0);

        console.log('PM /:id/validate, class add ' + mode);
        calls.length = 0; handlerErrors.length = 0; unhandled.length = 0;
        r = await call(pm, '/9/validate', PM_BODY);
        ok('responds 200 once', r.s === 200);
        ok('class add was attempted', calls.some(c => c[0] === 'insertClass'));
        ok('validation write happened', calls.some(c => c[0] === 'pmValidate'));
        ok('no error reached the handler', handlerErrors.length === 0);
        ok('news only when the class was really added', calls.some(c => c[0] === 'news') === (mode === 'resolve'));
    }
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });