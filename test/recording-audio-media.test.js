process.env.STREAM_TOKEN_SALT = process.env.STREAM_TOKEN_SALT || 'test_salt_recording_audio_media';

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

/**
 * Visualizer playback DIRECT to media-api (rfcx-local 2026-10-15; operator goifirr 16:58).
 * `recordings/info` carries `audioMedia: { base, token, exp }`; the SPA appends the render asset.
 *
 * The property that matters most: the window minted here MUST be byte-identical to the window legacy's own audio route
 * asks media-api to render (buildMediaApiAttr). media-api re-derives the signed window from the filename, so any drift
 * is a guaranteed 401 — and a different window would be different audio.
 */
var { recordingAudioMedia, MEDIA_API_MAX_WINDOW_MS } = require('../app/utils/recording-audio-media');
var recordings = require('../app/model/recordings');

function rec (o) {
    return Object.assign({
        id: 311656583,
        uri: '2026/07/25/4irtfas19dus/10d0f31b-d547-41bd-90a4-e0198cf819d6.flac',
        datetime_utc: '2026-07-25T02:40:00.000Z',
        datetime: '2026-07-25T12:40:00.000Z',
        duration: 60.032,
        external_id: '4irtfas19dus'
    }, o || {});
}

// legacy's attr for a plain play, minus the asset: `<stream>_t<s>Z.<e>Z_`
function legacyWindowPrefix (r) {
    var attr = recordings.buildMediaApiAttr(r, 'audio', {});
    expect(attr.endsWith('rfull_g1_fmp3.mp3')).to.equal(true);
    return attr.slice(0, attr.length - 'rfull_g1_fmp3.mp3'.length);
}

describe('recordingAudioMedia (visualizer playback via media-api)', function() {
    it('returns base/token/exp for a stream recording; base is the media-api path WITHOUT an asset', function() {
        var m = recordingAudioMedia(rec());
        expect(m).to.be.an('object');
        expect(m.base).to.match(/^\/media-api\/internal\/assets\/streams\/4irtfas19dus_t20260725T024000000Z\.20260725T024100032Z_$/);
        expect(m.token).to.match(/^[0-9a-f]{64}$/);
        expect(m.exp).to.be.a('number');
        expect(m.exp % 3600).to.equal(0); // hour-bucketed like every UI mint
    });

    it('🔴 the signed window equals the window legacy\'s audio route renders (prod sample + edge durations)', function() {
        var shapes = [
            rec(), // the 10-15 support case, measured live: same window string
            rec({ duration: 0.963, datetime_utc: '2025-11-02T23:59:59.500Z' }),
            rec({ duration: 600.02 }), // the max duration in a 1 % prod sample
            rec({ duration: 59.99999 }),
            rec({ duration: 1.0005, datetime_utc: '1981-06-01T00:00:00.000Z' }) // faithful old RTC-default date
        ];
        shapes.forEach(function (r) {
            var m = recordingAudioMedia(r);
            expect(m, JSON.stringify(r)).to.not.equal(null);
            expect(m.base.replace('/media-api/internal/assets/streams/', '')).to.equal(legacyWindowPrefix(r));
        });
    });

    it('the token is the one media-api will verify for exactly that window (sha256 of salt + stream_start_end_exp)', function() {
        var r = rec();
        var m = recordingAudioMedia(r);
        var startMs = Date.parse(r.datetime_utc);
        var endMs = startMs + 60032;
        var expected = crypto.createHash('sha256').update(process.env.STREAM_TOKEN_SALT + '4irtfas19dus_' + startMs + '_' + endMs + '_' + m.exp, 'utf8').digest('hex');
        expect(m.token).to.equal(expected);
    });

    it('uses the URI stream, never a stale external_id (OPEN-ITEMS #107 class)', function() {
        var m = recordingAudioMedia(rec({ external_id: 'rj83wlyqyx3d' }));
        expect(m.base).to.contain('/4irtfas19dus_t');
        expect(m.base).to.not.contain('rj83wlyqyx3d');
    });

    it('null for legacy project_* recordings (no core stream) — the client keeps audioUrl', function() {
        expect(recordingAudioMedia(rec({ uri: 'project_38/site_211/2015/2/T34_20150225_190000.flac', external_id: null }))).to.equal(null);
    });

    it('null for a window media-api will not render (> 15 min)', function() {
        expect(MEDIA_API_MAX_WINDOW_MS).to.equal(15 * 60 * 1000);
        expect(recordingAudioMedia(rec({ duration: 900 }))).to.not.equal(null);
        expect(recordingAudioMedia(rec({ duration: 900.001 }))).to.equal(null);
    });

    it('null (never throws) for missing / implausible timestamps or durations', function() {
        expect(recordingAudioMedia(rec({ datetime_utc: null, datetime: null }))).to.equal(null);
        expect(recordingAudioMedia(rec({ datetime_utc: '0172-01-01T00:00:00Z' }))).to.equal(null); // MariaDB zero-date shape
        expect(recordingAudioMedia(rec({ duration: 0 }))).to.equal(null);
        expect(recordingAudioMedia(rec({ duration: 'x' }))).to.equal(null);
        expect(recordingAudioMedia(null)).to.equal(null);
        expect(recordingAudioMedia(rec({ uri: 'not/a/stream' }))).to.equal(null);
    });

    it('falls back to datetime only when datetime_utc is absent (same precedence as buildMediaApiAttr)', function() {
        var r = rec({ datetime_utc: null });
        expect(recordingAudioMedia(r).base.replace('/media-api/internal/assets/streams/', '')).to.equal(legacyWindowPrefix(r));
    });
});

describe('recordings/info carries audioMedia', function() {
    var src = fs.readFileSync(path.join(__dirname, '..', 'app/routes/data-api/project/recordings.js'), 'utf8');
    var info = src.slice(src.indexOf("case 'info'"), src.indexOf("case 'audio'"));
    it('attaches it on the info payload, and KEEPS audioUrl as the client fallback', function() {
        expect(info).to.contain('rec.audioMedia = recordingAudioMedia(rec);');
        expect(info).to.contain('recording.audioUrl = ');
        expect(info.indexOf('rec.audioMedia = ')).to.be.lessThan(info.indexOf('res.json(rec)'));
    });
});