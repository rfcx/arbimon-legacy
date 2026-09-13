// OPEN-ITEMS §300 item 1 / #86 — the orphan-audio class must answer 404 JSON,
// not the generic 'Server error' 500, on the recordings INFO/TILES/IMAGE/
// THUMBNAIL surfaces.
//
// Run: node_modules/.bin/_mocha test/orphan-audio-info-404.test.js
//
// NEGATIVE CONTROL (the non-optional part): every assertion below is written so
// that it FAILS against the pre-fix tree. Verified by stashing the fix:
//   - the helper/response assertions fail (the functions do not exist),
//   - the call-site assertions fail (the surfaces went straight to next(err)),
//   - the behavioural assertions fail (the predicate is not exported/derivable).
//
// A deliberately SEPARATE file: test/500-guards.test.js is pre-broken on the
// branch base (`sqlutil is not defined`, per the 2026-09-12 closeout), so
// extending it would bury this suite in an unrelated pre-existing failure.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'recordings.js');
const src = fs.readFileSync(SRC_PATH, 'utf8');

// Lift the SHIPPED predicate out of the real file and evaluate it, so the test
// binds to production code rather than to a copy that could silently drift.
//
// Lifted LAZILY (inside each `it`, not at module load): against the pre-fix
// tree the function does not exist, and a load-time assert would abort the
// whole file on its first miss — collapsing the negative control to a single
// error instead of showing which individual guarantees are absent.
function liftFunction (name) {
  const re = new RegExp('function ' + name + ' ?\\([\\s\\S]*?\\n\\}');
  const m = src.match(re);
  assert.ok(m, 'expected function ' + name + '() to exist in recordings.js');
  // eslint-disable-next-line no-new-func
  return new Function('return (' + m[0] + ')')();
}

