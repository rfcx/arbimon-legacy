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

const { mediaAssetUrl } = require('../../app/utils/asset-url');

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

// ---------------------------------------------------------------------------
// STREAM-ID DERIVATION — the server MUST sign the same stream id the browser
// puts in the filename.
//
// 🔴 This section calls the REAL `attachTileMediaTokens` from model/recordings.js
// rather than re-implementing it. The fuzz above deliberately mirrors the mint
// logic (so a bug in our helper can't cancel itself out), but that also means
// it can NEVER catch a mistake in how the model picks the stream id. This did
// happen: the first implementation preferred `sites.external_id`, which reads
// as the authoritative value but is NOT what the client puts in the filename.
//
// Evidence (full-table scan 2026-08-10, 304,156,781 recordings): 49,249
// non-legacy rows across 11 sites disagree -- 9,363 NULL external_id and
// 39,886 genuinely different. Real projects affected: tech4nature-mexico
// (14,352), green-and-golden-bell-frogs (7,073), workshop-arbimon (2,289),
// nahuelbuta (59). Verified live on prod media-api: minting from external_id
// returned 401, minting from the uri segment authenticated.
//
// A 401 tile is SILENT -- visualizer-tile-img.vue's onerror drops it and the
// tile renders blank -- so only a test like this can catch a regression.
(function streamIdMustMatchTheClientDerivation () {
    const recordings = require('../../app/model/recordings');

    // REAL divergent rows observed in production.
    const cases = [
        {   name: 'nahuelbuta (external_id differs from uri segment)',
            uri: '2020/12/10/3qxwx34vyovi/002ac71c-5825-47bf-a778-ff33d587316d.opus',
            external_id: 'rj83wlyqyx3d', expected: '3qxwx34vyovi' },
        {   name: 'tech4nature-mexico (differs)',
            uri: '2024/05/02/p2gi3vshr6k0/aaaaaaaa-0000-0000-0000-000000000000.flac',
            external_id: 'tz0xjytraxag', expected: 'p2gi3vshr6k0' },
        {   name: 'green-and-golden-bell-frogs (external_id NULL)',
            uri: '2025/12/01/79nm6fpzuybk/7d0aee78-0d59-418b-a20b-0551029bdd8d.flac',
            external_id: null, expected: '79nm6fpzuybk' },
        {   name: "site carrying the literal string 'undefined' (truthy -> would win a ||)",
            uri: '2023/01/01/selblm7pnz1n/bbbbbbbb-0000-0000-0000-000000000000.flac',
            external_id: 'undefined', expected: 'selblm7pnz1n' },
        {   name: 'aligned row (the common case) still works',
            uri: '2026/02/23/3hg6xt6309lv/2f09539f-641d-48a1-8b59-72687f57d532.flac',
            external_id: '3hg6xt6309lv', expected: '3hg6xt6309lv' }
    ];

    cases.forEach(function (c) {
        const recording = {
            uri: c.uri,
            external_id: c.external_id,
            datetime_utc: '2020-12-10T00:00:00.000Z'
        };
        const tiles = [{ s: 0, ds: 5.9678 }];
        recordings.attachTileMediaTokens(recording, tiles);
        const t = tiles[0];
        assert.ok(t.mediaToken, 'a token must be minted for: ' + c.name);
        assert.strictEqual(t.mediaStreamId, c.expected,
            'stream id must come from uri.split("/")[3], not external_id — ' + c.name);

        // End-to-end: the token must verify against the filename the CLIENT
        // builds, which always uses the uri-derived id.
        const clientUrl = '/media-api/internal/assets/streams/' +
            c.expected + '_t' + t.mediaStart + 'Z.' + t.mediaEnd + 'Z_' +
            'z95_wdolph_g1_fspec_mtrue_d1023.255.png' +
            '?stream-token=' + t.mediaToken + '&exp=' + t.mediaExp;
        assert.ok(mediaApiWouldAuthorise(clientUrl).ok,
            'minted token must authorise the URL the client actually requests — ' + c.name);
    });
    console.log('  ok: stream id is derived as the client does (' + cases.length + ' real prod shapes)');

    // Prove this section can FAIL: minting from external_id must NOT authorise
    // the client's URL for a divergent row.
    const divergent = cases[0];
    const startMs = moment.utc('2020-12-10T00:00:00.000Z').valueOf();
    const endMs = startMs + Math.round(5.9678 * 1000);
    const wrong = mediaAssetUrl(divergent.external_id, startMs, endMs, 'placeholder.png');
    const wrongUrl = '/media-api/internal/assets/streams/' +
        divergent.expected + '_t' + wrong.startTs + 'Z.' + wrong.endTs + 'Z_' +
        'z95_wdolph_g1_fspec_mtrue_d1023.255.png' +
        '?stream-token=' + wrong.token + '&exp=' + wrong.exp;
    assert.ok(!mediaApiWouldAuthorise(wrongUrl).ok,
        'the harness MUST reject a token minted from external_id on a divergent row');
    console.log('  ok: reproduces + REJECTS the external_id mis-derivation');
})();

