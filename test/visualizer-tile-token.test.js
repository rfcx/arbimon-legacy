/**
 * Regression harness for the VISUALIZER direct-media-route tile tokens (#99).
 *
 * 🔴 WHY THIS FUZZES INSTEAD OF SAMPLING
 *
 * On 2026-08-10 the ROI caller switch shipped and 9 of 10 images 401'd in
 * production. The verification that missed it tested ONE ROI — which happened
 * to land on a whole millisecond. It passed an offline harness, a live fetch
 * AND a real-browser render, and was still wrong for ~90% of real inputs.
 *
 * The defect class: media-api does NOT trust any window the caller sends. It
 * re-derives start/end by PARSING THEM BACK OUT OF THE FILENAME. So a token is
 * only valid if it was signed over exactly the integers the filename encodes.
 * Anything that rounds/truncates differently between the two derivations is a
 * guaranteed 401 for every input that isn't already an integer.
 *
 * So this asserts the property END-TO-END, the way media-api sees it:
 *   mint -> render the filename -> RE-PARSE the filename -> re-sign -> compare
 * across hundreds of randomised fractional tile geometries.
 *
 * It deliberately reimplements media-api's parse/sign from its own source
 * (segment-file-parsing + gluedDateStrToMoment + getStreamRangeToken) rather
 * than importing arbimon-legacy's helpers, so a mistake in OUR helper cannot
 * cancel itself out on both sides of the assertion.
 */
process.env.STREAM_TOKEN_SALT = process.env.STREAM_TOKEN_SALT || 'test_salt_visualizer_harness';

const assert = require('assert');
const crypto = require('crypto');
const moment = require('moment');

const { mediaAssetUrl } = require('../app/utils/asset-url');

// ---------------------------------------------------------------------------
// media-api's SIDE of the contract, transcribed from rfcx-api @ origin/master:
//   core/stream-segments/bl/segment-file-parsing.js  (parseFileNameAttrs)
//   core/_utils/datetime/parse.js                    (gluedDateStrToMoment)
//   core/streams/dao/index.js                        (getStreamRangeToken)
//   common/middleware/passport-stream-token/service.js (parseStreamAndTime)
// ---------------------------------------------------------------------------
function parseFileNameAttrs (name) {
    const nameArr = name.split('_');
    function findStartsWith (symb) {
        const item = nameArr.find((item, index) => index !== 0 && item.startsWith(symb));
        return item ? item.slice(symb.length) : undefined;
    }
    const timeStr = findStartsWith('t');
    return {
        streamId: nameArr[0] && nameArr[0].length > 0 ? nameArr[0] : undefined,
        time: timeStr ? { starts: timeStr.split('.')[0], ends: timeStr.split('.')[1] } : undefined
    };
}

function gluedDateStrToMoment (dateStr) {
    return moment(dateStr, 'YYYYMMDDTHHmmssSSSZ').utc();
}

function hashedCredentials (salt, msg) {
    return crypto.createHash('sha256').update(salt + msg, 'utf8').digest('hex');
}

function getStreamRangeToken (stream, start, end, exp) {
    const SALT = process.env.STREAM_TOKEN_SALT || 'random_string';
    const message = (exp === undefined || exp === null)
        ? `${stream}_${start}_${end}`
        : `${stream}_${start}_${end}_${exp}`;
    return hashedCredentials(SALT, message);
}

/** Exactly what passport-stream-token does for an /internal/assets/streams URL. */
function mediaApiWouldAuthorise (url) {
    const [path, qs] = url.replace('/media-api/internal/assets/streams/', '').split('?');
    const query = Object.fromEntries(new URLSearchParams(qs));
    const attrs = parseFileNameAttrs(path);
    const stream = attrs.streamId;
    const start = attrs.time && attrs.time.starts ? gluedDateStrToMoment(attrs.time.starts).valueOf() : undefined;
    const end = attrs.time && attrs.time.ends ? gluedDateStrToMoment(attrs.time.ends).valueOf() : undefined;
    if (!stream || !start || !end) return { ok: false, reason: 'ValidationError' };

    let exp;
    const rawExp = query.exp;
    if (rawExp !== undefined && rawExp !== null && `${rawExp}` !== '') {
        exp = Number(rawExp);
        if (!Number.isInteger(exp) || exp * 1000 <= Date.now()) return { ok: false, reason: 'expired/malformed' };
    }
    const correct = getStreamRangeToken(stream, start, end, exp);
    return { ok: correct === query['stream-token'], reason: 'digest', start, end, exp };
}