describe('§300 item 1 — orphan audio (#86) answers 404, not 500', function () {

  describe('the shared missing-object predicate', function () {

    it('matches the storage shapes that mean "the object is gone"', function () {
      const isMissingObjectError = liftFunction('isMissingObjectError');
      // These are exactly the four the audio route has used since 2026-08-29.
      assert.strictEqual(isMissingObjectError({ code: 'NoSuchKey', statusCode: 404 }), true);
      assert.strictEqual(isMissingObjectError({ code: 'NoSuchKey' }), true);
      assert.strictEqual(isMissingObjectError({ code: 'NotFound' }), true);
      assert.strictEqual(isMissingObjectError({ statusCode: 404 }), true);
      assert.strictEqual(isMissingObjectError({ name: 'XMLParserError' }), true);
    });

    it('does NOT match a generic error (must still 500)', function () {
      const isMissingObjectError = liftFunction('isMissingObjectError');
      assert.strictEqual(isMissingObjectError(new Error('boom')), false);
      assert.strictEqual(isMissingObjectError({ code: 'ECONNREFUSED' }), false);
      assert.strictEqual(isMissingObjectError({ statusCode: 500 }), false);
      assert.strictEqual(isMissingObjectError({ code: 'AccessDenied', statusCode: 403 }), false);
      assert.strictEqual(isMissingObjectError(null), false);
      assert.strictEqual(isMissingObjectError(undefined), false);
    });

    // 🔴 THE LOAD-BEARING CASE, measured on prod 2026-09-13: 14 of the 18
    // recordings/{info,tiles} 500s in 7d are recordings whose audio IS PRESENT
    // in the bucket. Swallowing those into "recording audio not found" would
    // tell the user something false and hide a real defect.
    it('does NOT match the media-api 404 render failure (audio is PRESENT)', function () {
      const isMissingObjectError = liftFunction('isMissingObjectError');
      // The exact shape model/recordings.js:954 constructs.
      const mediaApiErr = new Error('media-api returned 404 for spectro asset');
      assert.strictEqual(isMissingObjectError(mediaApiErr), false,
        'a media-api render 404 must NOT be reported as missing audio');
      assert.strictEqual(mediaApiErr.statusCode, undefined);
      assert.strictEqual(mediaApiErr.code, undefined);
    });

    it('does NOT match a corrupt-but-present object (sox/Jimp failure)', function () {
      const isMissingObjectError = liftFunction('isMissingObjectError');
      assert.strictEqual(isMissingObjectError(new Error(
        'Could not open image file /tmp/abc.png')), false);
      // fetchSpectrogramFile's legacy arm calls back {code: <sox exit code>}.
      assert.strictEqual(isMissingObjectError({ code: 2 }), false);
    });
  });

  describe('the shared 404 response', function () {
    it('answers 404 with the SAME body as the audio route', function () {
      const respondAudioNotFound = liftFunction('respondAudioNotFound');
      let status = null;
      let body = null;
      const res = {
        status: function (s) { status = s; return this; },
        json: function (b) { body = b; return this; }
      };
      respondAudioNotFound(res);
      assert.strictEqual(status, 404);
      assert.deepStrictEqual(body, { error: 'recording audio not found' });
    });
  });

  describe('every spectrogram surface consumes the predicate', function () {
    // Each surface shares fetchRecordingFile, so each can hit the same miss.

    it('the info case guards fetchSpectrogramTiles', function () {
      const infoBlock = src.match(/fetchSpectrogramTiles\(rec, function\(err, rec\)\{[\s\S]*?res\.json\(rec\);/);
      assert.ok(infoBlock, 'the info case fetchSpectrogramTiles block was not found');
      assert.ok(/isMissingObjectError\(err\)/.test(infoBlock[0]),
        'the info case must answer 404 for a missing object before next(err)');
      assert.ok(/respondAudioNotFound\(res\)/.test(infoBlock[0]));
    });

    it('the tiles route guards fetchOneSpectrogramTile', function () {
      const tilesBlock = src.match(/fetchOneSpectrogramTile\(rec, i, j, function\(err, file\)\{[\s\S]*?\n\s{12}\}\);/);
      assert.ok(tilesBlock, 'the fetchOneSpectrogramTile block was not found');
      assert.ok(/isMissingObjectError\(err\)/.test(tilesBlock[0]),
        'the tiles route must answer 404 for a missing object');
    });

    it('the image/thumbnail file arm guards the callback', function () {
      const fileArm = src.match(/file : function\(err, file\) \{[\s\S]*?return next\(err\);/);
      assert.ok(fileArm, 'the returnType.file arm was not found');
      assert.ok(/isMissingObjectError\(err\)/.test(fileArm[0]),
        'image/thumbnail must answer 404 for a missing object');
    });

    // Found by an IRR pass AFTER the first green run: fetchInfo() itself calls
    // fetchRecordingFile (recordings.js:607) when the row has no cached
    // sample_rate, so `info` and `tiles` each have a SECOND, earlier orphan
    // path that the first version of this fix left 500ing. Rare in practice
    // (pg_stats: sample_rate/duration null_frac = 0) but the same class.
    it('both fetchInfo call sites guard the earlier orphan path', function () {
      const sites = src.match(/fetchInfo\(recording, function\(err, rec\)\{[\s\S]{0,700}?next\(err\);/g) || [];
      assert.strictEqual(sites.length, 2, 'expected the tiles + info fetchInfo call sites');
      sites.forEach(function (block, i) {
        assert.ok(/isMissingObjectError\(err\)/.test(block),
          'fetchInfo call site ' + i + ' must answer 404 for a missing object');
      });
    });

    it('the audio route still uses the same predicate (no behaviour drift)', function () {
      const dl = src.match(/async function downloadRecordingById[\s\S]*?\n\}/);
      assert.ok(dl, 'downloadRecordingById was not found');
      assert.ok(/isMissingObjectError\(err\)/.test(dl[0]),
        'the audio route must call the hoisted helper, not an inline copy');
      assert.ok(/respondAudioNotFound\(res\)/.test(dl[0]));
    });

    it('the predicate is defined exactly ONCE, inside the helper', function () {
      // Pre-fix this file had exactly one occurrence too -- the inline copy in
      // downloadRecordingById -- so a bare count passes both ways and proves
      // nothing. Assert both the count AND that the one occurrence lives in
      // isMissingObjectError(), which is what actually rules out a second
      // hand-maintained copy drifting away from the audio route.
      const defs = src.match(/err\.code === 'NoSuchKey'/g) || [];
      assert.strictEqual(defs.length, 1,
        'the predicate should be defined exactly once, in isMissingObjectError()');
      const helper = src.match(/function isMissingObjectError ?\([\s\S]*?\n\}/);
      assert.ok(helper, 'isMissingObjectError() must exist');
      assert.ok(/err\.code === 'NoSuchKey'/.test(helper[0]),
        'the single definition must be the one inside isMissingObjectError()');
    });
  });

  describe('non-missing errors still reach the generic handler', function () {
    it('each guarded surface still calls next(err) after the 404 branch', function () {
      // If a surface stopped calling next(err), real S3 outages and permission
      // failures would be silently reported as "audio not found".
      const guarded = src.split('isMissingObjectError(err)');
      assert.ok(guarded.length >= 5, 'expected 4 guarded call sites');
      const infoBlock = src.match(/fetchSpectrogramTiles\(rec, function\(err, rec\)\{[\s\S]*?res\.json\(rec\);/)[0];
      assert.ok(/next\(err\)/.test(infoBlock),
        'the info case must still 500 on a non-missing error');
    });
  });
});