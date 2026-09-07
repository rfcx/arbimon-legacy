/**
 * Harness for the media pre-warm PRODUCER (app/utils/prewarm.js) — rfcx-local
 * OPEN-ITEMS §217 step 2.
 *
 * What it pins (each is a rule the module's header comment earns):
 *   1. INERT without BOTH env vars — publishUrls is a no-op, no client is
 *      ever created (no `redis` require side effects in the request path).
 *   2. attrsForListRow mints the SAME two attrs the app requests for a list
 *      row — thumbnail `z95_wdolph_g1_fspec_mtrue_d420.154.png` and base
 *      spectrogram `rfull_g1_fspec_mtrue_d<W>.255_wdolph_z120.png` — through
 *      the REAL mediaAssetUrl / mediaStreamId / specWidthForDuration, so the
 *      names are byte-identical to the app's own (canonical cache key).
 *   3. MUST-RETAIN: a row with no usable stream id or no datetime_utc yields
 *      [] (never a hand-built fallback name; never a TZ-shifted `datetime`).
 *   4. The pushed payload shape is exactly {"urls":[...]} with dedupe, and
 *      the module NEVER throws or rejects into the caller for any input.
 *   5. Width is duration-aware (short recordings do NOT get d10286).
 *
 * Run: node test/prewarm-producer/harness.js
 * (No redis needed: the enabled path is exercised with a stub `redis` module
 *  injected via require.cache; the inert path is the default.)
 */
process.env.STREAM_TOKEN_SALT = process.env.STREAM_TOKEN_SALT || 'test_salt_prewarm_harness';
delete process.env.PREWARM_REDIS_URL;
delete process.env.PREWARM_REDIS_LIST;

const assert = require('assert');
const path = require('path');

const { mediaAssetUrl, mediaStreamId } = require('../../app/utils/asset-url');
const recordings = require('../../app/model/recordings');
const deps = {
    mediaAssetUrl,
    mediaStreamId,
    specWidthForDuration: (d) => recordings.specWidthForDuration(d)
};

let passed = 0;
function ok(name, fn) {
    try { fn(); passed += 1; console.log('  PASS', name); }
    catch (e) { console.log('  FAIL', name, '\n     ', e && e.message); process.exitCode = 1; }
}

// ---------------------------------------------------------------- 1. INERT
console.log('inert (no config)');
const prewarmPath = require.resolve('../../app/utils/prewarm');
delete require.cache[prewarmPath];
const inert = require('../../app/utils/prewarm');
ok('enabled=false without env', () => assert.strictEqual(inert.enabled, false));
ok('publishUrls is a silent no-op', () => {
    assert.strictEqual(inert.publishUrls(['a']), undefined);
    assert.strictEqual(inert.stats.pushed, 0);
    assert.strictEqual(inert.stats.dropped, 0);
});
ok('redis module never loaded by the inert path', () => {
    const loaded = Object.keys(require.cache).some((k) => /node_modules\/redis\/dist\/index\.js$/.test(k));
    assert.strictEqual(loaded, false, 'redis was required despite being inert');
});

