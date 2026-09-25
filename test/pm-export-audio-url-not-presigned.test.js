var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARD: pattern-matching exports must NOT embed raw storage presigned URLs.
 *
 * Measured on live prod 2026-09-24 (rfcx-local
 * runbooks/FINDING-2026-09-24-export-audio-url-signature-not-enforced.md): the PM
 * export's `audio_url` / `url` columns were `https://s3.arbimon.org/<bucket>/<key>?
 * AWSAccessKeyId=..&Expires=..&Signature=..`, and our storage chain (s3-proxy ->
 * s3-reader) ignores the caller's signature. A tampered signature, Expires=1, and
 * a stripped query string all returned 200: permanent anonymous links to
 * private-project audio.
 *
 * v2 (operator, 2026-09-24 21:39): the link is a media-api WAV of the whole
 * recording, signed with a stream-token whose `exp` = 7 days (the archive
 * link's lifetime). It falls back to the auth-gated legacy download route when
 * media-api can't serve it (legacy project_ uploads, windows > 15 min).
 *
 * NOTE (harness): chai 3.5's `expect(bigString).to.not.match(re)` did NOT fail
 * against the pre-fix source in this repo's mocha (measured 2026-09-24), so the
 * source assertions below are written as `expect(re.test(src)).to.equal(false)`.
 */
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SALT = 'test-salt-not-a-secret';
const WEEK = 7 * 24 * 3600;

function load () {
    // fresh modules so the salt env below applies
    delete require.cache[require.resolve('../app/utils/asset-url')];
    delete require.cache[require.resolve('../app/utils/recording-download-url')];
    return { du: require('../app/utils/recording-download-url'), au: require('../app/utils/asset-url') };
}

describe('PM export audio links', function () {
    let saved;
    before(function () { saved = process.env.STREAM_TOKEN_SALT; process.env.STREAM_TOKEN_SALT = SALT; });
    after(function () { if (saved === undefined) delete process.env.STREAM_TOKEN_SALT; else process.env.STREAM_TOKEN_SALT = saved; });

    const rec = { recording_id: 277374854, uri: '2025/09/01/zqsf5cvopxw7/07144072-ee6e-4ed8-bc9a-2571ebb64057.flac',
        datetime: '2025-09-01 08:25:01', datetime_utc: '2025-09-01 12:25:01', duration: 59, external_id: 'zqsf5cvopxw7' };

    it('builds a media-api WAV link for the whole recording', function () {
        const { du } = load();
        const u = du.exportAudioUrl('https://arbimon.org', 'juan-fernandez-islands-birds', rec);
        expect(u.indexOf('https://arbimon.org/media-api/internal/assets/streams/zqsf5cvopxw7_t20250901T122501000Z.20250901T122600000Z_rfull_g1_fwav.wav?stream-token=')).to.equal(0);
    });

    it('signs a 7-day exp (bucketed up to the hour) -- the archive link lifetime, not the 6 h UI default', function () {
        const { du } = load();
        const now = Math.floor(Date.now() / 1000);
        const exp = Number(/[?&]exp=(\d+)/.exec(du.exportAudioUrl('https://arbimon.org', 'p', rec))[1]);
        expect(exp % 3600).to.equal(0);
        expect(exp >= now + WEEK).to.equal(true);
        expect(exp <= now + WEEK + 3600).to.equal(true);
    });

    it('the signature covers exactly that window + exp (verifier-side re-derivation)', function () {
        const { du, au } = load();
        const u = du.exportAudioUrl('https://arbimon.org', 'p', rec);
        const tok = /stream-token=([0-9a-f]{64})/.exec(u)[1];
        const exp = Number(/[?&]exp=(\d+)/.exec(u)[1]);
        const start = Date.UTC(2025, 8, 1, 12, 25, 1);
        expect(tok).to.equal(au.mediaStreamToken('zqsf5cvopxw7', start, start + 59000, exp));
    });

    it('UI surfaces keep the 6 h default (mediaAssetExpiry() with no argument)', function () {
        const { au } = load();
        const now = Math.floor(Date.now() / 1000);
        const exp = au.mediaAssetExpiry();
        expect(exp <= now + 6 * 3600 + 3600).to.equal(true);
        expect(exp >= now + 6 * 3600).to.equal(true);
    });

    it('fractional durations: filename window and signed window never drift (fuzz)', function () {
        const { du, au } = load();
        for (let i = 0; i < 400; i++) {
            const d = Math.round((0.5 + Math.random() * 899) * 1e4) / 1e4; // up to 4 dp, < 15 min
            const r = Object.assign({}, rec, { duration: d });
            const u = du.exportAudioUrl('https://arbimon.org', 'p', r);
            const m = /_t(\d{8}T\d{9})Z\.(\d{8}T\d{9})Z_/.exec(u);
            const toMs = (g) => Date.UTC(+g.slice(0, 4), +g.slice(4, 6) - 1, +g.slice(6, 8), +g.slice(9, 11), +g.slice(11, 13), +g.slice(13, 15), +g.slice(15, 18));
            const exp = Number(/[?&]exp=(\d+)/.exec(u)[1]);
            const tok = /stream-token=([0-9a-f]{64})/.exec(u)[1];
            // media-api re-derives start/end FROM THE FILENAME; it must reproduce the token.
            expect(tok, 'duration ' + d).to.equal(au.mediaStreamToken('zqsf5cvopxw7', toMs(m[1]), toMs(m[2]), exp));
        }
    });

    it('falls back to the auth-gated route: legacy project_ upload, > 15 min, no salt', function () {
        const { du } = load();
        const gated = 'https://arbimon.org/legacy-api/project/p/recordings/download/277374854';
        expect(du.exportAudioUrl('https://arbimon.org', 'p', Object.assign({}, rec, { uri: 'project_1/site_2/2020/1/x.flac', external_id: null }))).to.equal(gated);
        expect(du.exportAudioUrl('https://arbimon.org', 'p', Object.assign({}, rec, { duration: 901 }))).to.equal(gated);
        delete process.env.STREAM_TOKEN_SALT;
        try { expect(load().du.exportAudioUrl('https://arbimon.org', 'p', rec)).to.equal(gated); }
        finally { process.env.STREAM_TOKEN_SALT = SALT; }
    });

    it('never produces a storage host or an S3 signature', function () {
        const { du } = load();
        const u = du.exportAudioUrl('https://arbimon.org', 'p', rec);
        expect(/s3\.|AWSAccessKeyId|Signature=|X-Amz-/.test(u)).to.equal(false);
    });

    it('recordingDownloadUrl (fallback) is unchanged', function () {
        const { du } = load();
        expect(du.recordingDownloadUrl('https://arbimon.org/', 'p', 1)).to.equal('https://arbimon.org/legacy-api/project/p/recordings/download/1');
        expect(du.recordingDownloadUrl('https://arbimon.org', '', 1)).to.equal(null);
    });

    // 2026-09-24 21:56: #1947 shipped getRecordingsForAudioUrls WITHOUT exporting it,
    // so every PM export would have thrown 'is not a function' (caught in-pod BEFORE any
    // export ran). The source-text checks below could not see it; this loads the REAL
    // modules the job requires and checks every name it destructures actually exists.
    it('every name pattern-matching.js destructures from a local module is exported', function () {
        const jobDir = path.join(ROOT, 'jobs/arbimon-recording-export-job');
        const src = read('jobs/arbimon-recording-export-job/pattern-matching.js');
        const re = /const \{([^}]+)\} = require\('(\.[^']+)'\)/g;
        // Stub the DB facade (jobs/ is its own npm package; `pg` is not in the root
        // node_modules) so this checks the EXPORT LIST only, never a connection.
        const dbPath = require.resolve(path.join(ROOT, 'jobs/db/backend'));
        const saved = require.cache[dbPath];
        require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getConnection () {}, readQuery () {}, writerQuery () {} } };
        let m, checked = 0;
        try {
        while ((m = re.exec(src))) {
            const modPath = require.resolve(path.join(jobDir, m[2]));
            // services with DB-only deps (the facade is stubbed); file-helper needs `archiver` (jobs-only npm) -> skip
            if (!/jobs\/services\/(recordings|pattern-matching)\.js$/.test(modPath)) continue;
            delete require.cache[modPath];
            const mod = require(modPath);
            for (const name of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
                expect(typeof mod[name], m[2] + ' exports ' + name).to.not.equal('undefined');
                checked++;
            }
        }
        } finally { if (saved) require.cache[dbPath] = saved; else delete require.cache[dbPath]; }
        expect(checked > 0, 'parsed at least one destructured require').to.equal(true);
    });

    it('queued PM zip export emits exportAudioUrl, never presigns', function () {
        const src = read('jobs/arbimon-recording-export-job/pattern-matching.js');
        expect(/getSignedUrl/.test(src), 'job file still calls getSignedUrl').to.equal(false);
        expect(/exportAudioUrl\(config_hosts\.publicUrl, projectUrl, rec\)/.test(src), 'job uses exportAudioUrl').to.equal(true);
    });

    it('per-job PM CSV route emits exportAudioUrl, never presigns', function () {
        const src = read('app/routes/data-api/project/pattern_matchings.js');
        expect(/patternMatchings\.getSignedUrl/.test(src), 'route still presigns').to.equal(false);
        expect(/exportAudioUrl\(publicUrl, projectUrl, r\)/.test(src), 'route uses exportAudioUrl').to.equal(true);
    });
});