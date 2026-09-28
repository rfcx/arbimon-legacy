/* jshint node:true */
'use strict';
// /project/<slug>/visualizer[/...] -> /p/<slug>/visualizer[/...] (302), path AND query
// preserved (rfcx-local 2026-09-28). Cases = the URL shapes measured in 7 days of prod
// logs: /rec/N, /rec/N/, bare, /playlist/N/N, /rec/site/N/last, and the
// gain / a / filter / clusters / utm_* query keys.
// Run: node test/visualizer-redirect-spa.test.js
//
// Two layers: (1) the pure target builder; (2) the REAL express route pattern from
// app/routes/index.js (extracted from source, mounted on a bare express app) to prove
// which paths the pattern catches and which it leaves alone.
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const spaVisualizerUrl = require('../app/utils/spa-visualizer-url');

let pass = 0, fail = 0;
function ok (label, cond) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label); fail++; } }

// (2) the route pattern, read from the real file so a drift fails this test
const src = fs.readFileSync(path.join(__dirname, '..', 'app/routes/index.js'), 'utf8');
const m = /router\.get\((\[[^\]]*visualizer[^\]]*\])\s*,\s*function\s*\(req,\s*res\)\s*\{\s*res\.redirect\(302,\s*spaVisualizerUrl\(req\.params\.projectUrl,\s*req\.params\[0\],\s*req\.originalUrl\)\);/.exec(src);
ok('route registration found in app/routes/index.js', !!m);
const patterns = m ? JSON.parse(m[1].replace(/'/g, '"')) : [];
const app = express();
app.get(patterns, (req, res) => res.redirect(302, spaVisualizerUrl(req.params.projectUrl, req.params[0], req.originalUrl)));
app.use((req, res) => res.status(418).end());

function get (url) {
    return new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: server.address().port, path: url }, res => {
            res.resume(); resolve({ status: res.statusCode, location: res.headers.location });
        }).on('error', reject);
    });
}
const cases = [
    ['/project/destinos-awake/visualizer/rec/43936418', '/p/destinos-awake/visualizer/rec/43936418'],
    ['/project/destinos-awake/visualizer/rec/43936418/', '/p/destinos-awake/visualizer/rec/43936418'],
    ['/project/sounds-of-recovery/visualizer/rec/220351255?gain=10', '/p/sounds-of-recovery/visualizer/rec/220351255?gain=10'],
    ['/project/x/visualizer/rec/7?a=box,1,1000,3,5000&filter=1', '/p/x/visualizer/rec/7?a=box,1,1000,3,5000&filter=1'],
    ['/project/x/visualizer/playlist/12/34', '/p/x/visualizer/playlist/12/34'],
    ['/project/x/visualizer/playlist/0?clusters', '/p/x/visualizer/playlist/0?clusters'],
    ['/project/x/visualizer/rec/site/88151/last', '/p/x/visualizer/rec/site/88151/last'],
    ['/project/x/visualizer', '/p/x/visualizer'],
    ['/project/x/visualizer/', '/p/x/visualizer'],
    ['/project/x/visualizer?utm_source=mail&utm_campaign=y', '/p/x/visualizer?utm_source=mail&utm_campaign=y']
];
const server = app.listen(0, '127.0.0.1', async () => {
    try {
        for (const [from, to] of cases) {
            const r = await get(from);
            ok(`${from} -> 302 ${to} (got ${r.status} ${r.location})`, r.status === 302 && r.location === to);
        }
        ok('non-visualizer /project/ paths are NOT caught', (await get('/project/x/audiodata/playlists')).status === 418);
        ok('a lookalike segment (/visualizer-legacy) is NOT caught', (await get('/project/x/visualizer-legacy')).status === 418);
        ok('the bare project page is NOT caught', (await get('/project/x/')).status === 418);
    } catch (e) { console.error(e); fail++; }
    server.close();
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail === 0 ? 0 : 1);
});
setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 15000).unref();