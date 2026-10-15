'use strict';
/**
 * Visualizer PLAYBACK direct to media-api (rfcx-local 2026-10-15, OPEN-ITEMS §468 follow-up; operator goifirr 16:58).
 *
 * The SPA player used to stream `/legacy-api/project/<slug>/recordings/audio/<id>.flac`: cookie-gated, and on a
 * cache miss legacy downloaded the source FLAC, had media-api render the audio, wrote it to its temp cache and
 * re-served it. Tiles (#99), Download and exports already go DIRECT to media-api with a server-minted stream-token.
 * This gives playback the same credential.
 *
 * Returns `{ base, token, exp }` or null:
 *   base  = `/media-api/internal/assets/streams/<streamId>_t<start>Z.<end>Z_`  (the render ASSET is appended by the
 *           client: `rfull_g1_fmp3.mp3`, `r<fmin>.<fmax>_g1_fmp3.mp3`, `..._x<speed>_...`). The token signs the
 *           WINDOW, not the render (media-api re-derives the window from the filename), so one token serves the
 *           band / speed variants of THIS recording's window — exactly what the legacy audio route already lets a
 *           member request through its query params. Verified live 2026-10-15: tampered token / other window -> 401.
 *   token, exp = the stream-token and its (hour-bucketed) expiry.
 *
 * null => the client keeps using `audioUrl` (the legacy route). That is the case for:
 *   - legacy `project_*` recordings (no core stream; mediaStreamId -> null)
 *   - a window media-api will not render (> 15 min; segment-file-parsing.js) — none exist today (max 600 s, 1 % sample)
 *   - an implausible / missing timestamp or duration (mediaAssetUrl rejects it)
 *
 * STREAM ID: from the URI only (mediaStreamId(uri, null)), like attachTileMediaTokens and NOT like buildMediaApiAttr's
 * external_id fallback: the window must be signed for the stream that owns the segments, and a stale external_id
 * (49,249 rows, OPEN-ITEMS #107) would mint a token for the wrong stream -> 401. With the URI-first derivation the
 * minted window is byte-identical to the one legacy's own audio route sends to media-api (buildMediaApiAttr), so the
 * audio is the same render.
 */
const moment = require('moment');
const { mediaAssetUrl, mediaStreamId } = require('./asset-url');

const MEDIA_API_MAX_WINDOW_MS = 15 * 60 * 1000;
const PLACEHOLDER_ASSET = 'rfull_g1_fmp3.mp3';

function recordingAudioMedia (recording) {
    try {
        if (!recording || typeof recording.uri !== 'string') return null;
        const streamId = mediaStreamId(recording.uri, null);
        if (!streamId) return null;
        // MUST be datetime_utc (`datetime` is the TZ-shifted local time). Parsed with moment.utc exactly as
        // buildMediaApiAttr does, so the signed window equals the one legacy's audio route renders.
        const raw = recording.datetime_utc ? recording.datetime_utc : recording.datetime;
        if (!raw) return null;
        const startMs = moment.utc(raw).valueOf();
        const durSec = Number(recording.duration);
        if (!isFinite(startMs) || !isFinite(durSec) || durSec <= 0) return null;
        // buildMediaApiAttr: momentStart.clone().add(duration, 'seconds') — moment rounds fractional seconds to ms.
        const endMs = moment.utc(startMs).add(durSec, 'seconds').valueOf();
        if (endMs - startMs > MEDIA_API_MAX_WINDOW_MS) return null;
        const minted = mediaAssetUrl(streamId, startMs, endMs, PLACEHOLDER_ASSET);
        if (!minted) return null;
        return {
            base: minted.url.slice(0, minted.url.indexOf(PLACEHOLDER_ASSET)),
            token: minted.token,
            exp: minted.exp
        };
    } catch (e) {
        // Never let minting break the info payload: the client falls back to audioUrl.
        console.error('recordingAudioMedia failed, playback will use the legacy route:', e && e.message);
        return null;
    }
}

module.exports = { recordingAudioMedia, MEDIA_API_MAX_WINDOW_MS };