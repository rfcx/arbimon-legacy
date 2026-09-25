'use strict';
// Signed, expiring stream of a stored `arbimon2` IMAGE, and the server-rendered
// soundscape heat-map (2026-09-24). Replaces every public
// `https://s3.arbimon.org/arbimon2/<key>` URL the legacy app handed browsers
// (that host serves any key to anyone, forever).
//
//   GET /legacy-api/arbimon2-asset/<key>?e=<exp>&s=<sig>
//   GET /legacy-api/arbimon2-asset/soundscape/<id>.png?v=<visual>&e=<exp>&s=<sig>
//
// AUTH MODEL = the signature, like media-api stream-tokens (media-asset-auth
// Track B): URLs are minted only server-side, when the app has already decided
// the user may see the row; `s` = HMAC(key|soundscape-id, exp); expired or
// tampered -> 404. See app/utils/arbimon2-asset-url.js for why this is NOT a
// session gate (<img> can't carry the SPA bearer; split legacy/SPA session state
// is real, so a session gate would break images that work today).
//
// MOUNT: app/routes/non-session.js, i.e. ABOVE the Force-login gate, exactly like
// the signed media-api route it mirrors -- a signed <img> must not 302.
// Allow-list: images only (no audio/.scidx/vectors). Cache-Control private.
const express = require('express');
const config = require('../../config');
const model = require('../../model');
const { createS3Client } = require('../../utils/storage');
const { verifyKey, verifySoundscape } = require('../../utils/arbimon2-asset-url');
const { renderSoundscapePng } = require('../../utils/soundscape-image');

const router = express.Router();
let s3;
const notFound = (res) => res.status(404).json({ error: 'asset not available' });

router.get('/soundscape/:id.png', function (req, res) {
    const id = verifySoundscape(req.params.id, String(req.query.s || ''), req.query.e);
    if (!id) return notFound(res);
    model.soundscapes.find({ id }, function (ferr, rows) {
        const sc = !ferr && rows && rows[0];
        if (!sc) return notFound(res);
        sc.aggregation = { id: sc.aggregation };
        model.soundscapes.fetchSCIDX(sc, {}, function (err, idx) {
            if (err) {
                const missing = err.statusCode === 404 || err.code === 'NoSuchKey' || err.code === 'NotFound' || err.name === 'XMLParserError';
                if (!res.headersSent) res.status(missing ? 404 : 502).json({ error: 'asset not available' });
                return;
            }
            Promise.resolve((sc.normalized | 0) ? model.soundscapes.fetchNormVector(sc) : null)
                .then((nv) => renderSoundscapePng(sc, idx, nv))
                .then((buf) => {
                    res.set('Content-Type', 'image/png');
                    res.set('Cache-Control', 'private, max-age=3600');
                    res.send(buf);
                })
                .catch((e) => {
                    console.error('[arbimon2-asset soundscape]', id, e && e.message);
                    if (!res.headersSent) res.status(500).json({ error: 'asset not available' });
                });
        });
    });
});

router.get('/*', function (req, res) {
    let raw = req.params[0] || '';
    try { raw = decodeURIComponent(raw); } catch (e) { return notFound(res); }
    const key = verifyKey(raw, String(req.query.s || ''), req.query.e);
    if (!key) return notFound(res);

    if (!s3) s3 = createS3Client('aws'); // endpoint-aware: in-cluster s3-proxy chain
    let done = false;
    const fail = (err) => {
        if (done) return; done = true;
        if (res.headersSent) { try { res.destroy(); } catch (e) {} return; }
        const missing = err && (err.statusCode === 404 || err.code === 'NoSuchKey' || err.code === 'NotFound' || err.name === 'XMLParserError');
        res.status(missing ? 404 : 502).json({ error: 'asset not available' });
    };
    const r = s3.getObject({ Bucket: config('aws').bucketName, Key: key });
    r.on('httpHeaders', function (status, headers) {
        if (status >= 200 && status < 300 && !res.headersSent) {
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'private, max-age=3600');
            if (headers['content-length']) res.set('Content-Length', headers['content-length']);
        }
    });
    r.on('error', fail);
    const rs = r.createReadStream();
    rs.on('error', fail);
    rs.on('end', () => { done = true; });
    res.on('close', () => { if (!done) { try { r.abort(); } catch (e) {} rs.destroy(); } });
    rs.pipe(res);
});

module.exports = router;