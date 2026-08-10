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

const crypto = require('crypto');

const DEFAULT_BASE = 'https://s3.arbimon.org/arbimon2';

// Same-origin path to the DIRECT media-api asset route (public-router strips
// the `/media-api` prefix and proxies to media-api, rewriting headers to
// inline + private/immutable so a bare <img> renders and caches).
// Relative on purpose: the SPA and arbimon-legacy are both served from
// arbimon.org, and a same-origin URL keeps these out of cross-origin rules.
const MEDIA_ASSET_PATH = '/media-api/internal/assets/streams/';

// How long a minted asset URL stays valid, and the bucket it is rounded to.
// BUCKETING IS LOAD-BEARING: the query string is part of the browser/CDN cache
// key, so a per-request `exp` would defeat caching of content-addressed images
// for no security gain. Hourly buckets mean a reload reuses the same URL.
const MEDIA_TOKEN_TTL_SECONDS = 6 * 3600;   // 6h ceiling
const MEDIA_TOKEN_BUCKET_SECONDS = 3600;    // round UP to the next hour

/**
 * Expiry (epoch seconds) for a freshly minted asset URL, rounded UP to the next
 * bucket so repeated renders of the same image produce an IDENTICAL URL.
 */
function mediaAssetExpiry () {
    const now = Math.floor(Date.now() / 1000);
    const target = now + MEDIA_TOKEN_TTL_SECONDS;
    return Math.ceil(target / MEDIA_TOKEN_BUCKET_SECONDS) * MEDIA_TOKEN_BUCKET_SECONDS;
}

/**
 * Format an epoch-millisecond value as the "glued" UTC timestamp media-api's
 * filename grammar uses: `YYYYMMDDTHHmmssSSS` (the caller appends the `Z`).
 *
 * ⚠️ THIS IS A SIGNATURE-CRITICAL FUNCTION. media-api does NOT trust any window
 * the caller sends: `passport-stream-token` re-derives start/end by PARSING
 * THEM BACK OUT OF THE FILENAME (`parseStreamAndTime` ->
 * `gluedDateStrToMoment`). So the integers that reach this formatter are the
 * only ones that exist as far as verification is concerned. Anything signed
 * that differs from what this prints — even by a fraction of a millisecond —
 * produces a different digest and a guaranteed 401.
 *
 * `new Date(ms)` TRUNCATES a fractional millisecond, which is exactly how the
 * 2026-08-10 ROI defect happened. Callers MUST round to an integer BEFORE
 * calling this and sign over that same integer — see mediaAssetUrl(), which
 * makes that impossible to get wrong by doing both from one value.
 */
