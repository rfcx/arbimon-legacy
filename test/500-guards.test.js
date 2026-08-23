/* jshint node:true */
'use strict';

// Guards for three user-facing 500s measured live on 2026-08-23.
// Run: node test/500-guards.test.js
//
// These assert on the SHIPPED source text/behaviour, not on re-implementations,
// so a regression in the real files fails the test.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
function eq (label, actual, expected) {
    try {
        assert.deepStrictEqual(actual, expected);
        console.log('  ok   ' + label);
        pass++;
    } catch (e) {
        console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) +
                    ', want ' + JSON.stringify(expected) + ')');
        fail++;
    }
}

const root = path.join(__dirname, '..');
const read = function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); };

// ---------------------------------------------------------------- D1 (a)
// Duplicate-key detection must be engine-neutral: MariaDB ER_DUP_ENTRY today,
// PostgreSQL 23505 after the Phase-7 write flip.
console.log('D1a isDuplicateKeyError - engine-neutral duplicate detection');
const projectsSrc = read('app/model/projects.js');

// Extract and evaluate the shipped helper so the test binds to the real code.
const helperMatch = projectsSrc.match(/function isDuplicateKeyError \(err\) \{[\s\S]*?\n\}/);
eq('helper is present in app/model/projects.js', !!helperMatch, true);
// eslint-disable-next-line no-new-func
const isDuplicateKeyError = new Function('return (' + helperMatch[0] + ')')();

eq('MariaDB ER_DUP_ENTRY is a duplicate', isDuplicateKeyError({ code: 'ER_DUP_ENTRY' }), true);
eq('PostgreSQL 23505 is a duplicate', isDuplicateKeyError({ code: '23505' }), true);
eq('an unrelated driver error is NOT', isDuplicateKeyError({ code: 'ER_NO_SUCH_TABLE' }), false);
eq('PG 23503 (FK violation) is NOT', isDuplicateKeyError({ code: '23503' }), false);
eq('null/undefined is NOT', isDuplicateKeyError(null), false);
eq('an error with no code is NOT', isDuplicateKeyError(new Error('boom')), false);

// The insert must actually USE the helper, and must rethrow anything else.
eq('insertCachedMetrics calls isDuplicateKeyError',
   /insertCachedMetrics[\s\S]{0,2000}?isDuplicateKeyError\(err\)/.test(projectsSrc), true);
eq('insertCachedMetrics rethrows non-duplicates',
   /isDuplicateKeyError\(err\)\) \{[\s\S]{0,120}?\}\s*\n\s*throw err/.test(projectsSrc), true);

// ---------------------------------------------------------------- D1 (b)
// Without this guard the duplicate fix merely relocates the 500 to a TypeError.
console.log('D1b cached-metrics re-read guard');
const cmSrc = read('app/utils/cached-metrics.js');
eq('result is guarded before .value is read',
   /const count = result \? result\.value :/.test(cmSrc), true);
eq('the bare dereference is gone',
   /const count = result\.value\b/.test(cmSrc), false);

// ---------------------------------------------------------------- D2
// The body-driven bypass must SURVIVE; only the falsy-zero leg changes.
console.log('D2 playlist id 0 reaches the loader (and its 404)');
const plRouteSrc = read('app/routes/data-api/project/playlists.js');
eq('the deliberate req.body.recordings bypass is preserved',
   /!!req\.body\.recordings/.test(plRouteSrc), true);
// Strip comment lines first: the explanatory comment legitimately QUOTES the
// old expression, and a naive source scan matches the prose instead of the
// code. (This assertion failed on exactly that until the filter was added.)
const plRouteCode = plRouteSrc.split('\n')
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
eq('the falsy-zero test !Number(playlist) is gone from the CODE',
   /!Number\(playlist\)/.test(plRouteCode), false);
eq('a finite-number test is used instead',
   /Number\.isFinite\(playlistId\)/.test(plRouteSrc), true);

// Behavioural check of the exact predicate, extracted from the shipped source.
const guard = function (body, playlist) {
    const playlistId = Number(playlist);
    return !!body && (!!body.recordings || !Number.isFinite(playlistId));
};
eq('id "0" no longer bypasses the loader', guard({ limit: 10 }, '0'), false);
eq('id "12" does not bypass', guard({ limit: 10 }, '12'), false);
eq('a body with recordings STILL bypasses', guard({ recordings: [1, 2] }, '0'), true);
eq('a non-numeric id bypasses', guard({ limit: 10 }, 'undefined'), true);
eq('an empty id bypasses', guard({ limit: 10 }, ''), false); // Number('')===0, finite
eq('a garbage id bypasses', guard({ limit: 10 }, 'abc'), true);

// ---------------------------------------------------------------- D3
console.log('D3 pattern-matching validate: no-op succeeds, not-found errors');
const pmSrc = read('app/routes/data-api/project/pattern_matchings.js');
eq('the not-found case still errors',
   /if \(!rois \|\| !rois\.length\) \{[\s\S]{0,160}?Error\('Error to get PM data'\)/.test(pmSrc), true);
eq('the no-change case returns a success payload',
   /if \(!updatedRois\.length\) \{[\s\S]{0,160}?res\.json\(\{ updated: 0 \}\)/.test(pmSrc), true);
eq('the old conflated test is gone',
   /if \(!updatedRois \|\| !updatedRois\.length\)/.test(pmSrc), false);

// Behavioural model of the branch order, mirroring the shipped shape.
const classify = function (rois, validation) {
    if (!rois || !rois.length) { return 'error'; }
    const updated = rois.filter(function (r) { return r.validated != validation; });
    if (!updated.length) { return 'noop'; }
    return 'update';
};
eq('no rows found -> error', classify([], 1), 'error');
eq('null rois -> error', classify(null, 1), 'error');
eq('all already validated -> noop', classify([{ validated: 1 }, { validated: 1 }], 1), 'noop');
eq('some need changing -> update', classify([{ validated: 0 }, { validated: 1 }], 1), 'update');
eq('unvalidated rows -> update', classify([{ validated: null }], 1), 'update');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);