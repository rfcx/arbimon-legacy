/* jshint node:true */
'use strict';

// REGRESSION GUARD for OPEN-ITEMS §407 (2026-09-26, operator goifirr 11:54):
// the export job's getImageData fetched the legacy image.png UNGUARDED, so one
// soundscape without a surviving PNG (the common case since the 09-25 20:37 PNG
// retirement + the §275 deletion) rejected getProjectSoundscapesImages and
// failed the whole soundscape-images leg of a project export. Now: NoSuchKey /
// 404 -> skip the image, anything else still throws.
//
// Standalone (heavy deps stubbed via require.cache): node test/export-soundscape-image-skip.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');

let mode = 'missing';
const written = [];
function stub (rel, exports) {
    const r = require.resolve(path.join(root, rel));
    require.cache[r] = { id: r, filename: r, loaded: true, exports };
}
stub('jobs/services/storage', {
    getObject: async ({ Bucket, Key }) => {
        if (mode === 'missing') { const e = new Error('The specified key does not exist.'); e.code = 'NoSuchKey'; e.statusCode = 404; throw e; }
        if (mode === 'boom') { const e = new Error('SlowDown'); e.code = 'SlowDown'; e.statusCode = 503; throw e; }
        return Buffer.from('PNGDATA-' + Key);
    },
    combineFilename: {}, copyObject: {}, saveLatestData: {}, getSignedUrl: {}
});
stub('app/model/soundscapes', {});
stub('app/utils/scidx', function () {});
stub('jobs/services/soundscape', { getSoundscapesForCSV: async () => [], getProjectSoundscapes: async () => [] });
stub('jobs/services/file-helper', { zipDirectory: async () => ({}) });

// the module writes into jobs/arbimon-recording-export-job/tmpfilecache relative to cwd
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'expimg-'));
fs.mkdirSync(path.join(scratch, 'jobs/arbimon-recording-export-job/tmpfilecache'), { recursive: true });
process.chdir(scratch);

const mod = require(path.join(root, 'jobs/arbimon-recording-export-job/soundscape.js'));
assert.strictEqual(typeof mod.getImageData, 'function', 'getImageData exported');

let pass = 0, fail = 0;
function ok (label, cond) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label); fail++; } }

(async () => {
    const sc = { id: 999001, name: 'Test Soundscape', uri: 'project_1/soundscapes/999001/image.png' };

    mode = 'missing';
    let err = null;
    try { await mod.getImageData(sc); } catch (e) { err = e; }
    ok('NoSuchKey -> resolves (image skipped)', err === null);
    ok('no file written on skip', !fs.existsSync(path.join(scratch, 'jobs/arbimon-recording-export-job/tmpfilecache/test-soundscape-999001.png')));

    mode = 'present';
    err = null;
    try { await mod.getImageData(sc); } catch (e) { err = e; }
    ok('present -> resolves', err === null);
    const f = path.join(scratch, 'jobs/arbimon-recording-export-job/tmpfilecache/test-soundscape-999001.png');
    ok('file written with the object bytes', fs.existsSync(f) && fs.readFileSync(f).equals(Buffer.from('PNGDATA-' + sc.uri)));

    mode = 'boom';
    err = null;
    try { await mod.getImageData(sc); } catch (e) { err = e; }
    ok('a real S3 error still throws (not masked)', err !== null && err.code === 'SlowDown');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.log('harness error', e); process.exit(1); });