function gluedUtcTimestamp (ms) {
    const d = new Date(ms);
    const p = function (n, w) { return String(n).padStart(w || 2, '0'); };
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T` +
        `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${p(d.getUTCMilliseconds(), 3)}`;
}

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
 * Mint a media-api "stream-token" for a stream + time window.
 *
 * This is the SAME construction core media-api verifies in
 * `common/middleware/passport-stream-token` via `getStreamRangeToken`:
 *     sha256(STREAM_TOKEN_SALT + "<streamId>_<startMs>_<endMs>")
 * `authenticate()` there accepts ['jwt','stream-token'], so a request carrying
 * `?stream-token=<this>` is authorised for exactly that stream+window with no
 * Authorization header -- which is what makes a bare <img> work.
 *
 * SCOPE (by design, operator-confirmed 2026-08-10): the token binds streamId +
 * start + end -- the SOURCE WINDOW. It deliberately does NOT bind file type,
 * gain, frequency band or dimensions: permissions are determined in relation to
 * the source data, and those parameters are only how that source data is
 * RENDERED. So a token minted for a spectrogram also authorises the audio for
 * the same window, which is correct -- it is the same protected resource.
 * A mismatched time window IS rejected (401), so a token can never reach data
 * outside the window it was minted for.
 *
 * The authorisation decision therefore happens at MINTING time: only mint for
 * windows the current user is already entitled to see.
 *
 * EXPIRY: pass `exp` (epoch seconds) to bind a lifetime into the SIGNED
 * message; media-api rejects an expired or tampered `exp` (fails closed, 401).
 * Callers should BUCKET the value -- see mediaAssetExpiry(). Omitting `exp`
 * yields the historical, non-expiring token, which media-api still accepts.
 * Beyond expiry there is no revocation short of rotating STREAM_TOKEN_SALT
 * (which invalidates every outstanding token at once).
 *
 * Returns null when the salt is not configured, so callers can fall back to
 * the session-gated proxy path rather than emitting a URL that would 401.
 *
 * @param {string} streamId  stream external id
 * @param {number} startMs   window start, epoch ms
 * @param {number} endMs     window end, epoch ms
 */
function mediaStreamToken (streamId, startMs, endMs, exp) {
    const salt = process.env.STREAM_TOKEN_SALT;
    if (!salt || !streamId || !isFinite(startMs) || !isFinite(endMs)) return null;
    // `exp` (optional, epoch seconds) is folded into the SIGNED message exactly
    // as core media-api's getStreamRangeToken does, so editing it in the URL
    // changes the token that would be required.
    const message = (exp === undefined || exp === null)
        ? `${streamId}_${startMs}_${endMs}`
        : `${streamId}_${startMs}_${endMs}_${exp}`;
    return crypto.createHash('sha256').update(salt + message, 'utf8').digest('hex');
}

/**
 * Build a signed, direct media-api asset URL for ONE stream + time window.
 *
 * This is THE chokepoint for the direct route: it takes the window as epoch
 * milliseconds, ROUNDS ONCE, and then derives BOTH the filename timestamps and
 * the signed token from those same integers. That is the whole point — the
 * 2026-08-10 ROI defect (9 of 10 images 401'd in prod) happened because the
 * filename was printed from a TRUNCATED value while the token was signed over
 * the RAW fractional one. Keeping the two derivations in a single function
 * makes that class of bug structurally impossible rather than merely absent:
 * there is no code path here in which they can disagree.
 *
 * media-api re-parses the window FROM THE FILENAME, so the returned `startMs`/
 * `endMs` are the authoritative view of what was signed.
 *
 * SCOPE: the token binds streamId + start + end (+ exp) — the SOURCE WINDOW.
 * It deliberately does NOT bind render parameters (colour, dimensions, gain,
 * frequency band): those are only HOW the source is rendered, and permissions
 * attach to the source data. This is what lets a caller mint server-side while
 * the BROWSER still chooses the palette (the visualizer's per-user
 * `mtrue`/`mfalse_p2`/... setting) without invalidating the signature.
 *
 * Returns null when the salt is unset or inputs are unusable, so callers can
 * fall back to the session-gated legacy proxy instead of emitting a URL that
 * would 401.
 *
 * @param {string} streamId    stream external id
 * @param {number} rawStartMs  window start, epoch ms (may be fractional)
 * @param {number} rawEndMs    window end, epoch ms (may be fractional)
 * @param {string} asset       the asset suffix after the `_t<start>Z.<end>Z_`
 *                             segment, e.g. `z95_wdolph_g1_fspec_mtrue_d1023.255.png`
 * @returns {{url: string, token: string, exp: number, startMs: number, endMs: number, startTs: string, endTs: string, attr: string}|null}
 */
function mediaAssetUrl (streamId, rawStartMs, rawEndMs, asset) {
    if (!streamId || !asset) return null;
    if (!isFinite(rawStartMs) || !isFinite(rawEndMs)) return null;
    // ROUND ONCE. Every downstream use — filename AND signature — flows from
    // these two integers, so they cannot drift apart.
    const startMs = Math.round(Number(rawStartMs));
    const endMs = Math.round(Number(rawEndMs));
    const startTs = gluedUtcTimestamp(startMs);
    const endTs = gluedUtcTimestamp(endMs);
    const attr = `${streamId}_t${startTs}Z.${endTs}Z_${asset}`;
    const exp = mediaAssetExpiry();
    const token = mediaStreamToken(streamId, startMs, endMs, exp);
    if (!token) return null;
    return {
        url: `${MEDIA_ASSET_PATH}${attr}?stream-token=${token}&exp=${exp}`,
        token,
        exp,
        startMs,
        endMs,
        startTs,
        endTs,
        attr
    };
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
 * @param {number} [roi.sampleRate]  recording sample rate, Hz (clamps freqMax to nyquist)
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
    // ROI x1/x2 are FRACTIONAL seconds, so baseMs + from*1000 is routinely a
    // NON-INTEGER millisecond value (e.g. …942.5). The filename is printed via
    // Date(), which truncates to whole ms — so a raw fractional value and the
    // printed filename disagree. media-api re-parses start/end FROM THE
    // FILENAME, so the token must be signed over the SAME integers the filename
    // encodes or it can never verify. (This bit live on 2026-08-10: ROIs whose
    // offsets happened to land on a whole ms worked, everything else 401'd.)
    // mediaAssetUrl() now owns that rounding for BOTH derivations.
    const rawStartMs = baseMs + from * 1000;
    const rawEndMs = baseMs + to * 1000;
    const fmin = Math.max(0, Math.min(Number(roi.freqMin), Number(roi.freqMax)));
    let fmax = Math.max(Number(roi.freqMin), Number(roi.freqMax));
    if (isNaN(fmin) || isNaN(fmax)) return null;
    // Clamp to nyquist when the caller knows the sample rate (all three ROI
    // payloads project it). ROI boxes can carry y2 above the recording's
    // nyquist; the audio path (getRoiAudioFile) has always clamped for this
    // reason, and an out-of-band bandpass can fail the media-api render.
    const nyquist = roi.sampleRate ? Number(roi.sampleRate) / 2 : null;
    if (nyquist && !isNaN(nyquist) && fmax > nyquist) fmax = nyquist;
    const w = (opts && opts.width) || 600;
    const h = (opts && opts.height) || 256;
    // (asset string is built below; the direct-vs-proxy choice happens after it)
    // r{fmin}.{fmax} freq band; mtrue = MONOCHROME (sox -lm greyscale, verified
    // against media-api segment-file-utils renderSpectrogram); d{W}.{H} px; wdolph
    // window; z120 z-scale. Same grammar the visualizer + templates use.
    const asset = `r${fmin.toFixed(0)}.${fmax.toFixed(0)}_g1_fspec_mtrue_d${w}.${h}_wdolph_z120.png`;

    // TRACK B (2026-08-10): prefer the DIRECT media-api route, which skips the
    // arbimon-legacy proxy hop entirely and is a step toward retiring this app.
    //
    // The URL is authorised by a signed stream-token over the SOURCE WINDOW
    // (stream + start + end). We mint it HERE because this function is only
    // reached from session-gated `/legacy-api/project/*` endpoints -- i.e. the
    // caller is already an authenticated, entitled user. That is the whole
    // authorisation decision: see mediaStreamToken()'s note on minting.
    //
    // `exp` is bound to the token and BUCKETED to the hour: these URLs are
    // cached by the browser/CDN with the query string in the cache key, so a
    // per-request expiry would churn that cache for no security gain. The
    // bucket also means a page reload reuses the same URL.
    //
    // FALLS BACK to the session-gated proxy when the salt is unset, so a
    // misconfigured environment degrades to the (still authenticated) legacy
    // path rather than emitting URLs that would 401.
    const minted = mediaAssetUrl(roi.externalId, rawStartMs, rawEndMs, asset);
    if (minted) {
        return minted.url;
    }
    // Salt unset — fall back to the session-gated proxy. Derive the same attr
    // from the same rounded integers so the two paths stay byte-identical.
    const attr = `${roi.externalId}_t${gluedUtcTimestamp(Math.round(rawStartMs))}Z.` +
        `${gluedUtcTimestamp(Math.round(rawEndMs))}Z_${asset}`;
    return `/legacy-api/ingest/recordings/${attr}`;
}

module.exports = {
    mediaStreamToken,
    mediaAssetExpiry,
    mediaAssetUrl,
    gluedUtcTimestamp,
    MEDIA_ASSET_PATH,
    arbimon2PublicUrl,
    arbimon2PublicUrlBase,
    roiSpectrogramUrl
};