// ---------------------------------------------------------------------------
// The client-side derivation the visualizer uses, transcribed from
// arbimon packages/common/src/api-arbimon/audiodata/visualizer.ts
// ---------------------------------------------------------------------------
function clientTileWindow (baseMs, tile) {
    return {
        startMs: baseMs + Math.round(tile.s * 1000),
        endMs: baseMs + Math.round((tile.s + tile.ds) * 1000)
    };
}

/** The server-side mint, mirroring model/recordings.js attachTileMediaTokens. */
function serverMintTile (streamId, baseMs, tile) {
    const startMs = baseMs + Math.round(tile.s * 1000);
    const endMs = baseMs + Math.round((tile.s + tile.ds) * 1000);
    return mediaAssetUrl(streamId, startMs, endMs, 'placeholder.png');
}

function buildTileUrl (minted, palette) {
    const asset = `z95_wdolph_g1_fspec_${palette}_d1023.255.png`;
    return `/media-api/internal/assets/streams/${minted.mediaStreamId}_t${minted.mediaStart}Z.` +
        `${minted.mediaEnd}Z_${asset}?stream-token=${minted.mediaToken}&exp=${minted.mediaExp}`;
}

// ---------------------------------------------------------------------------
let failures = 0;
let checked = 0;
const PALETTES = ['mtrue', 'mfalse', 'mfalse_p2', 'mfalse_p3', 'mfalse_p4'];

function rnd (a, b) { return a + Math.random() * (b - a); }

console.log('--- FUZZ: minted tile tokens must verify against the window RE-PARSED FROM THE FILENAME ---');

for (let i = 0; i < 2000; i++) {
    // Realistic visualizer geometry: tiles are fractional-second offsets of a
    // recording whose own start is an arbitrary wall-clock instant.
    const baseMs = Date.UTC(2021, 3, 28, 14, 20, 0) + Math.floor(rnd(0, 6e10));
    // tile.s / tile.ds come from pixels2Secs = duration/width — routinely
    // irrational-looking fractions, which is the whole point.
    const pixels2Secs = rnd(0.01, 0.9);
    const tile = { s: rnd(0, 60) * pixels2Secs, ds: rnd(1, 400) * pixels2Secs };

    const minted = serverMintTile('goexxd5oybrr', baseMs, tile);
    assert.ok(minted, 'mint must succeed with a salt configured');

    const shaped = {
        mediaStreamId: 'goexxd5oybrr',
        mediaStart: minted.startTs,
        mediaEnd: minted.endTs,
        mediaToken: minted.token,
        mediaExp: minted.exp
    };
    const url = buildTileUrl(shaped, PALETTES[i % PALETTES.length]);

    const verdict = mediaApiWouldAuthorise(url);
    checked++;
    if (!verdict.ok) {
        failures++;
        if (failures <= 3) {
            console.log(`  FAIL: baseMs=${baseMs} s=${tile.s} ds=${tile.ds} reason=${verdict.reason}`);
            console.log(`        url=${url}`);
        }
    }

    // The server's signed window must ALSO equal what the client would have
    // computed — otherwise the tile renders the wrong audio segment.
    const cw = clientTileWindow(baseMs, tile);
    if (cw.startMs !== minted.startMs || cw.endMs !== minted.endMs) {
        failures++;
        console.log(`  FAIL(window drift): client=${cw.startMs}..${cw.endMs} server=${minted.startMs}..${minted.endMs}`);
    }
}

console.log(`fuzz: checked=${checked} failures=${failures}`);
assert.strictEqual(failures, 0, 'every minted tile token must verify against the re-parsed filename');

