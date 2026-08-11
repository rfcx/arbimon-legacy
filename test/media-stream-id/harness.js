/**
 * Regression harness for the STREAM-ID DERIVATION (OPEN-ITEMS #107).
 *
 * THE DEFECT CLASS: two independent code paths deciding "which stream is this
 * recording?" differently. `buildMediaApiAttr()` used `sites.external_id`;
 * `attachTileMediaTokens()` used `uri.split('/')[3]`. They disagree for
 * 49,249 production recordings across 11 sites (measured 2026-08-10):
 * external_id can be stale (site aggregates several stream deployments), NULL
 * (never backfilled), the literal string 'undefined' (failed ingest), or name
 * a soft-deleted stream. A bulk join of every divergent recording's
 * uri-filename UUID against core `stream_segments` proved the segment is owned
 * by the URI's stream — never external_id's — for 100% of rows with segments.
 *
 * THE FIX: one derivation — `mediaStreamId(uri, externalId)` in
 * app/utils/asset-url.js — uri-segment first (shape-validated), external_id
 * fallback, 'undefined' never usable. Every URL builder now flows through it.
 *
 * WHY REAL FUNCTIONS + REAL ROW SHAPES: the fixtures below are the actual
 * production shapes of the 11 affected sites (ids included, values verbatim
 * from the 2026-08-10 measurement). The harness calls the REAL exported
 * functions, and includes CONTROLS that assert the OLD behaviour would fail —
 * so it fails on any revert to external_id-first ("tidying" this back is the
 * standing risk the fix's comments warn about).
 */
process.env.STREAM_TOKEN_SALT = process.env.STREAM_TOKEN_SALT || 'test_salt_stream_id_harness';

const assert = require('assert');
const { mediaStreamId, roiSpectrogramUrl } = require('../../app/utils/asset-url');
const recordings = require('../../app/model/recordings');

let passed = 0;
function ok (name, fn) { fn(); passed++; console.log('  ok -', name); }

console.log('media-stream-id harness');

// ---------------------------------------------------------------- fixtures
// Real production shapes (2026-08-10 measurement, OPEN-ITEMS #107):
const CASES = [
    // site 8062 nahuelbuta: stale external_id (points at 0-segment sibling)
    { site: 8062,  uri: '2015/01/01/3qxwx34vyovi/a35152a4-73a6-44f2-b874-3c4893268458.opus',
      external_id: 'rj83wlyqyx3d', want: '3qxwx34vyovi' },
    // site 31491 workshop-arbimon: NULL external_id
    { site: 31491, uri: '2021/04/12/WGwJJYGoDZrt/01156080-9496-4165-a652-103c464da248.flac',
      external_id: null, want: 'WGwJJYGoDZrt' },
    // site 43570: the literal STRING 'undefined' — truthy, must never win
    { site: 43570, uri: '2023/07/21/undefined/undefined.flac',
      external_id: 'undefined', want: null },
    // site 43570's one good recording: valid uri beats the bad external_id
    { site: 43570, uri: '2022/05/18/selblm7pnz1n/a4f49c20-bb8d-407e-8273-51cbcaf578b1.flac',
      external_id: 'undefined', want: 'selblm7pnz1n' },
    // site 36114 tech4nature: external_id names a soft-deleted stream
    { site: 36114, uri: '2022/07/20/p2gi3vshr6k0/07f52877-5bfd-4541-bffc-1ba7fc13ed24.flac',
      external_id: 'tz0xjytraxag', want: 'p2gi3vshr6k0' },
    // the 99.983% case: both agree — derivation change is a no-op
    { site: 0, uri: '2022/02/10/s4dcrtuk5gfi/aaaaaaaa-0000-0000-0000-000000000000.flac',
      external_id: 's4dcrtuk5gfi', want: 's4dcrtuk5gfi' },
];

ok('mediaStreamId: every production divergence case resolves to the URI stream', function () {
    for (const c of CASES) {
        assert.strictEqual(mediaStreamId(c.uri, c.external_id), c.want,
            `site ${c.site}: uri=${c.uri} ext=${c.external_id}`);
    }
});

ok('mediaStreamId: legacy project_* uri falls back to external_id', function () {
    assert.strictEqual(mediaStreamId('project_123/site_1/x.flac', 'realid99'), 'realid99');
    assert.strictEqual(mediaStreamId('project_123/site_1/x.flac', null), null);
});

