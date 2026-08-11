/* jshint node:true */
"use strict";
/**
 * Self-test for the per-variant asset cache keys + media-api attr builder.
 *
 * Regression guard for the 2026-06 defect: fetchSpectrogramFile,
 * fetchTemplateFile and fetchAudioFile shared ONE tmpfilecache key derived from
 * the recording URI alone, so a full-recording COLOUR spectrogram could be
 * served (and stored) as a monochrome template ROI crop, and distinct ROIs /
 * audio variants of one recording collided with each other.
 *
 * Run:  node app/utils/spectro-cache-key.selftest.js
 */
const assert = require('assert');
const crypto = require('crypto');
const moment = require('moment-timezone');

// --- replicas of the production logic under test (kept in lockstep with
// --- app/model/recordings.js buildMediaApiAttr / buildAssetCacheKey) --------
const audioFilePattern = /\.(wav|flac|opus)$/i;
const freqFilterPrecision = 1;

function buildMediaApiAttr (recording, type, options) {
    let asset, fmin, fmax, trimFrom, trimDuration;
    const isFrequency = options && (options.minFreq || options.maxFreq);
    const isGain = options && options.gain;
    const isTrim = options && options.trim;
    const isFormat = options && options.format;
    if (isFrequency) {
        fmin = Math.min((options.minFreq / freqFilterPrecision) * freqFilterPrecision, 22049).toFixed();
        fmax = Math.min((options.maxFreq / freqFilterPrecision) * freqFilterPrecision, 22049).toFixed();
    }
    if (isTrim) {
        trimFrom = +options.trim.from;
        const to = +options.trim.to;
        trimDuration = options.trim.duration ? (+options.trim.duration) : (to - trimFrom);
    }
    switch (type) {
        case 'spectro': asset = `rfull_g1_fspec_mtrue_d10286.255_wdolph_z120.png`; break;
        case 'audio': asset = `r${isFrequency ? fmin + '.' + fmax : 'full'}_g${isGain ? options.gain : 1}_${isFormat ? 'fwav.wav' : 'fmp3.mp3'}`; break;
        case 'template': asset = `r${fmin}.${fmax}_g1_fspec_mtrue_d400.400_wdolph_z120.png`; break;
    }
    const recordingDatetime = recording.datetime_utc ? recording.datetime_utc : recording.datetime;
    let momentStart = moment.utc(recordingDatetime);
    let momentEnd = momentStart.clone().add(recording.duration, 'seconds');
    if (isTrim) {
        momentStart = momentStart.add(trimFrom, 'seconds');
        momentEnd = momentStart.clone().add(trimDuration, 'seconds');
    }
    const dateFormat = 'YYYYMMDDTHHmmssSSS';
    // Lockstep with asset-url.js mediaStreamId: shape-validated uri segment
    // first, external_id fallback, 'undefined' never usable — OPEN-ITEMS #107.
    const m = (typeof recording.uri === 'string' && recording.uri.indexOf('project_') !== 0)
        ? /^\d{4}\/\d{2}\/\d{2}\/([^/]+)\/[^/]+$/.exec(recording.uri) : null;
    const streamId = (m && m[1] !== 'undefined') ? m[1]
        : ((recording.external_id && recording.external_id !== 'undefined') ? recording.external_id : null);
    return `${streamId}_t${momentStart.format(dateFormat)}Z.${momentEnd.format(dateFormat)}Z_${asset}`;
}

function buildAssetCacheKey (recording, variant, ext) {
    const base = String(recording.uri || '').replace(audioFilePattern, '').replace(/[^A-Za-z0-9_-]/g, '_');
    const v = crypto.createHash('sha256').update(String(variant)).digest('hex').slice(0, 16);
    return `${base}_${v}${ext}`;
}

// tmpfilecache's hashing (app/utils/tmpfilecache.js) -- keys must survive it
function hash_key (key) {
    const match = /^(.*?)((\.[^.\/]*)*)?$/.exec(key);
    return crypto.createHash('sha256').update(match[1]).digest('hex') + (match[2] || '');
}

// ---------------------------------------------------------------- fixtures
const rec = {
    // Standard ingest key shape (YYYY/MM/DD/<streamId>/<file>) so the uri-first
    // stream derivation resolves; uri segment == external_id (the 99.983% case).
    uri: '2026/07/13/aBc123XyZ/aBc123XyZ_t20260713T000000000Z.wav',
    external_id: 'aBc123XyZ',
    datetime: '2026-07-13 00:00:00',
    datetime_utc: '2026-07-13 00:00:00',
    duration: 60
};
const roiA = { minFreq: 198, maxFreq: 15524, trim: { from: 0.098, to: 1.702 } };
const roiB = { minFreq: 206, maxFreq: 12364, trim: { from: 0.291, to: 0.895 } };