// ---------------------------------------------------------------------------
// Negative controls — a harness that cannot FAIL proves nothing.
// ---------------------------------------------------------------------------
console.log('--- NEGATIVE CONTROLS (each MUST be rejected) ---');

const baseMs = Date.UTC(2021, 3, 28, 14, 20, 0);
const tile = { s: 12.3456, ds: 3.7891 };
const good = serverMintTile('goexxd5oybrr', baseMs, tile);
const goodShaped = {
    mediaStreamId: 'goexxd5oybrr',
    mediaStart: good.startTs,
    mediaEnd: good.endTs,
    mediaToken: good.token,
    mediaExp: good.exp
};

assert.ok(mediaApiWouldAuthorise(buildTileUrl(goodShaped, 'mtrue')).ok, 'control: the good URL must verify');
console.log('  ok: valid token verifies');

// 1. Palette change must NOT break the signature (this is what lets the client choose).
assert.ok(mediaApiWouldAuthorise(buildTileUrl(goodShaped, 'mfalse_p4')).ok,
    'palette must not be part of the signature');
console.log('  ok: palette swap still verifies (render params are unsigned by design)');

// 2. Tampered window must fail.
const tampered = { ...goodShaped, mediaEnd: good.endTs.replace(/\d{3}$/, '999') };
assert.ok(!mediaApiWouldAuthorise(buildTileUrl(tampered, 'mtrue')).ok, 'a tampered window must 401');
console.log('  ok: tampered end-time rejected');

// 3. Tampered exp must fail.
const expTamper = { ...goodShaped, mediaExp: goodShaped.mediaExp + 86400 };
assert.ok(!mediaApiWouldAuthorise(buildTileUrl(expTamper, 'mtrue')).ok, 'an extended exp must 401');
console.log('  ok: extended exp rejected');

// 4. No token at all must fail.
const noTok = { ...goodShaped, mediaToken: '' };
assert.ok(!mediaApiWouldAuthorise(buildTileUrl(noTok, 'mtrue')).ok, 'a missing token must 401');
console.log('  ok: missing token rejected');

// 5. THE 2026-08-10 DEFECT ITSELF: signing the RAW fractional window while the
//    filename carries the truncated one must be caught by this harness.
(function provesTheHarnessCatchesTheKnownDefect () {
    const fracBase = baseMs + 0; // integer base
    const fracTile = { s: 1.0005, ds: 2.0007 }; // -> .5 / .7 fractional ms
    const rawStart = fracBase + fracTile.s * 1000;          // 1000.5  (fractional!)
    const rawEnd = fracBase + (fracTile.s + fracTile.ds) * 1000;
    assert.ok(!Number.isInteger(rawStart), 'control setup: start must be fractional');
    const exp = good.exp;
    // Filename printed via Date() => TRUNCATED, token signed over RAW => mismatch
    const d = new Date(rawStart);
    const p = (n, w) => String(n).padStart(w || 2, '0');
    const startTsTrunc = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T` +
        `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${p(d.getUTCMilliseconds(), 3)}`;
    const d2 = new Date(rawEnd);
    const endTsTrunc = `${d2.getUTCFullYear()}${p(d2.getUTCMonth() + 1)}${p(d2.getUTCDate())}T` +
        `${p(d2.getUTCHours())}${p(d2.getUTCMinutes())}${p(d2.getUTCSeconds())}${p(d2.getUTCMilliseconds(), 3)}`;
    const badToken = getStreamRangeToken('goexxd5oybrr', rawStart, rawEnd, exp); // RAW — the bug
    const badUrl = `/media-api/internal/assets/streams/goexxd5oybrr_t${startTsTrunc}Z.${endTsTrunc}Z_` +
        `z95_wdolph_g1_fspec_mtrue_d1023.255.png?stream-token=${badToken}&exp=${exp}`;
    assert.ok(!mediaApiWouldAuthorise(badUrl).ok,
        'the harness MUST reject the 2026-08-10 fractional-ms construction');
    console.log('  ok: reproduces + REJECTS the 2026-08-10 fractional-ms defect');
})();

console.log('\nALL VISUALIZER TILE TOKEN CHECKS PASSED ✅');
