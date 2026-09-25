/* jshint node:true */
'use strict';
/**
 * Server-provided tile URLs for LEGACY (`project_*`) recordings.
 *
 * WHY THIS LIVES HERE (2026-09-25, operator ruling 18:46): legacy uploads are an
 * arbimon2 storage-layout concern, and the modern SPA should not have to know
 * about them. Legacy recordings have no core stream, so no media-api tile exists
 * and `attachTileMediaTokens` (app/model/recordings.js) signs nothing for them.
 * The SPA visualizer therefore has no URL to build, and rendered the whole
 * spectrogram BLACK (operator report 14:51, /p/1485-juliana-project/…/rec/54462858).
 *
 * The SPA already falls back to a server-supplied `tile.src` whenever it cannot
 * build a media-api URL itself (`tileSrcs[i] ?? tile.src`), so setting `src`
 * here is all it takes. No legacy-specific code is needed in the modern app.
 * (A client-side version, rfcx/arbimon #2745, shipped briefly and is reverted
 * in favour of this.)
 *
 * The URL is this router's own project-scoped tile route
 * (`GET /legacy-api/project/:p/recordings/tiles/:id/:i/:j/:key`), the one the
 * AngularJS visualizer builds for itself. It renders server-side from the
 * arbimon2 audio object (sox → one fixed 1023×255 PNG per tile), so the SPA's
 * palette and resolution controls do not apply. The last segment is a cache key
 * that the route ignores; it is kept stable so browsers can cache the tile.
 *
 * Only LEGACY recordings are touched. Non-legacy tiles keep NO `src`: the SPA
 * builds those from the signed media-api fields, and leaving `src` unset keeps
 * that path exactly as it was.
 *
 * DELETE WHEN legacy recordings are migrated to core streams (then they take
 * the media-api path like every other recording).
 *
 * @param {Object} recording  the info payload; needs `uri`, `id`, `tiles.set`
 * @param {string} recordingsBase  `/legacy-api/project/<slug>/recordings`
 *                                 (the same prefix `imageUrl`/`audioUrl` use)
 * @return {number} how many tiles got a `src` (0 for non-legacy)
 */
function isLegacyUri (uri) {
    // Same predicate as Recordings.isLegacy (app/model/recordings.js).
    return typeof uri === 'string' && uri.startsWith('project_');
}

function attachLegacyTileSrc (recording, recordingsBase) {
    if (!recording || !isLegacyUri(recording.uri)) return 0;
    if (!recordingsBase || !recording.tiles || !Array.isArray(recording.tiles.set)) return 0;
    let n = 0;
    recording.tiles.set.forEach(function (tile) {
        if (!tile || !Number.isInteger(tile.i) || !Number.isInteger(tile.j)) return;
        tile.src = recordingsBase + '/tiles/' + recording.id + '/' + tile.i + '/' + tile.j + '/t';
        n++;
    });
    return n;
}

module.exports = { attachLegacyTileSrc: attachLegacyTileSrc };