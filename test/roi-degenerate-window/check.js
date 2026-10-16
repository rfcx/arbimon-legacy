#!/usr/bin/env node
/**
 * DEGENERATE ROI WINDOWS — roiSpectrogramUrl() must never emit a window media-api
 * rejects (bare node, no npm install; run by .github/workflows/pr-gate.yaml).
 *
 * WHY (rfcx-local OPEN-ITEMS §473, 2026-10-16): media-api 400s a zero-height band
 * (`rA.A`, "Highpass frequency filter can not be greater or equal to lowpass") and
 * 500s a zero-length window (start == end). ~1 in 10k PM ROIs has one of those
 * shapes (2 M-row prod sample: 184 with y1 == y2, 61 at nyquist). Those ROIs used to
 * render only through the stored arbimon2 PNG fallback, which is being retired, so
 * the URL builder pads the degenerate axis instead.
 *
 * The NON-degenerate path is covered byte-for-byte by test/roi-reader-golden.
 * Exit: 0 pass · 1 fail · 2 cannot run.
 */
'use strict';
const assert = require('assert');
let a;
try {
    process.env.STREAM_TOKEN_SALT = process.env.STREAM_TOKEN_SALT || 'test-salt';
    a = require('../../app/utils/asset-url');
} catch (e) {
    console.error(`CANNOT RUN: ${e.message}`);
    process.exit(2);
}

const base = { recUri: '2024/07/15/t8v5mv71orxq/x.flac', externalId: null, datetimeUtc: new Date('2024-07-15T21:35:00.000Z'), sampleRate: 44100 };
function parse (url) {
    const m = /_t(\d{8}T\d{9})Z\.(\d{8}T\d{9})Z_r(\d+)\.(\d+)_/.exec(url);
    assert(m, `unparseable url ${url}`);
    const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13), +s.slice(13, 15), +s.slice(15, 18));
    return { start: ms(m[1]), end: ms(m[2]), fmin: +m[3], fmax: +m[4] };
}
let failed = 0;
function ok (name, fn) {
    try { fn(); console.log(`PASS  ${name}`); } catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
function valid (w) {
    assert(w.fmax > w.fmin, `band not positive: r${w.fmin}.${w.fmax}`);
    assert(w.end > w.start, `window not positive: ${w.start}..${w.end}`);
}

ok('zero band at nyquist (the real 400 shape r22049.22049) is padded DOWN, stays <= nyquist', () => {
    const w = parse(a.roiSpectrogramUrl({ ...base, timeMin: 32.959, timeMax: 33.002, freqMin: 22050, freqMax: 22050 }, { width: 400, height: 400 }));
    valid(w);
    assert(w.fmax <= 22050, `fmax ${w.fmax} above nyquist`);
    assert(w.fmax - w.fmin <= 60, `band padded too wide: ${w.fmax - w.fmin} Hz`);
});
ok('zero band mid-spectrum is padded UP', () => {
    const w = parse(a.roiSpectrogramUrl({ ...base, timeMin: 1, timeMax: 2, freqMin: 545, freqMax: 545 }, { width: 400, height: 400 }));
    valid(w);
    assert.strictEqual(w.fmin, 545);
});
ok('sub-Hz band that rounds to equal is padded', () => {
    const w = parse(a.roiSpectrogramUrl({ ...base, timeMin: 1, timeMax: 2, freqMin: 1000.2, freqMax: 1000.4 }, { width: 400, height: 400 }));
    valid(w);
});
ok('zero band at 0 Hz is padded up from 0', () => {
    const w = parse(a.roiSpectrogramUrl({ ...base, timeMin: 1, timeMax: 2, freqMin: 0, freqMax: 0 }, { width: 400, height: 400 }));
    valid(w);
    assert.strictEqual(w.fmin, 0);
});
ok('zero-length window is padded around its midpoint, never before the recording start', () => {
    const w = parse(a.roiSpectrogramUrl({ ...base, timeMin: 5, timeMax: 5, freqMin: 100, freqMax: 2000 }, { width: 400, height: 400 }));
    valid(w);
    const t0 = base.datetimeUtc.getTime();
    assert(w.start <= t0 + 5000 && w.end >= t0 + 5000, 'pad does not cover the ROI instant');
    const w0 = parse(a.roiSpectrogramUrl({ ...base, timeMin: 0, timeMax: 0, freqMin: 100, freqMax: 2000 }, { width: 400, height: 400 }));
    valid(w0);
    assert(w0.start >= t0, 'padded before the recording start');
});
ok('sub-ms window that rounds to equal is padded', () => {
    const w = parse(a.roiSpectrogramUrl({ ...base, timeMin: 5.0001, timeMax: 5.0003, freqMin: 100, freqMax: 2000 }, { width: 400, height: 400 }));
    valid(w);
});
ok('a normal window is NOT touched', () => {
    const w = parse(a.roiSpectrogramUrl({ ...base, timeMin: 1.5, timeMax: 3.25, freqMin: 188, freqMax: 2063 }, { width: 400, height: 400 }));
    const t0 = base.datetimeUtc.getTime();
    assert.deepStrictEqual(w, { start: t0 + 1500, end: t0 + 3250, fmin: 188, fmax: 2063 });
});
ok('minted and fallback branches name the same padded object', () => {
    const roi = { ...base, timeMin: 5, timeMax: 5, freqMin: 22050, freqMax: 22050 };
    const minted = a.roiSpectrogramUrl(roi, { width: 400, height: 400 });
    const salt = process.env.STREAM_TOKEN_SALT;
    delete process.env.STREAM_TOKEN_SALT;
    let fallback;
    try { fallback = a.roiSpectrogramUrl(roi, { width: 400, height: 400 }); } finally { process.env.STREAM_TOKEN_SALT = salt; }
    const f = (u) => u.split('/').pop().split('?')[0];
    assert(/^\/legacy-api\/ingest\/recordings\//.test(fallback), `fallback branch not taken: ${fallback}`);
    assert.strictEqual(f(minted), f(fallback));
});

console.log(failed ? `RESULT: FAIL (${failed})` : 'RESULT: PASS');
process.exit(failed ? 1 : 0);