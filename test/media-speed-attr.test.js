/**
 * Playback speed on the visualizer audio route (rfcx-local 2026-09-28).
 *
 * The route passes `req.query` to fetchAudioFile; buildMediaApiAttr must turn `speed` into media-api's
 * `_x<int %>` token (rfcx/rfcx-api #699/#700) ONLY for audio and ONLY for a valid 5..1600 value that is not 100.
 * Everything else must produce exactly today's attr -- that is what keeps every existing media-api URL and
 * every tmpfilecache key byte-identical (the cache key is sha256(attr)).
 */
process.env.STREAM_TOKEN_SALT = process.env.STREAM_TOKEN_SALT || 'test_salt_speed';

const assert = require('assert');
const recordings = require('../app/model/recordings');

const REC = {
    id: 311375998,
    uri: '2025/08/17/z31eluwckmtx/8e5cdc86-7598-4226-9ae5-660c535f8fb5.flac',
    external_id: 'z31eluwckmtx',
    datetime_utc: '2025-08-17T01:00:00.000Z',
    duration: 60,
};

describe('media-api playback speed (x) attr', function () {
    const base = recordings.buildMediaApiAttr(REC, 'audio', {});

    it('no speed / 100 => byte-identical to today (cache key unchanged)', function () {
        assert.strictEqual(base, 'z31eluwckmtx_t20250817T010000000Z.20250817T010100000Z_rfull_g1_fmp3.mp3');
        for (const sp of [undefined, '100', 100]) {
            assert.strictEqual(recordings.buildMediaApiAttr(REC, 'audio', { speed: sp }), base);
        }
        assert.strictEqual(
            recordings.buildAssetCacheKey(REC, recordings.buildMediaApiAttr(REC, 'audio', { speed: '100' }), '.mp3'),
            recordings.buildAssetCacheKey(REC, base, '.mp3'));
    });

    it('🔴 a valid speed adds _x<n> before the format token and changes the cache key', function () {
        const a = recordings.buildMediaApiAttr(REC, 'audio', { speed: '5' });
        assert.strictEqual(a, 'z31eluwckmtx_t20250817T010000000Z.20250817T010100000Z_rfull_g1_x5_fmp3.mp3');
        assert.notStrictEqual(recordings.buildAssetCacheKey(REC, a, '.mp3'), recordings.buildAssetCacheKey(REC, base, '.mp3'));
        assert.ok(recordings.buildMediaApiAttr(REC, 'audio', { speed: '1600' }).includes('_g1_x1600_fmp3'));
    });

    it('combines with gain, band and wav in media-api token order', function () {
        const a = recordings.buildMediaApiAttr(REC, 'audio', { speed: '25', gain: '5', minFreq: '1000', maxFreq: '8000', format: '.wav' });
        assert.ok(/_r1000\.8000_g5_x25_fwav\.wav$/.test(a), a);
    });

    it('invalid / out-of-UI-range speeds fall back to the original (never break playback)', function () {
        for (const sp of ['0', '4', '1601', '99999', '-5', '5.5', '1e2', 'abc', '', ' 5', ['5', '10'], {}, null]) {
            assert.strictEqual(recordings.buildMediaApiAttr(REC, 'audio', { speed: sp }), base, JSON.stringify(sp));
        }
    });

    it('speed never leaks into spectrogram or template attrs', function () {
        assert.strictEqual(recordings.buildMediaApiAttr(REC, 'spectro', { speed: '5' }), recordings.buildMediaApiAttr(REC, 'spectro', {}));
        const t = { minFreq: 1000, maxFreq: 2000, trim: { from: 1, to: 2 } };
        assert.strictEqual(recordings.buildMediaApiAttr(REC, 'template', Object.assign({ speed: '5' }, t)), recordings.buildMediaApiAttr(REC, 'template', t));
    });

    it('trim windows (ROI clips) carry the speed too', function () {
        const a = recordings.buildMediaApiAttr(REC, 'audio', { speed: '10', trim: { from: 5, to: 7 } });
        assert.ok(/_t20250817T010005000Z\.20250817T010007000Z_rfull_g1_x10_fmp3\.mp3$/.test(a), a);
    });
});