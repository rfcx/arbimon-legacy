/* jshint node:true */
'use strict';
// POST /legacy-api/project/<p>/playlists/:playlist with body.recordings must only
// return recordings OWNED by <p> (rfcx-local 2026-09-28; §391 class). Before the
// fix, a member of any project got 200 + full metadata for a recording in a
// PRIVATE project they do not belong to (measured on prod).
// Run: node test/playlist-body-recordings-scope.test.js
//
// Exercises the REAL route handler via an express app, with the model and the
// project-scope module stubbed in require.cache.
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

const OWNED = new Set([101, 102]);           // recordings of project 7
const fetched = [];
stub('app/model', {
    playlists: {
        find: (q, o, cb) => cb(null, Number(q.id) === 55 ? [{ id: 55, project_id: 7 }] : []),
        fetchData: (pl, body, cb) => { fetched.push(body.recordings || 'playlist:' + (pl && pl.id)); cb(null, [{ ok: true }]); }
    }
});
stub('app/utils/project-scope', {
    ownedByProject: (kind, id, pid) => Promise.resolve(kind === 'recording' && pid === 7 && OWNED.has(Number(id)))
});
const router = require('../app/routes/data-api/project/playlists');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.project = { project_id: 7 }; req.haveAccess = () => true; next(); });
app.use('/pl', router);

function post (url, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const r = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => {
            let b = ''; res.on('data', d => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b }));
        });
        r.on('error', reject); r.end(data);
    });
}
const server = app.listen(0, '127.0.0.1', async () => {
    try {
        let r = await post('/pl/0', { recordings: [101, 102], show: 'thumbnail-path' });
        ok('owned ids (temp clustering playlist 0) -> 200', r.status === 200);
        r = await post('/pl/0', { recordings: [999] });
        ok('a FOREIGN id -> 404', r.status === 404);
        r = await post('/pl/0', { recordings: [101, 999] });
        ok('one foreign id among owned ones -> 404 (all-or-nothing)', r.status === 404);
        r = await post('/pl/0', { recordings: 999 });
        ok('scalar foreign id -> 404', r.status === 404);
        r = await post('/pl/0', { recordings: 'abc' });
        ok('non-numeric id -> 404 (fails closed)', r.status === 404);
        ok('model never fetched a foreign id', !fetched.some(x => Array.isArray(x) ? x.includes(999) : x === 999));
        r = await post('/pl/55', { offset: 0, limit: 10 });
        ok('a normal saved playlist (no body.recordings) still -> 200', r.status === 200);
        r = await post('/pl/56', { offset: 0, limit: 10 });
        ok('an unknown playlist still -> 404 (loader unchanged)', r.status === 404);
    } catch (e) { console.error(e); fail++; }
    server.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail === 0 ? 0 : 1);
});