// -------------------------------------------------- 2. real attrs, real row
console.log('attrsForListRow (real functions, real row shape)');
// Modern row exactly as findByUrlMatch's list output carries it after the
// site merge (site_external_id set, datetime_utc a JS Date via parseUtcDatetime).
// URI in the REAL modern shape `YYYY/MM/DD/<streamId>/<uuid>.<ext>`
// (STREAM_URI_SHAPE in asset-url.js) — a synthetic shape here silently
// falls through to the external_id path and mis-states the uri-first test.
const modern = {
    recording_id: 289133393,
    uri: '2025/08/21/8e1f4b1d3d5c/1f0c5d3a-2b7e-4c8d-9e1f-0a1b2c3d4e5f.flac',
    site_id: 87454,
    site_external_id: '8e1f4b1d3d5c',
    datetime_utc: new Date('2025-08-21T10:15:00.000Z'),
    duration: 60
};
const attrs = inert.attrsForListRow(modern, deps);
ok('two attrs per row (thumbnail + base spectrogram)', () => assert.strictEqual(attrs.length, 2));
ok('thumbnail attr == what __compute_thumbnail_path_async mints', () => {
    const expect = mediaAssetUrl('8e1f4b1d3d5c', Date.UTC(2025, 7, 21, 10, 15, 0), Date.UTC(2025, 7, 21, 10, 16, 0),
        'z95_wdolph_g1_fspec_mtrue_d420.154.png').attr;
    assert.strictEqual(attrs[0], expect);
    assert.ok(/_z95_wdolph_g1_fspec_mtrue_d420\.154\.png$/.test(attrs[0]), attrs[0]);
});
ok('base spectrogram attr == buildMediaApiAttr(spectro) for the same row', () => {
    const viaApp = recordings.buildMediaApiAttr(
        Object.assign({}, modern, { external_id: modern.site_external_id }), 'spectro', {});
    assert.strictEqual(attrs[1], viaApp);
    assert.ok(/rfull_g1_fspec_mtrue_d10286\.255_wdolph_z120\.png$/.test(attrs[1]), attrs[1]);
});
ok('stream id is uri-first (external_id stale/undefined does not win)', () => {
    const stale = Object.assign({}, modern, { site_external_id: 'undefined' });
    const a = inert.attrsForListRow(stale, deps);
    assert.strictEqual(a.length, 2);
    assert.ok(a[0].startsWith('8e1f4b1d3d5c_t'), a[0]);
});

// ----------------------------------------------------------- 3. must-retain
console.log('must-retain rows yield nothing');
ok('no datetime_utc => [] (no `datetime` fallback)', () => {
    const legacy = { uri: 'project_123/site_45/2015/03/file.flac', site_external_id: null,
        datetime: new Date('2015-03-01T00:00:00Z'), datetime_utc: null, duration: 60 };
    assert.deepStrictEqual(inert.attrsForListRow(legacy, deps), []);
});
ok('no usable stream id => []', () => {
    const noStream = { uri: 'project_123/site_45/2015/03/file.flac', site_external_id: 'undefined',
        datetime_utc: new Date('2015-03-01T00:00:00Z'), duration: 60 };
    assert.deepStrictEqual(inert.attrsForListRow(noStream, deps), []);
});
ok('invalid Date datetime_utc => []', () => {
    // what a garbage/zero-date column yields after the mysql typeCast: an
    // Invalid Date object (not a string), so moment.utc gives NaN.
    const bad = Object.assign({}, modern, { datetime_utc: new Date(NaN) });
    assert.deepStrictEqual(inert.attrsForListRow(bad, deps), []);
});
ok('null / undefined row => [] (never throws)', () => {
    assert.deepStrictEqual(inert.attrsForListRow(null, deps), []);
    assert.deepStrictEqual(inert.attrsForListRow(undefined, deps), []);
});

// --------------------------------------------- 5. duration-aware base width
console.log('duration-aware width');
ok('1 s recording gets a narrow base spectrogram, not d10286', () => {
    const short = Object.assign({}, modern, { duration: 1.02 });
    const a = inert.attrsForListRow(short, deps);
    const m = /_d(\d+)\.255_/.exec(a[1]);
    assert.ok(m && Number(m[1]) < 10286, a[1]);
    assert.strictEqual(Number(m[1]), recordings.specWidthForDuration(1.02));
});
ok('null duration still mints (0-length window, like the thumbnail path)', () => {
    const nodur = Object.assign({}, modern, { duration: null });
    const a = inert.attrsForListRow(nodur, deps);
    assert.strictEqual(a.length, 2);
    assert.ok(/_t20250821T101500000Z\.20250821T101500000Z_/.test(a[0]), a[0]);
});