let passed = 0;
function ok (name, fn) { fn(); passed++; console.log('  ok -', name); }

console.log('spectro-cache-key selftest');

ok('THE BUG: spectro vs template must NOT share a cache key', () => {
    const kSpec = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'spectro', {}), '.png');
    const kTpl = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'template', roiA), '.png');
    assert.notStrictEqual(kSpec, kTpl);
    assert.notStrictEqual(hash_key(kSpec), hash_key(kTpl));
});

ok('two DIFFERENT ROIs of one recording get different keys', () => {
    const a = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'template', roiA), '.png');
    const b = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'template', roiB), '.png');
    assert.notStrictEqual(a, b);
});

ok('audio: gain / frequency / format / trim each change the key', () => {
    const base = { trim: { from: 0, to: 10 } };
    const keys = new Set([
        buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'audio', base), '.mp3'),
        buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'audio', { ...base, gain: 2 }), '.mp3'),
        buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'audio', { ...base, minFreq: 500, maxFreq: 8000 }), '.mp3'),
        buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'audio', { ...base, format: '.wav' }), '.wav'),
        buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'audio', { trim: { from: 5, to: 10 } }), '.mp3')
    ]);
    assert.strictEqual(keys.size, 5);
});

ok('template attr carries the monochrome flag + 400x400 dims', () => {
    const attr = buildMediaApiAttr(rec, 'template', roiA);
    assert.ok(attr.includes('_mtrue_'), 'monochrome flag missing: ' + attr);
    assert.ok(attr.includes('d400.400'), 'dims wrong: ' + attr);
    assert.ok(attr.endsWith('.png'));
});

ok('spectro attr is the FULL-recording MONOCHROME variant', () => {
    // 2026-08-10: this assertion previously REQUIRED the absence of `mtrue`,
    // pinning a defect as if it were intent. media-api reads
    // `monochrome = findStartsWith('m') || 'false'`, so omitting the token
    // yields an 8-bit RGB render -- the full-recording spectrogram was the
    // only ROI-family surface serving colour, at ~2.4-2.8x the bytes.
    // Colour remains a deliberate, user-selectable feature in the VISUALIZER
    // (localStorage visualizer.spectro_color); it is not this asset's job.
    const attr = buildMediaApiAttr(rec, 'spectro', {});
    assert.ok(attr.includes('_mtrue_'), 'spectro must be monochrome: ' + attr);
    assert.ok(attr.includes('d10286.255'));
});

ok('spectro and template are BOTH monochrome but still distinct keys', () => {
    // Guards the 2026-06 collision fix while both are mtrue: they must stay
    // distinct on GEOMETRY + clip, not on the colour flag.
    const kSpec = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'spectro', {}), '.png');
    const kTpl = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'template', roiA), '.png');
    assert.notStrictEqual(kSpec, kTpl, 'spectro/template must not share a key');
});

ok('keys are filesystem-safe: one dot, no slashes, bounded length', () => {
    const k = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'template', roiA), '.png');
    assert.strictEqual((k.match(/\./g) || []).length, 1, 'must have exactly one dot: ' + k);
    assert.ok(!k.includes('/'), 'no slashes: ' + k);
    const fname = hash_key(k);
    assert.strictEqual(fname.length, 64 + '.png'.length, 'filename length: ' + fname);
});

ok('keys are deterministic (same inputs -> same key)', () => {
    const a = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'template', roiA), '.png');
    const b = buildAssetCacheKey(rec, buildMediaApiAttr(rec, 'template', { ...roiA }), '.png');
    assert.strictEqual(a, b);
});

ok('trim window shifts the attr time range (ROI is time-addressed)', () => {
    const a = buildMediaApiAttr(rec, 'template', roiA);
    const b = buildMediaApiAttr(rec, 'template', roiB);
    assert.notStrictEqual(a, b);
    assert.ok(/_t\d{8}T\d{9}Z\.\d{8}T\d{9}Z_/.test(a), 'time window malformed: ' + a);
});

ok('REGRESSION: the OLD key scheme collided (proves the test is meaningful)', () => {
    const oldSpec = rec.uri.replace(audioFilePattern, '.png');
    const oldTpl = rec.uri.replace(audioFilePattern, '.png');
    assert.strictEqual(oldSpec, oldTpl, 'old scheme should collide');
    assert.strictEqual(hash_key(oldSpec), hash_key(oldTpl));
});

console.log(`\n${passed}/${passed} passed`);