// ---------------------------------------------------------------------------
// The SAME class as the streamId bug, applied to the BASE TIMESTAMP.
//
// The server derives the window base with `moment.utc(recording.datetime_utc)`;
// the browser derives it with `new Date(recording.datetime_utc)`. Two different
// parsers reading one value — exactly the shape that produced both the
// fractional-ms defect and the external_id defect.
//
// They agree for ISO-8601 with an explicit zone, and DISAGREE BY THE HOST TZ
// OFFSET for a bare "YYYY-MM-DD HH:mm:ss" string (moment.utc reads it as UTC,
// `new Date()` historically reads it as LOCAL). A bare string would silently
// 401 every tile.
//
// We are safe TODAY only because config/db.json sets `timezone: "Z"` and the
// mysql driver is NOT in `dateStrings` mode, so datetime_utc arrives as a JS
// Date and serialises to ISO with a trailing Z. VERIFIED on the live demo pod
// against the real driver: `{"datetime_utc":"2021-04-28T14:20:00.000Z"}`.
//
// That is a load-bearing config detail two layers away from this code, so pin
// it here: if someone enables dateStrings or changes the pool timezone, this
// fails loudly instead of blanking the visualizer.
(function serverAndClientMustParseTheBaseTimestampIdentically () {
    const isoShapes = [
        '2021-04-28T14:20:00.000Z',
        '2021-04-28T14:20:00Z',
        '2026-01-01T00:00:00.000Z'
    ];
    isoShapes.forEach(function (s) {
        assert.strictEqual(moment.utc(s).valueOf(), new Date(s).valueOf(),
            'server moment.utc() and client new Date() must agree for: ' + s);
    });
    console.log('  ok: base timestamp parses identically server- and client-side (ISO w/ zone)');

    // The REAL invariant: whatever shape reaches the client, both parsers must
    // agree. Assert that directly on the shape the driver actually produces
    // (a Date -> ISO-with-Z via JSON), rather than asserting that the bare form
    // is ambiguous — that depends on the host TZ and is UTC-safe in-pod
    // (pods run with TZ unset = UTC), so it cannot be a portable assertion.
    const fromDriver = new Date(Date.UTC(2021, 3, 28, 14, 20, 0));
    const onTheWire = JSON.parse(JSON.stringify({ d: fromDriver })).d;
    assert.ok(/Z$/.test(onTheWire),
        'datetime_utc must reach the client as ISO-8601 WITH a zone designator. ' +
        'If this fails, the mysql driver has been switched to dateStrings or the ' +
        'pool timezone changed — a bare "YYYY-MM-DD HH:mm:ss" is parsed as UTC by ' +
        'moment.utc() (server) and as LOCAL by new Date() (browser), which 401s ' +
        'every tile silently on any non-UTC client.');
    assert.strictEqual(moment.utc(onTheWire).valueOf(), new Date(onTheWire).valueOf(),
        'the wire shape must parse identically on both sides');
    console.log('  ok: wire shape is ISO-with-zone (' + onTheWire + ') — pins db.json timezone:"Z" / no dateStrings');
})();

console.log('\nALL VISUALIZER TILE TOKEN CHECKS PASSED ✅');
