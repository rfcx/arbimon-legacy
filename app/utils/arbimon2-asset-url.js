'use strict';
// AUTH-GATED URLs for stored `arbimon2` bucket IMAGES (2026-09-24).
//
// WHY: every legacy image that fell back to the stored PNG was emitted as
// `https://s3.arbimon.org/arbimon2/<key>` (arbimon2PublicUrl). That host is our
// storage chain, which serves ANY key to ANYONE (it ignores S3 signatures), so
// those were permanent anonymous links to private-project images. rfcx-local
// FINDING-2026-09-24-export-audio-url-signature-not-enforced.md measured 1,471
// anonymous 200s in 7 days, 5 of the top 7 projects PRIVATE.
//
// Instead the browser gets a same-origin app URL
//
//   /legacy-api/arbimon2-asset/<key>?s=<sig>
//
// served by app/routes/data-api/arbimon2-assets.js BELOW the app's Force-login
// gate, which then authorises the *owning project of the key* the same way the
// project router does (private project => caller must be a member or super).
//
// ⚠️ A key's project is not always the viewing project: templates and training
// sets shared/copied from a source project keep the SOURCE key (574 of 77,365
// templates, 55 of 118,056 training-set ROIs, measured 2026-09-24). Such an image
// is authorised against its OWNING project. `s` (a server HMAC of the key) stops
// callers enumerating keys the app never showed them; the project check stops a
// leaked URL working for a non-member of a private project.

const crypto = require('crypto');

// Families the legacy UI legitimately renders from the bucket. Anything else
// (recording audio, .scidx, .npy vectors, model binaries) is refused even if
// correctly signed -- the proxy is for IMAGES.
const ALLOWED_KEY = /^project_(\d+)\/(?:(?:detections|detections_dev|templates|training_sets|soundscapes|models)\/[A-Za-z0-9_\-./]+\.png|site_\d+\/[A-Za-z0-9_\-./ ]+\.thumbnail\.png)$/;

function secret () {
    // The media-api token salt: already on every arbimon-legacy workload (web +
    // export job), never sent to browsers; rotating it already invalidates every
    // other signed asset URL we hand out.
    return process.env.STREAM_TOKEN_SALT || '';
}

function normalizeKey (key) {
    if (typeof key !== 'string') return null;
    const k = key.replace(/^\/+/, '');
    if (!k || k.includes('..') || k.includes('\\') || k.includes('//')) return null;
    return ALLOWED_KEY.test(k) ? k : null;
}

function keyProjectId (key) {
    const m = ALLOWED_KEY.exec(key || '');
    return m ? Number(m[1]) : null;
}

function signKey (key) {
    const s = secret();
    if (!s) return null;
    return crypto.createHmac('sha256', s).update('arbimon2:' + key, 'utf8').digest('hex').slice(0, 32);
}

/** Returns the normalized key when `sig` is the HMAC of it, else null. */
function verifyKey (key, sig) {
    const k = normalizeKey(key);
    if (!k || typeof sig !== 'string' || sig.length !== 32) return null;
    const want = signKey(k);
    if (!want) return null;
    const a = Buffer.from(want, 'utf8'), b = Buffer.from(sig, 'utf8');
    return (a.length === b.length && crypto.timingSafeEqual(a, b)) ? k : null;
}

/** Strip the public host a few legacy SQL paths CONCAT'ed on, returning the bare key. */
function keyFromStoredUrl (maybeUrl) {
    if (typeof maybeUrl !== 'string') return maybeUrl;
    const m = /^https?:\/\/[^/]+\/arbimon2\/(.+)$/.exec(maybeUrl);
    if (!m) return maybeUrl;
    try { return decodeURIComponent(m[1].split('?')[0]); } catch (e) { return m[1].split('?')[0]; }
}

/**
 * Same-origin, auth-gated URL for a stored arbimon2 IMAGE key (or a legacy full
 * `https://s3.arbimon.org/arbimon2/<key>` url). Returns null for anything
 * outside the image allow-list or when the signing secret is absent -- callers
 * keep their existing null handling (placeholder / on-error-src).
 * `opts.absolute` prefixes the public host (for CSV/zip exports).
 */
function arbimon2AssetUrl (keyOrUrl, opts) {
    const k = normalizeKey(keyFromStoredUrl(keyOrUrl));
    if (!k) return null;
    const sig = signKey(k);
    if (!sig) return null;
    const p = `/legacy-api/arbimon2-asset/${k.split('/').map(encodeURIComponent).join('/')}?s=${sig}`;
    if (opts && opts.absolute) {
        return String(opts.publicUrl || 'https://arbimon.org').replace(/\/+$/, '') + p;
    }
    return p;
}

/**
 * Server-rendered soundscape heat-map (from `.scidx`), for soundscape row `sc`
 * ({id, visual_palette, visual_max_value, normalized, threshold, threshold_type}).
 * `v` changes whenever the visual scale changes, so caches never show a stale
 * scale. Returns null when the signing secret is absent.
 */
function soundscapeImageUrl (sc) {
    const id = sc && (sc.id !== undefined ? sc.id : sc.soundscape_id);
    if (!Number.isInteger(+id) || +id <= 0) return null;
    const sig = signKey('soundscape:' + (+id));
    if (!sig) return null;
    const v = [sc.visual_palette, sc.visual_max_value, sc.normalized, sc.threshold, sc.threshold_type]
        .map(x => (x === null || x === undefined) ? '' : String(x)).join('_');
    return `/legacy-api/arbimon2-asset/soundscape/${+id}.png?v=${encodeURIComponent(v)}&s=${sig}`;
}

function verifySoundscape (id, sig) {
    if (!/^\d+$/.test(String(id)) || typeof sig !== 'string' || sig.length !== 32) return null;
    const want = signKey('soundscape:' + (+id));
    if (!want) return null;
    const a = Buffer.from(want, 'utf8'), b = Buffer.from(sig, 'utf8');
    return (a.length === b.length && crypto.timingSafeEqual(a, b)) ? +id : null;
}

module.exports = { arbimon2AssetUrl, soundscapeImageUrl, verifyKey, verifySoundscape, normalizeKey, keyProjectId, keyFromStoredUrl, ALLOWED_KEY };