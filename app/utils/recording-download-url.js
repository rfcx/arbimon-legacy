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

module.exports = { recordingDownloadUrl };