ok('mediaStreamId: non-standard uri shape cannot nominate a bogus segment', function () {
    // a malformed uri must not yield a date fragment / filename as stream id
    assert.strictEqual(mediaStreamId('2022/07/20', 'fallback1'), 'fallback1');
    assert.strictEqual(mediaStreamId('not/a/date/shape/file.flac', 'fallback2'), 'fallback2');
    assert.strictEqual(mediaStreamId(null, 'fallback3'), 'fallback3');
    assert.strictEqual(mediaStreamId(undefined, undefined), null);
});

// ---------------------------------------------------------------- the REAL builder
ok('buildMediaApiAttr derives from the uri, not external_id (all asset types)', function () {
    const rec = {
        uri: '2015/01/01/3qxwx34vyovi/a35152a4-73a6-44f2-b874-3c4893268458.opus',
        external_id: 'rj83wlyqyx3d',   // the STALE value — must not appear
        datetime: '2015-01-01 00:02:43', datetime_utc: '2015-01-01 00:02:43', duration: 90
    };
    for (const [type, opts] of [['spectro', {}], ['audio', {}],
        ['template', { minFreq: 100, maxFreq: 2000, trim: { from: 1, to: 3 } }]]) {
        const attr = recordings.buildMediaApiAttr(rec, type, opts);
        assert.ok(attr.startsWith('3qxwx34vyovi_t'), `${type}: got ${attr}`);
        assert.ok(attr.indexOf('rj83wlyqyx3d') === -1, `${type}: stale id leaked into ${attr}`);
    }
});

ok('CONTROL: the OLD external_id-first derivation FAILS this harness', function () {
    // Re-create the pre-fix behaviour and assert the harness would catch it.
    // If someone "simplifies" mediaStreamId back to `externalId || uriSeg`,
    // this control documents exactly which production rows break.
    const oldDerivation = function (rec) { return rec.external_id; };
    const rec = CASES[0]; // nahuelbuta
    assert.notStrictEqual(oldDerivation(rec), mediaStreamId(rec.uri, rec.external_id),
        'old and new derivations must disagree on the divergent fixtures — ' +
        'if they agree, the fixtures no longer exercise the defect');
    // and the truthy-'undefined' trap:
    const bad = { external_id: 'undefined' };
    assert.strictEqual(oldDerivation(bad), 'undefined', 'control precondition');
    assert.strictEqual(mediaStreamId('2023/07/21/undefined/undefined.flac', 'undefined'), null,
        "the literal string 'undefined' must never be used as a stream id");
});

// ---------------------------------------------------------------- roiSpectrogramUrl
ok('roiSpectrogramUrl prefers recUri, keeps externalId fallback', function () {
    const base = {
        datetimeUtc: '2022-06-05 17:05:00', timeMin: 1.5, timeMax: 3.25,
        freqMin: 200, freqMax: 8000, sampleRate: 48000
    };
    const withUri = roiSpectrogramUrl({ ...base,
        recUri: '2022/06/05/tjqpfo6tujqv/01242685-a42e-4faa-9567-37af5c033185.flac',
        externalId: 'suqvtulc2n80' });
    assert.ok(withUri && withUri.indexOf('tjqpfo6tujqv_t') !== -1, 'uri stream must win: ' + withUri);
    assert.ok(withUri.indexOf('suqvtulc2n80') === -1, 'stale id leaked: ' + withUri);
    // no recUri projected (old callers / partial rows): externalId still works
    const fallback = roiSpectrogramUrl({ ...base, externalId: 'suqvtulc2n80' });
    assert.ok(fallback && fallback.indexOf('suqvtulc2n80_t') !== -1, 'fallback broken: ' + fallback);
    // neither: null (renders keep the stored PNG — the settled fail-soft shape)
    assert.strictEqual(roiSpectrogramUrl({ ...base }), null);
    // 'undefined' externalId with no uri: null, not a signed 'undefined' URL
    assert.strictEqual(roiSpectrogramUrl({ ...base, externalId: 'undefined' }), null);
});

ok('agreeing-corpus invariant: when uri seg == external_id the URL is unchanged', function () {
    const base = {
        datetimeUtc: '2022-02-10 23:21:00', timeMin: 0.5, timeMax: 2.5,
        freqMin: 100, freqMax: 4000, sampleRate: 24000
    };
    const withBoth = roiSpectrogramUrl({ ...base,
        recUri: '2022/02/10/s4dcrtuk5gfi/aaaaaaaa-0000-0000-0000-000000000000.flac',
        externalId: 's4dcrtuk5gfi' });
    const extOnly = roiSpectrogramUrl({ ...base, externalId: 's4dcrtuk5gfi' });
    assert.strictEqual(withBoth, extOnly,
        '99.983% of the corpus agrees — for those rows the fix must be a byte-identical no-op');
});

console.log(`\n${passed} checks passed`);