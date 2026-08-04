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

/**
 * Build an on-demand ROI spectrogram URL for the modern SPA.
 *
 * Instead of pointing at a pre-generated detection PNG in the arbimon2 bucket
 * (there are ~1B of these; backfilling them off AWS is prohibitive), this
 * returns a URL on the NON-SESSION media proxy
 * (`/legacy-api/ingest/recordings/:attr`, see app/routes/non-session.js +
 * app/routes/data-api/ingest.js) which renders the spectrogram live via the
 * core media API. The URL is auth-free (loadable as a bare <img>), content
 * addressed, and served inline + immutable-cached.
 *
 * The window is framed by the recording's TRUE UTC start (`datetimeUtc`) plus
 * the ROI's time bounds; the image is cropped to the ROI frequency band. NOTE:
 * callers MUST pass the recording's `datetime_utc` (not the denormalised,
 * TZ-shifted `datetime`) or the media window will be hours off.
 *
 * Returns null when the inputs to generate it aren't available (e.g. a legacy
 * recording that has no stream external_id) — callers then render a placeholder
 * and MUST NOT fall back to the cached detection PNG.
 *
 * @param {object} roi
 * @param {string} roi.externalId  stream external id
 * @param {string|Date} roi.datetimeUtc  recording start (UTC)
 * @param {number} roi.timeMin  ROI start, seconds into the recording
 * @param {number} roi.timeMax  ROI end, seconds into the recording
 * @param {number} roi.freqMin  ROI low frequency, Hz
 * @param {number} roi.freqMax  ROI high frequency, Hz
 * @param {object} [opts]
 * @param {number} [opts.width=600]
 * @param {number} [opts.height=256]
 */
function roiSpectrogramUrl (roi, opts) {
    if (!roi || !roi.externalId) return null;
    const base = roi.datetimeUtc;
    if (!base) return null;
    const baseMs = new Date(base).getTime();
    if (isNaN(baseMs)) return null;
    const from = Math.min(Number(roi.timeMin), Number(roi.timeMax));
    const to = Math.max(Number(roi.timeMin), Number(roi.timeMax));
    if (isNaN(from) || isNaN(to)) return null;
    const fmtTs = function (ms) {
        const d = new Date(ms);
        const p = function (n, w) { return String(n).padStart(w || 2, '0'); };
        return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T` +
            `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${p(d.getUTCMilliseconds(), 3)}`;
    };
    const start = fmtTs(baseMs + from * 1000);
    const end = fmtTs(baseMs + to * 1000);
    const fmin = Math.max(0, Math.min(Number(roi.freqMin), Number(roi.freqMax)));
    const fmax = Math.max(Number(roi.freqMin), Number(roi.freqMax));
    if (isNaN(fmin) || isNaN(fmax)) return null;
    const w = (opts && opts.width) || 600;
    const h = (opts && opts.height) || 256;
    // r{fmin}.{fmax} freq band; mtrue = MONOCHROME (sox -lm greyscale, verified
    // against media-api segment-file-utils renderSpectrogram); d{W}.{H} px; wdolph
    // window; z120 z-scale. Same grammar the visualizer + templates use.
    const asset = `r${fmin.toFixed(0)}.${fmax.toFixed(0)}_g1_fspec_mtrue_d${w}.${h}_wdolph_z120.png`;
    return `/legacy-api/ingest/recordings/${roi.externalId}_t${start}Z.${end}Z_${asset}`;
}

module.exports = {
    arbimon2PublicUrl,
    arbimon2PublicUrlBase,
    roiSpectrogramUrl
};