// -------------------------------------------- 4. enabled path with a stub
console.log('enabled path (stub redis injected)');
const calls = [];
const stubRedis = {
    createClient(opts) {
        assert.strictEqual(opts.legacyMode, true, 'must create legacyMode client');
        assert.strictEqual(opts.name, undefined, 'must NOT set client name (CLIENT SETNAME is NOPERM for the scoped user)');
        assert.strictEqual(opts.disableOfflineQueue, true);
        const handlers = {};
        const c = {
            isOpen: false,
            on(ev, fn) { handlers[ev] = fn; return c; },
            connect() { c.isOpen = true; return Promise.resolve(); },
            disconnect() { c.isOpen = false; return Promise.resolve(); },
            // legacy-mode shape: bare methods are callback-form -> undefined
            lPush() { calls.push(['BARE-lPush']); return undefined; },
            v4: {
                lPush(k, v) { calls.push(['lPush', k, v]); return Promise.resolve(1); },
                lTrim(k, a, b) { calls.push(['lTrim', k, a, b]); return Promise.resolve('OK'); }
            }
        };
        return c;
    }
};
const redisPath = require.resolve('redis');
const savedRedis = require.cache[redisPath];
require.cache[redisPath] = { id: redisPath, filename: redisPath, loaded: true, exports: stubRedis };
process.env.PREWARM_REDIS_URL = 'redis://prewarm_producer:x@127.0.0.1:6399';
process.env.PREWARM_REDIS_LIST = 'prewarm:media:urls';
process.env.PREWARM_LIST_CAP = '5';
delete require.cache[prewarmPath];
const live = require('../../app/utils/prewarm');

(async () => {
    ok('enabled=true with both env vars', () => assert.strictEqual(live.enabled, true));
    live.publishUrls(['b', 'a', 'b', '', 42, null]);
    await new Promise((r) => setTimeout(r, 20));
    ok('one LPUSH per publish, via client.v4, payload {"urls":[...]} deduped + cleaned', () => {
        const push = calls.find((c) => c[0] === 'lPush');
        assert.ok(push, 'no v4.lPush call');
        assert.strictEqual(push[1], 'prewarm:media:urls');
        assert.deepStrictEqual(JSON.parse(push[2]), { urls: ['b', 'a'] });
        assert.ok(!calls.some((c) => c[0] === 'BARE-lPush'), 'used the bare (callback) lPush — silent no-op in legacyMode');
    });
    ok('LTRIM follows every push with the configured cap', () => {
        const trim = calls.find((c) => c[0] === 'lTrim');
        assert.deepStrictEqual(trim, ['lTrim', 'prewarm:media:urls', 0, 4]);
    });
    ok('empty / all-invalid input sends nothing', () => {
        const before = calls.length;
        live.publishUrls([]); live.publishUrls(['', 7]); live.publishUrls('nope'); live.publishUrls(undefined);
        assert.strictEqual(calls.length, before);
    });
    ok('stats count pushes', () => assert.strictEqual(live.stats.pushed, 1));

    // failure containment: a rejecting v4 call must be swallowed, never surface
    const failing = stubRedis.createClient({ legacyMode: true, disableOfflineQueue: true });
    failing.v4.lPush = () => Promise.reject(new Error('NOPERM simulated'));
    // swap the cached client by forcing a reconnect through a fresh module instance
    delete require.cache[prewarmPath];
    const stub2 = { createClient() { failing.isOpen = false; return failing; } };
    require.cache[redisPath].exports = stub2;
    const live2 = require('../../app/utils/prewarm');
    let threw = false;
    try { live2.publishUrls(['x']); } catch (_) { threw = true; }
    await new Promise((r) => setTimeout(r, 20));
    ok('a rejecting LPUSH is swallowed (no throw, no unhandled rejection), counted as dropped', () => {
        assert.strictEqual(threw, false);
        assert.strictEqual(live2.stats.dropped, 1);
        assert.strictEqual(live2.stats.errors, 1);
    });

    // restore
    if (savedRedis) require.cache[redisPath] = savedRedis; else delete require.cache[redisPath];
    console.log(`\n${passed} assertions passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
})();
process.on('unhandledRejection', (e) => { console.log('  FAIL unhandled rejection escaped the module:', e && e.message); process.exitCode = 1; });