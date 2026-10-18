/* jshint node:true */
'use strict';
// rfcx-local 2026-10-18 (OPEN-ITEMS §478 F-a). config/hosts.json `bioApi` pointed at
// biodiversity-api.apps-prod.svc.cluster.local — a Service renamed to arbimon-api on 2026-09-22 (§374) —
// so tiering.assertJobRecordingLimit's entitlement lookup got ENOTFOUND and FAILED OPEN on every create
// route for 26 days (the free-tier per-job recording cap was not enforced). This asserts
// (a) the configured host is the LIVE Service name, (b) the model reads config('hosts').bioApi (so the
// file is what it consumes), and (c) the entitlement URL is built from it. Pure static + stubbed; no network.
// Run: node test/tiering-bioapi-host.test.js     (exit 1 on any FAIL)
const path = require('path');
const fs = require('fs');
let pass = 0, fail = 0;
function ok (label, cond, detail) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label + (detail ? '\n       ' + detail : '')); fail++; } }
const ROOT = path.join(__dirname, '..');

const hosts = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/hosts.json'), 'utf8'));
ok('hosts.bioApi is the LIVE arbimon-api Service (renamed from biodiversity-api 2026-09-22)', hosts.bioApi === 'http://arbimon-api.apps-prod.svc.cluster.local', hosts.bioApi);
ok('hosts.bioApi does not name the retired Service', !/biodiversity-api/.test(hosts.bioApi || ''));
ok('the other hosts keys are untouched (jobqueue, publicUrl, support)', hosts.jobqueue === 'http://10.0.0.4:3007' && hosts.publicUrl === 'https://arbimon.org' && typeof hosts.support === 'string');

const tiering = fs.readFileSync(path.join(ROOT, 'app/model/tiering.js'), 'utf8');
ok('tiering.js reads config(\'hosts\').bioApi (the file is what it consumes)', /config\('hosts'\)\.bioApi/.test(tiering));
ok('tiering.js builds /projects/<slug>/entitlement-summary from it', /entitlement-summary/.test(tiering));
ok('the consumer count is exactly one (grep app/ for bioApi) — no second stale copy', (() => {
    let n = 0;
    (function walk (d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) { if (f !== 'node_modules') walk(p); } else if (/\.js$/.test(f) && /bioApi/.test(fs.readFileSync(p, 'utf8'))) n++; } })(path.join(ROOT, 'app'));
    return n === 1;
})());

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);