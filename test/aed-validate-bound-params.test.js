/* jshint node:true */
'use strict';
// rfcx-local 2026-09-28 (finding F1 of the #1981 sandbox E2E): AED /unvalidate always 500'd on PG
// because validateDetections() INTERPOLATED its values and the route passed three of four, so the
// statement read `validated = undefined` (PG 42703). This drives the REAL model file with dbpool
// stubbed and asserts (a) no `undefined` ever reaches SQL text, (b) values are bound, (c) the
// un-validate call clears all three columns, (d) an empty id list does not emit `IN ()`.
// Run: node test/aed-validate-bound-params.test.js     (exit 1 on any FAIL)
const path = require('path');
const fs = require('fs');

let pass = 0, fail = 0;
function ok (label, cond) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label); fail++; } }
const ROOT = path.join(__dirname, '..');
function stub (rel, exportsObj) {
    const file = require.resolve(path.join(ROOT, rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}

const calls = [];
stub('app/utils/dbpool.js', {
    query: (sql, params) => { calls.push({ sql: String(sql), params: params }); return Promise.resolve({ affectedRows: 1 }); },
    escape: (v) => JSON.stringify(v)
});
stub('app/model/dispatch-hint.js', { hint: () => {} });

const M = require(path.join(ROOT, 'app/model/audio-event-detections-clustering.js'));

(async () => {
    // 1. the un-validate shape AS THE ROUTE CALLS IT (read from the route source, not assumed)
    const routeSrc = fs.readFileSync(path.join(ROOT, 'app/routes/data-api/project/audio-event-detections-clustering.js'), 'utf8');
    const m = routeSrc.match(/validateDetections\(\[d\],\s*null,\s*null(,\s*null)?\)/);
    ok('route: /unvalidate clears with an explicit 4th argument (validated = null)', !!(m && m[1]));

    calls.length = 0;
    await M.validateDetections([900200611], null, null);          // the historical 3-arg call
    const c1 = calls[0] || { sql: '', params: [] };
    ok('3-arg call: SQL text has no "undefined"', !/undefined/.test(c1.sql));
    ok('3-arg call: values are bound (placeholders, not literals)', /validated = \?/.test(c1.sql) && /IN \(\?\)/.test(c1.sql));
    ok('3-arg call: validated binds NULL (not undefined)', Array.isArray(c1.params) && c1.params[2] === null);

    calls.length = 0;
    await M.validateDetections([900200611], null, null, null);   // the fixed route call
    const c2 = calls[0] || { sql: '', params: [] };
    ok('clear: species/songtype/validated all NULL, ids bound', JSON.stringify(c2.params) === JSON.stringify([null, null, null, [900200611]]));

    calls.length = 0;
    await M.validateDetections([1, 2], 3126, 1, 0);               // the /validate positive path
    const c3 = calls[0] || { sql: '', params: [] };
    ok('validate: values bound in order', JSON.stringify(c3.params) === JSON.stringify([3126, 1, 0, [1, 2]]));

    calls.length = 0;
    await M.validateDetections(["1) OR (1=1"], 3126, 1, 1);       // an unconverted id can no longer shape SQL
    const c4 = calls[0] || { sql: '', params: [] };
    ok('ids never interpolated into SQL text', !/1=1/.test(c4.sql));

    calls.length = 0;
    const r = await M.validateDetections([], null, null, null);
    ok('empty id list: no statement emitted (no `IN ()`)', calls.length === 0 && r && r.affectedRows === 0);

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });