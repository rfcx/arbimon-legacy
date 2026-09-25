'use strict';
// Build the user-facing download link for a recording in an export.
//
// WHY (2026-09-24): pattern-matching exports used to embed raw storage "presigned"
// URLs (https://s3.arbimon.org/<bucket>/<key>?AWSAccessKeyId=..&Expires=..&Signature=..).
// Our storage chain (s3-proxy -> s3-reader) does NOT validate the caller's
// signature, so those links were really permanent, anonymous links to
// private-project audio. Tampered signature, Expires=1, and no query string at
// all were all measured to return 200. The "7-day expiry" did nothing.
//
// This is the same link the recordings export's `url` column already emits: the
// legacy download route, which streams the audio only to a signed-in user with
// access to the project (auth- and permission-gated by the web app).
//
// Used by BOTH the queued PM zip export (jobs/) and the per-job PM CSV route
// (app/routes/data-api/project/pattern_matchings.js), so the two can't drift.

const DEFAULT_PUBLIC_URL = 'https://arbimon.org';

function recordingDownloadUrl (publicUrl, projectUrl, recordingId) {
    if (!projectUrl || recordingId === undefined || recordingId === null || recordingId === '') return null;
    const base = String(publicUrl || DEFAULT_PUBLIC_URL).replace(/\/+$/, '');
    return `${base}/legacy-api/project/${encodeURIComponent(projectUrl)}/recordings/download/${encodeURIComponent(String(recordingId))}`;
}

// EXPORT AUDIO LINK (2026-09-24, operator): a media-api WAV of the WHOLE recording,
// signed with a stream-token whose `exp` is 7 days -- the same lifetime as the
// archive link that delivers the export. The token is the credential, so the
// link works without a login (wget/scripts), expires, and cannot be widened
// (extended exp / other window / tampered token all 401 -- verified live).
//
// Falls back to the auth-gated legacy download route (recordingDownloadUrl) when
// a media-api URL cannot be built: legacy `project_*` uploads have no stream
// id; media-api refuses windows > 15 min; or the salt/timestamps are unusable.
const EXPORT_LINK_TTL_SECONDS = 7 * 24 * 3600;
const MEDIA_API_MAX_WINDOW_MS = 15 * 60 * 1000;

function exportAudioUrl (publicUrl, projectUrl, rec) {
    if (!rec) return null;
    const { mediaAssetUrl, mediaStreamId } = require('./asset-url');
    const base = String(publicUrl || DEFAULT_PUBLIC_URL).replace(/\/+$/, '');
    const streamId = mediaStreamId(rec.uri, rec.external_id);
    const startRaw = rec.datetime_utc || rec.datetime;
    // DB timestamps arrive as naive UTC strings ('YYYY-MM-DD HH:MM:SS[.fff]') or Dates.
    const startMs = startRaw instanceof Date ? startRaw.getTime()
        : (typeof startRaw === 'string' ? Date.parse(startRaw.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(startRaw) ? '' : 'Z')) : NaN);
    const durSec = Number(rec.duration);
    // Math.trunc matches moment .add() -- the same derivation classifications.js uses,
    // so the signed window and the filename window cannot drift (the 08-10 1-ms 401 class).
    const durMs = isFinite(durSec) ? Math.trunc(durSec * 1000) : NaN;
    if (streamId && isFinite(startMs) && isFinite(durMs) && durMs > 0 && durMs <= MEDIA_API_MAX_WINDOW_MS) {
        const minted = mediaAssetUrl(streamId, startMs, startMs + durMs, 'rfull_g1_fwav.wav', { ttlSeconds: EXPORT_LINK_TTL_SECONDS });
        if (minted) return base + minted.url;
    }
    return recordingDownloadUrl(publicUrl, projectUrl, rec.recording_id);
}

module.exports = { recordingDownloadUrl, exportAudioUrl, EXPORT_LINK_TTL_SECONDS, MEDIA_API_MAX_WINDOW_MS };