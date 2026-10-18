/* jshint node:true */
'use strict';
// rfcx-local 2026-10-18 (OPEN-ITEMS §478 F-b). The AED form's 10,000-recordings guard reads
// `data.totalRecordings` from GET .../audio-event-detections-clustering/total-recordings. On PG an
// UNQUOTED alias is lowercased, so the route returned `{totalrecordings: N}` and the guard read
// undefined -> dead since the 09-12 flip. This drives the REAL model with dbpool stubbed and asserts
// (a) the alias reaches SQL text QUOTED (what PG preserves), (b) the project id is BOUND, and
// (c) the PG translator (app/utils/dbpool-pg.js) keeps the quoted alias intact.
// Run: node test/aed-total-recordings-alias.test.js     (exit 1 on any FAIL)
const path = require('path');
let pass = 0, fail = 0;
function ok (label, cond, detail) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label + (detail ? '\n       ' + detail : '')); fail++; } }
const ROOT = path.join(__dirname, '..');
function stub (rel, exportsObj) {
    const file = require.resolve(path.join(ROOT, rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}
const calls = [];
const q = require('q');
stub('app/utils/dbpool.js', {
    query: (sql, params) => { calls.push({ sql: String(sql), params }); return q.resolve([{ totalRecordings: 7 }]); },
    escape: (v) => JSON.stringify(v)
});
stub('app/model/dispatch-hint.js', { hint: () => {} });
const M = require(path.join(ROOT, 'app/model/audio-event-detections-clustering.js'));

(async () => {
    calls.length = 0;
    await M.getTotalRecInLast24Hours({ project_id: 10005 });
    const c = calls[0] || { sql: '', params: undefined };
    ok('alias is QUOTED in the SQL text ("totalRecordings")', /as "totalRecordings"/.test(c.sql), c.sql.slice(0, 120));
    ok('no unquoted alias survives (the lowercased-by-PG shape)', !/as totalRecordings\b/.test(c.sql));
    ok('project id is bound, not interpolated', Array.isArray(c.params) && c.params[0] === 10005 && /project_id=\?/.test(c.sql));
    ok('the 24h cutoff is bound too', Array.isArray(c.params) && typeof c.params[1] === 'number' && c.params.length === 2);

    // (c) the PG dialect translator must keep the quoted alias and still rewrite UNIX_TIMESTAMP
    let translated = null;
    try {
        const pg = require(path.join(ROOT, 'app/utils/dbpool-pg.js'));
        const fn = pg.translateSql || pg.translate || pg._translateForTest || (pg.__test && pg.__test.translate);
        if (typeof fn === 'function') translated = fn(c.sql);
    } catch (e) { translated = null; }
    if (translated === null) {
        // fall back to the file's own regex pair, byte-for-byte (dbpool-pg.js:585-586), so the test cannot go vacuous
        const src = require('fs').readFileSync(path.join(ROOT, 'app/utils/dbpool-pg.js'), 'utf8');
        ok('translator still owns the UNIX_TIMESTAMP rewrite (source carries the regex)', /UNIX_TIMESTAMP\\s\*\\\(\\s\*\(\[\^\(\)\]\+\?\)\\s\*\\\)/.test(src));
        translated = c.sql.replace(/\bUNIX_TIMESTAMP\s*\(\s*([^()]+?)\s*\)/gi, 'EXTRACT(EPOCH FROM $1)');
    }
    ok('after translation the quoted alias is intact', /as "totalRecordings"/.test(translated), translated.slice(0, 160));
    ok('after translation UNIX_TIMESTAMP is gone', !/UNIX_TIMESTAMP/.test(translated));

    console.log(`${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL harness', e); process.exit(1); });