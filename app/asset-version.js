/**
 * Cache-busting versions for the legacy front-end bundles.
 *
 * WHY THIS EXISTS
 * ---------------
 * The legacy app serves its AngularJS bundles at FIXED, unhashed URLs
 * (`/includes/js/arbimon2.js`). The app itself sends `Cache-Control:
 * public, max-age=0` and so does our own edge nginx — both correct — but
 * Cloudflare's default "cache static file extensions" behaviour rewrites that
 * to `public, max-age=14400` on the way out. A browser therefore keeps
 * executing the PREVIOUS bundle for up to 4 hours after a deploy.
 *
 * Measured 2026-09-09, and this is the defect that made it visible: a shipped
 * pattern-matching fix was live on both pods and at the edge, while a user's
 * browser still emitted the OLD URL shape — byte-identical to the pre-deploy
 * builder. Nothing was broken server-side; the browser simply never re-asked.
 *
 * THE FIX
 * -------
 * Stamp a CONTENT-DERIVED query on the bundle URLs, mirroring what the modern
 * SPA already gets for free from Vite (`/assets/app-9ad65c41.js` — the
 * filename changes when the bytes change, so a new deploy is picked up
 * immediately and old copies can be cached forever). We cannot rename the
 * legacy files without touching the gulp pipeline and every reference, but a
 * `?v=<hash-of-the-file>` is sufficient: the URL changes exactly when the
 * bytes change, so caches treat it as a new resource.
 *
 * PROPERTIES THAT MATTER
 * ----------------------
 *  - CONTENT-derived, not time- or SHA-derived: a rebuild that produces
 *    identical bytes keeps the same URL (no pointless cache churn), and a
 *    change ALWAYS busts, even for a hand-built or rolled-back image whose
 *    release SHA tells you nothing about the asset bytes.
 *  - Computed ONCE at startup: no per-request disk I/O. The files are baked
 *    into the image and cannot change under a running pod.
 *  - FAILS OPEN: if a file is unreadable we return an empty version and the
 *    URL renders exactly as it does today. A cache-busting helper must never
 *    be able to take the site down.
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var PUBLIC_ROOT = path.resolve(__dirname, '..', 'public');

// Web path -> on-disk file. Only the bundles the app BUILDS (and therefore
// changes on deploy) are listed. Third-party vendor files under /includes are
// deliberately excluded: they change only when their dependency is upgraded,
// which also changes their path or is rare enough not to matter.
var VERSIONED = [
    '/includes/js/arbimon2.js',
    '/includes/js/arbimon2-templates.js',
    '/includes/css/style.css'
];

var versions = Object.create(null);

function hashFile(webPath) {
    try {
        var abs = path.join(PUBLIC_ROOT, webPath.replace(/^\//, ''));
        var buf = fs.readFileSync(abs);
        return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
    } catch (e) {
        // Fail open: no version marker, URL unchanged, site still serves.
        console.error('asset-version: could not hash ' + webPath + ' (' + e.code + ') — serving unversioned');
        return '';
    }
}

VERSIONED.forEach(function (p) { versions[p] = hashFile(p); });

/**
 * Return the versioned URL for a built asset.
 * Unknown or unhashable paths are returned verbatim, so a typo degrades to
 * today's behaviour rather than a broken tag.
 */
function assetUrl(webPath) {
    var v = versions[webPath];
    return v ? webPath + '?v=' + v : webPath;
}

module.exports = { assetUrl: assetUrl, versions: versions };
