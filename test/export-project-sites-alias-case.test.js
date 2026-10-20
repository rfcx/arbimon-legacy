/* jshint node:true */
'use strict';
// rfcx-local 2026-10-20 (alias sweep; FINDING-2026-10-19-legacy-camelcase-aliases-on-pg).
// GET /legacy-api/project/:slug/sites-export.csv streams projects.exportProjectSites() through
// dbpool.streamQuery, i.e. the CONN-scoped PG path. That path returns PG's own column names; only the
// dbpool.query read route rebuilds MySQL key casing (dbpool-pg.js restoreRowCase). PG lowercases an
// unquoted alias, so `as Timezone` came back as `timezone`: the CSV header went lowercase and the route's
// `data.Timezone` read undefined (so "Deployed"/"Updated" rendered in UTC, not the site's zone).
// This drives the REAL model with dbpool stubbed and asserts every mixed-case alias reaches PG QUOTED,
// after the REAL translator, so the key PG returns is the one the route and the CSV header use.
// Run: node test/export-project-sites-alias-case.test.js     (exit 1 on any FAIL)
const path = require('path');
let pass = 0, fail = 0;
function ok (label, cond, detail) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label + (detail ? '\n       ' + detail : '')); fail++; } }
const ROOT = path.join(__dirname, '..');
process.env.PG_SHADOW_USER = process.env.PG_SHADOW_USER || 'test';   // dbpool-pg refuses to load without it; no pool is opened
function stub (rel, exportsObj) {
    const file = require.resolve(path.join(ROOT, rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}
const calls = [];
const q = require('q');
stub('app/utils/dbpool.js', {
    streamQuery: (sql, params) => { calls.push({ entry: 'streamQuery', sql: String(sql && sql.sql || sql), params }); return q.resolve([null, []]); },
    query: (sql, params) => { calls.push({ entry: 'query', sql: String(sql), params }); return q.resolve([]); },
    escape: (v) => JSON.stringify(v)
});
const Projects = require(path.join(ROOT, 'app/model/projects.js'));
const pg = require(path.join(ROOT, 'app/utils/dbpool-pg.js'));
const WANT = ['Id', 'Name', 'Latitude', 'Longitude', 'Altitude', 'Timezone', 'Recordings_Count'];

(async () => {
    await Projects.exportProjectSites(10005);
    const c = calls[0] || { entry: '', sql: '' };
    ok('runs on streamQuery (the conn path that does NOT restore key casing)', c.entry === 'streamQuery', c.entry);
    ok('project id is bound (3 placeholders)', Array.isArray(c.params) && c.params.length === 3 && c.params.every((v) => v === 10005));
    const translated = pg.translate(c.sql);
    for (const k of WANT) {
        ok('PG sees alias "' + k + '" quoted (key survives as ' + k + ')', new RegExp('as\\s+"' + k + '"', 'i').test(translated), translated.replace(/\s+/g, ' ').slice(0, 200));
    }
    // and nothing mixed-case is left bare (the class rule, not just today's list)
    const bare = [...translated.matchAll(/\bas\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi)].map((m) => m[1]).filter((a) => a !== a.toLowerCase());
    ok('no bare mixed-case alias survives translation', bare.length === 0, 'bare: ' + bare.join(','));
    // the route reads data.Timezone / data.external_id / data.updated_at
    const routeSrc = require('fs').readFileSync(path.join(ROOT, 'app/routes/data-api/project/index.js'), 'utf8');
    ok('route still reads data.Timezone (the consumer this protects)', /data\.Timezone/.test(routeSrc));
    console.log(`${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();