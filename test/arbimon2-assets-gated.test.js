var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARD (2026-09-24): no legacy code path may hand a browser a public
 * `https://s3.arbimon.org/arbimon2/<key>` URL.
 *
 * That host is our storage chain, which serves any key to anyone (it ignores S3
 * signatures). Measured 7 d to 2026-09-24: 1,471 anonymous 200s for arbimon2
 * images, 5 of the top 7 projects PRIVATE. rfcx-local
 * runbooks/FINDING-2026-09-24-export-audio-url-signature-not-enforced.md.
 *
 * Every stored-image emitter now goes through app/utils/arbimon2-asset-url.js
 * (/legacy-api/arbimon2-asset/<key>?e=<exp>&s=<hmac>: SIGNED + EXPIRING, like a
 * media-api stream-token -- not session-gated, because <img> tags cannot carry
 * the SPA bearer and split legacy/SPA session state is real), soundscapes render
 * from .scidx, and the clustering /asset proxy is scoped to its project.
 *
 * (Harness note: chai 3.5 `to.not.match` on a large string did not assert in this
 * repo's mocha -- measured the same day -- so source checks are boolean.)
 */
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SALT = 'test-salt-not-a-secret';

function fresh () {
    delete require.cache[require.resolve('../app/utils/arbimon2-asset-url')];
    return require('../app/utils/arbimon2-asset-url');
}

describe('arbimon2 images are signed + expiring, never public storage urls', function () {
    let saved;
    before(function () { saved = process.env.STREAM_TOKEN_SALT; process.env.STREAM_TOKEN_SALT = SALT; });
    after(function () { if (saved === undefined) delete process.env.STREAM_TOKEN_SALT; else process.env.STREAM_TOKEN_SALT = saved; });

    it('builds a same-origin gated url with a verifiable signature', function () {
        const a = fresh();
        const u = a.arbimon2AssetUrl('project_35/templates/29418.png');
        expect(u.indexOf('/legacy-api/arbimon2-asset/project_35/templates/29418.png?e=')).to.equal(0);
        const e = /[?&]e=(\d+)/.exec(u)[1], sig = /[?&]s=([0-9a-f]{32})$/.exec(u)[1];
        expect(a.verifyKey('project_35/templates/29418.png', sig, e)).to.equal('project_35/templates/29418.png');
        expect(a.keyProjectId('project_35/templates/29418.png')).to.equal(35);
    });

    it('accepts a legacy full public url and strips it to the key', function () {
        const a = fresh();
        expect(a.arbimon2AssetUrl('https://s3.arbimon.org/arbimon2/project_1149/detections/71265/2_0.png').indexOf('/legacy-api/arbimon2-asset/project_1149/detections/71265/2_0.png?e=')).to.equal(0);
    });

    it('covers every image family the legacy UI renders (incl. legacy .thumbnail.png)', function () {
        const a = fresh();
        for (const k of ['project_1/detections/9/1_2.png', 'project_1/detections_dev/9/1.png', 'project_1/templates/9.png',
                         'project_1/training_sets/7/8.png', 'project_1/soundscapes/9/image.png', 'project_1/models/job_1_2_3.png',
                         'project_35/site_34377/2022/2/20220215_100000.thumbnail.png']) {
            expect(a.arbimon2AssetUrl(k), k).to.be.a('string');
        }
    });

    it('refuses non-image and traversal keys even if signed', function () {
        const a = fresh();
        for (const k of ['project_1/site_2/2020/1/x.flac', 'project_1/soundscapes/9/index.scidx', 'audio_events/prod/x.npy',
                         'project_1/../project_2/templates/1.png', 'project_1/templates//1.png', 'other_bucket/x.png']) {
            expect(a.arbimon2AssetUrl(k), k).to.equal(null);
        }
    });

    it('a signature for one key does not verify another; forged/short sig, extended or past exp all fail', function () {
        const a = fresh();
        const u = a.arbimon2AssetUrl('project_1/templates/1.png');
        const e = Number(/e=(\d+)/.exec(u)[1]), sig = /s=([0-9a-f]{32})/.exec(u)[1];
        const now = Math.floor(Date.now() / 1000);
        expect(e > now + 5 * 3600 && e <= now + 7 * 3600 && e % 3600 === 0, '6 h, hour-bucketed (media-api parity)').to.equal(true);
        expect(a.verifyKey('project_2/templates/1.png', sig, e)).to.equal(null);
        expect(a.verifyKey('project_1/templates/1.png', sig.replace(/^./, c => c === '0' ? '1' : '0'), e)).to.equal(null);
        expect(a.verifyKey('project_1/templates/1.png', sig.slice(0, 16), e)).to.equal(null);
        expect(a.verifyKey('project_1/templates/1.png', sig, e + 86400), 'extended exp').to.equal(null);
        expect(a.verifyKey('project_1/templates/1.png', sig, 'abc'), 'malformed exp').to.equal(null);
        expect(a.verifyKey('project_1/templates/1.png', sig, undefined), 'missing exp').to.equal(null);
    });

    it('an expired signature fails closed', function () {
        const a = fresh();
        const realNow = Date.now;
        const u = a.arbimon2AssetUrl('project_1/templates/1.png');
        const e = /e=(\d+)/.exec(u)[1], sig = /s=([0-9a-f]{32})/.exec(u)[1];
        try {
            Date.now = () => Number(e) * 1000;       // exactly at exp
            expect(a.verifyKey('project_1/templates/1.png', sig, e)).to.equal(null);
            Date.now = () => Number(e) * 1000 - 1000; // 1 s before exp
            expect(a.verifyKey('project_1/templates/1.png', sig, e)).to.equal('project_1/templates/1.png');
        } finally { Date.now = realNow; }
    });

    it('no salt -> no url (fails closed, never falls back to the public host)', function () {
        delete process.env.STREAM_TOKEN_SALT;
        try { expect(fresh().arbimon2AssetUrl('project_1/templates/1.png')).to.equal(null); }
        finally { process.env.STREAM_TOKEN_SALT = SALT; }
    });

    it('soundscape url is signed per id and changes with the visual scale', function () {
        const a = fresh();
        const u1 = a.soundscapeImageUrl({ id: 13547, visual_palette: 1, visual_max_value: null, normalized: 1, threshold: 0.05, threshold_type: 'absolute' });
        const u2 = a.soundscapeImageUrl({ id: 13547, visual_palette: 2, visual_max_value: null, normalized: 1, threshold: 0.05, threshold_type: 'absolute' });
        expect(u1.indexOf('/legacy-api/arbimon2-asset/soundscape/13547.png?v=')).to.equal(0);
        expect(u1 !== u2, 'visual change busts the url').to.equal(true);
        const e = /e=(\d+)/.exec(u1)[1], sig = /s=([0-9a-f]{32})$/.exec(u1)[1];
        expect(a.verifySoundscape('13547', sig, e)).to.equal(13547);
        expect(a.verifySoundscape('13548', sig, e)).to.equal(null);
    });

    it('NO app/ or jobs/ source builds a public arbimon2 url any more', function () {
        const files = ['app/model/pattern_matchings.js', 'app/model/templates.js', 'app/model/training_sets.js',
            'app/model/soundscapes.js', 'app/model/playlists.js', 'app/model/models.js', 'app/model/recordings.js',
            'app/routes/data-api/project/models.js', 'app/routes/data-api/project/classifications.js', 'jobs/services/template.js'];
        for (const f of files) {
            expect(/arbimon2PublicUrl(Base)?\(/.test(read(f)), f + ' still calls arbimon2PublicUrl').to.equal(false);
        }
    });

    it('signed route is mounted ABOVE the login gate (a signed <img> must not 302), and nowhere else', function () {
        expect(/router\.use\('\/legacy-api\/arbimon2-asset', require\('\.\/data-api\/arbimon2-assets'\)\)/.test(read('app/routes/non-session.js'))).to.equal(true);
        expect(/arbimon2-assets/.test(read('app/routes/data-api/index.js')), 'not also under the session router').to.equal(false);
    });

    it('clustering /asset proxy only serves this project\'s clustering ROI pngs', function () {
        const src = read('app/routes/data-api/project/clustering-jobs.js');
        expect(/CLUSTERING_ASSET\.exec\(/.test(src), 'path is shape-checked').to.equal(true);
        expect(/model\.jobs\.find\(\{ job_id: Number\(m\[1\]\), project_id: req\.project\.project_id \}/.test(src), 'job scoped to req.project').to.equal(true);
    });
});

describe('soundscape renderer is a faithful port of the Python writer', function () {
    const { renderSoundscapePng } = require('../app/utils/soundscape-image');
    const Jimp = require('jimp');
    // 3x2 synthetic scidx: cell counts, one amp list. Bottom row = y 0.
    const idx = { width: 3, height: 2, offsetx: 0, offsety: 0, stats: { maxAmp: 1.0 },
        index: { 0: { 0: [[1, 2], [0.2, 0.9]], 2: [[1], [0.9]] }, 1: { 1: [[1, 2, 3, 4], null] } } };
    const px = async (sc, nv) => { const b = (await Jimp.read(await renderSoundscapePng(sc, idx, nv))).bitmap; return (x, y) => b.data.slice((y * b.width + x) * 4, (y * b.width + x) * 4 + 3).join(','); };

    it('scales by the busiest cell and draws the TOP row = highest bin', async function () {
        const p = await px({ visual_palette: 1, normalized: 0, threshold: 0 });
        const pal = require('../app/utils/soundscape-image').loadPalette(1);
        expect(p(1, 0)).to.equal(pal[255].join(','));        // y1,x1: 4/4 -> 255
        expect(p(0, 1)).to.equal(pal[127].join(','));        // y0,x0: 2/4 -> int(127.5) = 127
        expect(p(2, 1)).to.equal(pal[63].join(','));         // y0,x2: 1/4 -> 63
        expect(p(1, 1)).to.equal(pal[0].join(','));          // empty -> 0
    });

    it('threshold counts amplitudes above th (relative-to-peak scales by maxAmp)', async function () {
        const pal = require('../app/utils/soundscape-image').loadPalette(1);
        const p = await px({ visual_palette: 1, normalized: 0, threshold: 0.5, threshold_type: 'relative-to-peak-maximum' });
        expect(p(0, 1)).to.equal(pal[63].join(','));         // 1 of [0.2,0.9] > 0.5 -> 1/4
    });

    it('normalized divides by the norm vector and forces scale 1', async function () {
        const pal = require('../app/utils/soundscape-image').loadPalette(1);
        const p = await px({ visual_palette: 1, normalized: 1, threshold: 0 }, { 0: 4, 1: 4, 2: 1 });
        expect(p(0, 1)).to.equal(pal[127].join(','));        // 2/4 = 0.5 -> 127
        expect(p(2, 1)).to.equal(pal[255].join(','));        // 1/1 -> 255
    });
});