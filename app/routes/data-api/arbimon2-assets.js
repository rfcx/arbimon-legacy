'use strict';
// GET /legacy-api/arbimon2-asset/<key>?s=<sig>
//
// Auth-gated stream of a stored `arbimon2` IMAGE (2026-09-24). Replaces every
// `https://s3.arbimon.org/arbimon2/<key>` the legacy app used to hand browsers --
// that host is our storage chain, which serves any key to anyone.
//
// Gates, in order:
//  1. mounted under /legacy-api (dataApi) BELOW the Force-login gate in
//     app/routes/index.js -> anonymous callers are redirected to /legacy-login;
//  2. `s` must be the server-side HMAC of this exact key (app/utils/arbimon2-asset-url.js)
//     -> only keys the app itself emitted, no enumeration;
//  3. the key must be in the image allow-list (no audio, .scidx, vectors, models);
//  4. the key's OWNING project (project_<id>/...) is authorised exactly like the
//     project router (app/routes/data-api/project/index.js router.param): a
//     PRIVATE project requires a membership row or super; anonymous guests are
//     refused. So a leaked URL does not work for a non-member.
// Private cache only: a per-user authorised response must never be CDN-shared.
const express = require('express');
const config = require('../../config');
const model = require('../../model');
const { createS3Client } = require('../../utils/storage');
const { verifyKey, keyProjectId, verifySoundscape } = require('../../utils/arbimon2-asset-url');
const { renderSoundscapePng } = require('../../utils/soundscape-image');

const router = express.Router();
let s3;

function canSee (req, projectId) {
    return new Promise((resolve) => {
        const u = req.session && req.session.user;
        if (!u || req.session.isAnonymousGuest === true) return resolve(false);
        model.projects.findById(projectId, function (err, project) {
            if (err || !project) return resolve(false);
            if (!project.is_private || u.isSuper) return resolve(true);
            const cached = u.permissions && u.permissions[projectId];
            if (cached && cached.length) return resolve(true);
            model.users.getPermissions(u.id, projectId, function (e, perms) {
                resolve(!e && Array.isArray(perms) && perms.length > 0);
            });
        });
    });
}

// GET /legacy-api/arbimon2-asset/soundscape/<id>.png?v=<visual-params>&s=<sig>
// The soundscape heat-map rendered on demand from `.scidx`
// (app/utils/soundscape-image.js: pixel-exact port of the Python writer, verified
// 5/5 against stored PNGs incl. normalized + threshold cases). Replaces the
// pre-baked arbimon2 image.png, most of which the §275 retirement DELETED
// (4,267 of 4,958 internet requests for them in the week to 2026-09-24 were
// 404s). Authorised against the soundscape's OWNING project; `v` busts caches
// when the visual scale changes.
router.get('/soundscape/:id.png', async function (req, res) {
    const id = verifySoundscape(req.params.id, String(req.query.s || ''));
    if (!id) return res.status(404).json({ error: 'asset not available' });
    let sc;
    try {
        const rows = await new Promise((ok, ko) => model.soundscapes.find({ id }, (e, r) => e ? ko(e) : ok(r)));
        sc = rows && rows[0];
    } catch (e) { sc = null; }
    if (!sc) return res.status(404).json({ error: 'asset not available' });
    if (!(await canSee(req, sc.project))) return res.status(403).json({ error: 'asset not available' });
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
                res.set('Cache-Control', 'private, max-age=86400');
                res.send(buf);
            })
            .catch((e) => {
                console.error('[arbimon2-asset soundscape]', id, e && e.message);
                if (!res.headersSent) res.status(500).json({ error: 'asset not available' });
            });
    });
});

router.get('/*', async function (req, res) {
    let raw = req.params[0] || '';
    try { raw = decodeURIComponent(raw); } catch (e) { return res.status(404).json({ error: 'asset not available' }); }
    const key = verifyKey(raw, String(req.query.s || ''));
    if (!key) return res.status(404).json({ error: 'asset not available' });
    if (!(await canSee(req, keyProjectId(key)))) return res.status(403).json({ error: 'asset not available' });

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
            res.set('Cache-Control', 'private, max-age=86400');
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