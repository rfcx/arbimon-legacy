/* jshint node:true */
'use strict';

// Guard for app/utils/soundscape-objects.js (2026-09-25, operator goifirr 22:12 #3 /
// 23:32 step 1): soundscape objects move from arbimon2/project_<pid>/soundscapes/<sid>/
// to arbimon-soundscapes/<sid>/. Readers: NEW first, OLD on a miss; errors other than
// "missing" are NOT masked; delete removes BOTH layouts (+ the legacy image.png key).
// Run: node test/soundscape-objects.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function eq (label, actual, expected) {
    try { assert.deepStrictEqual(actual, expected); console.log('  ok   ' + label); pass++; }
    catch (e) { console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')'); fail++; }
}

const root = path.join(__dirname, '..');
process.chdir(root);
process.env.AWS_BUCKETNAME = 'arbimon2';
delete process.env.SOUNDSCAPES_BUCKETNAME;
const so = require(path.join(root, 'app/utils/soundscape-objects.js'));

// a fake S3 recording every call; `store` = {bucket: {key: body}}
function fakeS3 (store, failWith) {
    const calls = [];
    return {
        calls,
        getObject (p, cb) {
            calls.push(['get', p.Bucket, p.Key]);
            if (failWith && failWith[p.Bucket]) return cb(failWith[p.Bucket]);
            const b = store[p.Bucket] && store[p.Bucket][p.Key];
            if (b === undefined) { const e = new Error('nope'); e.code = 'NoSuchKey'; e.statusCode = 404; return cb(e); }
            cb(null, { Body: Buffer.from(b) });
        },
        deleteObjects (p, cb) {
            calls.push(['del', p.Bucket, p.Delete.Objects.map(o => o.Key)]);
            cb(null, {});
        },
    };
}
const sc = { id: 11417, project: 1989 };

console.log('keys');
eq('new bucket default', so.newBucket(), 'arbimon-soundscapes');
eq('old bucket = config aws bucketName', so.oldBucket(), 'arbimon2');
eq('new key is flat <sid>/<file>', so.newKey(11417, 'index.scidx'), '11417/index.scidx');
eq('old key unchanged', so.oldKey(1989, 11417, 'h.json'), 'project_1989/soundscapes/11417/h.json');
eq('locations order: new then old', so.locations(sc, 'aci.json'),
   [{ Bucket: 'arbimon-soundscapes', Key: '11417/aci.json' }, { Bucket: 'arbimon2', Key: 'project_1989/soundscapes/11417/aci.json' }]);
eq('row-shaped soundscape (soundscape_id/project_id) works too',
   so.locations({ soundscape_id: 5, project_id: 7 }, 'h.json')[1].Key, 'project_7/soundscapes/5/h.json');
let threw = false; try { so.newKey(0, 'x'); } catch (e) { threw = true; } eq('bad id rejected', threw, true);
eq('png is not a managed file', so.FILES.includes('image.png'), false);

console.log('read fallback');
(function () {
    const s3 = fakeS3({ 'arbimon-soundscapes': { '11417/index.scidx': 'NEW' }, arbimon2: { 'project_1989/soundscapes/11417/index.scidx': 'OLD' } });
    so.getObject(s3, sc, 'index.scidx', (e, d, w) => { eq('new present -> new', [e, String(d.Body), w], [null, 'NEW', 'new']); eq('old not touched', s3.calls.length, 1); });
})();
(function () {
    const s3 = fakeS3({ arbimon2: { 'project_1989/soundscapes/11417/index.scidx': 'OLD' } });
    so.getObject(s3, sc, 'index.scidx', (e, d, w) => eq('new missing -> old', [e, String(d.Body), w], [null, 'OLD', 'old']));
})();
(function () {
    const s3 = fakeS3({});
    so.getObject(s3, sc, 'index.scidx', (e) => eq('missing everywhere -> 404-class error', so.isMissing(e), true));
})();
(function () {
    const boom = new Error('SlowDown'); boom.code = 'SlowDown'; boom.statusCode = 503;
    const s3 = fakeS3({ arbimon2: { 'project_1989/soundscapes/11417/index.scidx': 'OLD' } }, { 'arbimon-soundscapes': boom });
    so.getObject(s3, sc, 'index.scidx', (e) => { eq('a real error on NEW is returned, not masked by the fallback', e && e.code, 'SlowDown'); eq('old NOT consulted on a real error', s3.calls.length, 1); });
})();

console.log('delete');
(function () {
    const s3 = fakeS3({});
    so.deleteAll(s3, sc, 'project_1989/soundscapes/11417/image.png', (e) => {
        eq('no error', e, null);
        eq('new layout: 4 files', s3.calls[0], ['del', 'arbimon-soundscapes', ['11417/index.scidx', '11417/peaknumbers.json', '11417/h.json', '11417/aci.json']]);
        eq('old layout: 4 files + image.png', s3.calls[1], ['del', 'arbimon2', ['project_1989/soundscapes/11417/index.scidx', 'project_1989/soundscapes/11417/peaknumbers.json', 'project_1989/soundscapes/11417/h.json', 'project_1989/soundscapes/11417/aci.json', 'project_1989/soundscapes/11417/image.png']]);
    });
})();

console.log('wiring (shipped source)');
const model = fs.readFileSync(path.join(root, 'app/model/soundscapes.js'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/routes/data-api/project/soundscapes.js'), 'utf8');
eq('fetchSCIDXFile reads via soundscapeObjects.getObject', /soundscapeObjects\.getObject\(s3, soundscape, 'index\.scidx'/.test(model), true);
eq('delete goes through deleteAll', /soundscapeObjects\.deleteAll\(s3,/.test(model), true);
eq('delete returns on a missing row (no rows[0] crash)', /if \(!rows \|\| !rows\.length\)/.test(model), true);
eq('no soundscape object is addressed via config(aws).bucketName any more',
   /soundscapes\/.{0,80}\n?.{0,120}config\('aws'\)\.bucketName|Bucket *: *config\('aws'\)\.bucketName,\s*\n\s*Key *: *scidx_uri/.test(model), false);
eq('/indices uses the fallback reader for all 3 json files', (route.match(/get\('(h|aci|peaknumbers)\.json'\)/g) || []).length, 3);

setTimeout(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }, 50);