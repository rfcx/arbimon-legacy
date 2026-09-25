'use strict';
// SIGNED, EXPIRING same-origin URLs for stored `arbimon2` bucket IMAGES (2026-09-24).
//
// WHY: every legacy image that fell back to the stored PNG was emitted as
// `https://s3.arbimon.org/arbimon2/<key>` (arbimon2PublicUrl). That host is our
// storage chain, which serves ANY key to ANYONE, FOREVER (it ignores S3
// signatures). rfcx-local FINDING-2026-09-24-export-audio-url-signature-not-enforced.md
// measured 1,471 anonymous 200s in 7 days, 5 of the top 7 projects PRIVATE.
//
// Now the browser gets
//
//   /legacy-api/arbimon2-asset/<key>?e=<exp>&s=<hmac(key, exp)>
//
// served by app/routes/data-api/arbimon2-assets.js. The SIGNATURE is the
// credential -- exactly the media-api stream-token model (media-asset-auth
// Track B, 2026-08-10): the URL is only minted server-side at the moment the
// app has already decided this user may see this row, and it EXPIRES.
//
// WHY NOT A SESSION GATE (tried first, reversed under IRR the same night): these
// URLs land in <img> tags, which cannot carry the SPA's Authorization bearer, and
// a legacy session cookie is NOT guaranteed -- "split state" (SPA authenticated,
// legacy session anonymous) was observed live on 2026-09-24 in the operator's
// own browser. A session-gated <img> 302s to /legacy-login => a broken image
// where today there is a working one. The signed URL works in both states.
//
// Scope of what a signature grants: one allow-listed IMAGE key until `exp`.
// Enumeration is impossible without the server secret; a leaked URL works for
// at most MEDIA_TOKEN_TTL (6 h, hour-bucketed) -- the same bound as every
// media-api image the app already hands out.

const crypto = require('crypto');
const { mediaAssetExpiry } = require('./asset-url');

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

function sign (subject, exp) {
    const s = secret();
    if (!s || !Number.isInteger(exp)) return null;
    return crypto.createHmac('sha256', s).update('arbimon2:' + subject + ':' + exp, 'utf8').digest('hex').slice(0, 32);
}

function checkSig (subject, sig, expRaw) {
    if (typeof sig !== 'string' || sig.length !== 32) return false;
    if (!/^\d+$/.test(String(expRaw))) return false;
    const exp = Number(expRaw);
    if (!Number.isInteger(exp) || exp * 1000 <= Date.now()) return false; // expired (fails closed at == now)
    const want = sign(subject, exp);
    if (!want) return false;
    const a = Buffer.from(want, 'utf8'), b = Buffer.from(sig, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Returns the normalized key when (sig, exp) is a valid, unexpired signature for it, else null. */
function verifyKey (key, sig, exp) {
    const k = normalizeKey(key);
    return (k && checkSig(k, sig, exp)) ? k : null;
}

/** Strip the public host a few legacy SQL paths CONCAT'ed on, returning the bare key. */
function keyFromStoredUrl (maybeUrl) {
    if (typeof maybeUrl !== 'string') return maybeUrl;
    const m = /^https?:\/\/[^/]+\/arbimon2\/(.+)$/.exec(maybeUrl);
    if (!m) return maybeUrl;
    try { return decodeURIComponent(m[1].split('?')[0]); } catch (e) { return m[1].split('?')[0]; }
}

/**
 * Signed, expiring, same-origin URL for a stored arbimon2 IMAGE key (or a legacy
 * full `https://s3.arbimon.org/arbimon2/<key>` url). Returns null for anything
 * outside the image allow-list or when the signing secret is absent -- callers
 * keep their existing null handling (placeholder / on-error-src). Never falls
 * back to the public host.
 */
function arbimon2AssetUrl (keyOrUrl) {
    const k = normalizeKey(keyFromStoredUrl(keyOrUrl));
    if (!k) return null;
    const exp = mediaAssetExpiry();
    const sig = sign(k, exp);
    if (!sig) return null;
    return `/legacy-api/arbimon2-asset/${k.split('/').map(encodeURIComponent).join('/')}?e=${exp}&s=${sig}`;
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
    const exp = mediaAssetExpiry();
    const sig = sign('soundscape:' + (+id), exp);
    if (!sig) return null;
    const v = [sc.visual_palette, sc.visual_max_value, sc.normalized, sc.threshold, sc.threshold_type]
        .map(x => (x === null || x === undefined) ? '' : String(x)).join('_');
    return `/legacy-api/arbimon2-asset/soundscape/${+id}.png?v=${encodeURIComponent(v)}&e=${exp}&s=${sig}`;
}

function verifySoundscape (id, sig, exp) {
    if (!/^\d+$/.test(String(id))) return null;
    return checkSig('soundscape:' + (+id), sig, exp) ? +id : null;
}

module.exports = { arbimon2AssetUrl, soundscapeImageUrl, verifyKey, verifySoundscape, normalizeKey, keyProjectId, keyFromStoredUrl, ALLOWED_KEY };