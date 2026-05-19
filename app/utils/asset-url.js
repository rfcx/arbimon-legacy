/**
 * Public URL helper for the `arbimon2` S3 bucket.
 *
 * Historically the arbimon-legacy codebase emitted ~15 distinct URL
 * strings that pointed directly at AWS S3 for assets stored in the
 * `arbimon2` bucket — most via the env-derived
 *     `https://${config('aws').bucketName}.s3.${config('aws').region}.amazonaws.com/<key>`
 * pattern, with two literal hardcodes (`s3.amazonaws.com/arbimon2/...`
 * in `pattern_matchings.js` and `arbimon2.s3.us-east-1.amazonaws.com/...`
 * in `jobs/services/template.js`).
 *
 * Those URLs are served to the browser via JSON API responses
 * (template thumbnails, ROI thumbnails, recording thumbnails,
 * soundscape thumbnails, training-set images, app-listing downloads,
 * etc.) and also embedded in SQL responses via `CONCAT(...)`.
 *
 * As part of the AWS retirement / rfcx-local migration, the operator
 * stood up `s3.arbimon.org` (cloudflared → in-cluster `s3-proxy`
 * nginx → `s3-reader` cache → B2 primary + AWS read-only fallback)
 * as the durable replacement for `arbimon2.s3.us-east-1.amazonaws.com`.
 * See `runbooks/s3-bucket-inventory-2026-05-18.md` and
 * `runbooks/phase-2-s3-cutback-2026-05-18.md` in the rfcx-local repo.
 *
 * This module is the single chokepoint that constructs public URLs
 * for arbimon2 assets, so changing the destination is one env var,
 * not 15 string edits.
 *
 * Configuration:
 *   - `ARBIMON2_PUBLIC_URL_BASE` env var (no trailing slash).
 *   - Defaults to `https://s3.arbimon.org/arbimon2` which is the
 *     in-cluster + Cloudflare-fronted replacement endpoint.
 *
 * Why a base+key split:
 *   - `arbimon2PublicUrl(key)` is the modern API for JS interpolations.
 *   - `arbimon2PublicUrlBase()` preserves the half-dozen call sites
 *     that build SQL `CONCAT('${base}/', T.uri)` queries; rewriting
 *     those into post-query mapping would touch enough query shapes
 *     to be worth a separate PR.
 */

const DEFAULT_BASE = 'https://s3.arbimon.org/arbimon2';

function trimTrailingSlash (s) {
    return typeof s === 'string' ? s.replace(/\/+$/, '') : s;
}

/**
 * Returns the public URL base (no trailing slash) for the arbimon2
 * bucket. Read from `ARBIMON2_PUBLIC_URL_BASE` or, if unset, falls
 * back to the rfcx-local default.
 */
function arbimon2PublicUrlBase () {
    const fromEnv = process.env.ARBIMON2_PUBLIC_URL_BASE;
    if (fromEnv && fromEnv.trim()) {
        return trimTrailingSlash(fromEnv.trim());
    }
    return DEFAULT_BASE;
}

/**
 * Returns a full public URL for `<key>` in the arbimon2 bucket.
 * `key` is expected to be the S3 object key (no leading slash);
 * a leading slash is tolerated and stripped.
 */
function arbimon2PublicUrl (key) {
    if (typeof key !== 'string') return key;
    const k = key.replace(/^\/+/, '');
    return `${arbimon2PublicUrlBase()}/${k}`;
}

module.exports = {
    arbimon2PublicUrl,
    arbimon2PublicUrlBase
};
