/* jshint node:true */
'use strict';
/**
 * Pure tile-grid computation for the visualizer's spectrogram tiles.
 *
 * WHY THIS EXISTS (2026-09-22, measured on prod):
 * `GET /legacy-api/project/:p/recordings/info/:id` is what the SPA visualizer
 * waits on before it can paint ANYTHING for a newly selected recording, and
 * its cold path was 2–11 s: fetchSpectrogramTiles downloaded the whole FLAC
 * from S3, asked media-api for a full-width 10286×255 render of the recording,
 * and ran the PNG through Jimp — solely so `tyler()` could read the image's
 * width/height and cut it into a grid of ≤1024-px tiles. The browser never
 * displays that image: since 2026-08-10 it mints its own 512×1024 media-api
 * tile URLs from the grid's time windows (`attachTileMediaTokens`).
 *
 * For a NON-legacy recording the render's dimensions are fully determined by
 * the request we make: width = specWidthForDuration(duration) (the `d<w>.255`
 * asset attr), height = 255. So the grid is a pure function of `duration` and
 * the tiles config, and the fetch+render+decode is pure waste on this route.
 *
 * Verified before shipping, in the live pod, against the real render path
 * (fetchSpectrogramTiles → media-api → tyler) on 6 recordings spanning
 * 17.18 s / 24 s / 43.28 s / 59 s / 60 s at 44.1 and 48 kHz: tile counts and
 * every (j, i, x, y, w, h) tuple MATCH 6/6.
 *
 * Kept in lockstep with app/utils/tyler.js: the loop below is tyler's grid
 * loop verbatim (same Math.ceil / Math.min / -1 conventions). tyler() is still
 * used for legacy `project_*` recordings (whose PNG is rendered locally by sox
 * and whose width is NOT known up front) and as the fallback when `duration`
 * is missing or nonsensical.
 */

var config = require('../config');

/**
 * @param {number} width   base spectrogram width in px (specWidthForDuration)
 * @param {number} height  base spectrogram height in px (255 for media-api spectro assets)
 * @returns {{width:number,height:number,x:number,y:number,set:Array}} same shape as tyler()'s result
 */
function gridFor(width, height) {
    var tileMaxWidth = config("spectrograms").spectrograms.tiles.max_width;
    var tileMaxHeight = config("spectrograms").spectrograms.tiles.max_height;

    var tileCountX = Math.ceil(width / tileMaxWidth);
    var tileCountY = Math.ceil(height / tileMaxHeight);

    var tiles = [];
    for (var x = 0; x < tileCountX; x++) {
        for (var y = 0; y < tileCountY; y++) {
            tiles.push({
                x: x,
                y: y,
                x0: Math.min(x * tileMaxWidth, width),
                y0: Math.min(y * tileMaxHeight, height),
                x1: Math.min((x + 1) * tileMaxWidth, width) - 1,
                y1: Math.min((y + 1) * tileMaxHeight, height) - 1
            });
        }
    }

    return { width: width, height: height, x: tileCountX, y: tileCountY, set: tiles };
}

/** The media-api `spectro` asset is always requested at this height (see
 *  buildMediaApiAttr: `..._d${width}.255_...`). */
var MEDIA_API_SPECTRO_HEIGHT = 255;

/**
 * True when the grid can be computed without fetching anything: a non-legacy
 * recording with a finite positive duration. `specWidthForDuration` already
 * falls back to the historical constant on a bad duration, but a bad duration
 * ALSO means the S3/media-api path would be asked for a window we do not
 * trust, so we let the render path handle that case as before.
 */
function canComputeWithoutRender(recording, isLegacy) {
    if (!recording || isLegacy) return false;
    var dur = parseFloat(recording.duration);
    return isFinite(dur) && dur > 0;
}

module.exports = {
    gridFor: gridFor,
    canComputeWithoutRender: canComputeWithoutRender,
    MEDIA_API_SPECTRO_HEIGHT: MEDIA_API_SPECTRO_HEIGHT
};