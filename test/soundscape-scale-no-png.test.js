/* jshint node:true */
'use strict';

// Guard (2026-09-25, operator 20:37): a soundscape scale/palette change must
// NOT re-render and re-upload a (world-readable) image.png any more. Every
// consumer renders the heat-map from index.scidx with the row's visual settings
// (app/utils/soundscape-image.js server-side; the SPA canvas client-side), so the
// scale route only needs to persist those settings.
// Run: node test/soundscape-scale-no-png.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function eq (label, actual, expected) {
    try { assert.deepStrictEqual(actual, expected); console.log('  ok   ' + label); pass++; }
    catch (e) { console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')'); fail++; }
}

const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'lib/soundscape/set_visual_scale_lib.py'), 'utf8');
const run = lib.slice(lib.indexOf('def run('));

console.log('set_visual_scale_lib.py');
eq('run() exists', run.length > 0, true);
eq('no image render', /write_image\(/.test(lib), false);
eq('no upload', /upload_image|set_contents_from_filename|new_key\(/.test(lib), false);
eq('no public ACL', /public-read|set_acl\(/.test(lib), false);
eq('no scidx download on a scale change', /get_scidx_file|tempfilecache/.test(lib), false);
eq('still persists the visual settings', /update_db\(db, clip_max, palette_id, soundscape_id, normalized, amplitude_th, amplitude_th_type\)/.test(run), true);
eq('update_db writes the 5 visual columns', /SET visual_max_value = %s, visual_palette = %s,\s+normalized = %s, threshold = %s,\s+threshold_type = %s/.test(lib), true);
eq('still rejects an unknown soundscape id', /get_sc_data\(db, soundscape_id\)/.test(run), true);
eq('get_bucket kept (scripts/buckets/copyfrombucket2bucket.py imports it)', /\ndef get_bucket\(/.test(lib), true);

console.log('consumers render from scidx with the stored settings');
const img = fs.readFileSync(path.join(root, 'app/utils/soundscape-image.js'), 'utf8');
eq('server renderer honours visual_max_value (NULL = data max)', /sc\.visual_max_value !== null && sc\.visual_max_value !== undefined/.test(img), true);
const url = fs.readFileSync(path.join(root, 'app/utils/arbimon2-asset-url.js'), 'utf8');
eq('render url changes with the settings (cache key)', /\[sc\.visual_palette, sc\.visual_max_value, sc\.normalized, sc\.threshold, sc\.threshold_type\]/.test(url), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);