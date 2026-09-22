/* jshint node:true */
'use strict';

// Guard for the 2026-09-22 visualizer fast path: recordings/info must not need
// a media-api render to answer with the tile grid for a non-legacy recording.
// Run: node test/tile-grid-no-render.test.js
//
// Part 1 binds to the SHIPPED tile-grid.js and asserts it reproduces tyler()'s
// grid loop for the widths specWidthForDuration produces (the 6 live-verified
// shapes plus edge widths). Part 2 asserts on the shipped source text of
// fetchSpectrogramTiles so a refactor that reintroduces the render on the
// fast path fails here.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function eq (label, actual, expected) {
    try { assert.deepStrictEqual(actual, expected); console.log('  ok   ' + label); pass++; }
    catch (e) { console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')'); fail++; }
}

const root = path.join(__dirname, '..');
process.chdir(root);
const tileGrid = require(path.join(root, 'app/utils/tile-grid.js'));
const config = require(path.join(root, 'app/config'));

// --- reference: tyler.js grid loop, copied verbatim from app/utils/tyler.js ---
function tylerGrid (width, height) {
    var tileMaxWidth = config("spectrograms").spectrograms.tiles.max_width;
    var tileMaxHeight = config("spectrograms").spectrograms.tiles.max_height;
    var tileCountX = Math.ceil(width / tileMaxWidth);
    var tileCountY = Math.ceil(height / tileMaxHeight);
    var tiles = [];
    for (var x = 0; x < tileCountX; x++) {
        for (var y = 0; y < tileCountY; y++) {
            tiles.push({ x: x, y: y,
                x0: Math.min(x * tileMaxWidth, width), y0: Math.min(y * tileMaxHeight, height),
                x1: Math.min((x + 1) * tileMaxWidth, width) - 1, y1: Math.min((y + 1) * tileMaxHeight, height) - 1 });
        }
    }
    return { width: width, height: height, x: tileCountX, y: tileCountY, set: tiles };
}
// --- reference: specWidthForDuration, lockstep with app/model/recordings.js ---
function specWidthForDuration (duration) {
    var MAX_WIDTH = 10286, MIN_WIDTH = 1024;
    var pixPerSec = config("spectrograms").spectrograms.pixPerSec;
    var dur = parseFloat(duration);
    if (!isFinite(dur) || dur <= 0) return MAX_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(dur * pixPerSec)));
}

console.log('1. tile-grid.gridFor == tyler grid loop, across real durations');
// live-verified 2026-09-22 in the prod pod: (duration -> tiles) 17.18->3, 24->5, 43.28->8, 59->10, 60->11
const liveVerified = { 17.18: 3, 24: 5, 43.28: 8, 59: 10, 60: 11 };
Object.keys(liveVerified).forEach(function (d) {
    const w = specWidthForDuration(d);
    const g = tileGrid.gridFor(w, tileGrid.MEDIA_API_SPECTRO_HEIGHT);
    eq('duration ' + d + ' s -> ' + liveVerified[d] + ' tiles', g.set.length, liveVerified[d]);
    eq('duration ' + d + ' s grid == tyler', g, tylerGrid(w, 255));
});
[0.5, 1, 5.95, 5.96, 30, 59.8, 60.01, 120, 3600].forEach(function (d) {
    const w = specWidthForDuration(d);
    eq('edge duration ' + d + ' s grid == tyler (width ' + w + ')', tileGrid.gridFor(w, 255), tylerGrid(w, 255));
});
eq('exact multiple of tile width (2048) -> 2 tiles, last x1 = 2047', tileGrid.gridFor(2048, 255).set.map(t => t.x1), [1023, 2047]);
eq('one px over (1025) -> 2 tiles, last tile 1 px wide (x0==x1)', tileGrid.gridFor(1025, 255).set[1], { x: 1, y: 0, x0: 1024, y0: 0, x1: 1024, y1: 254 });

console.log('2. canComputeWithoutRender gates');
eq('non-legacy + duration 60 -> true', tileGrid.canComputeWithoutRender({ uri: '2024/03/30/x/y.flac', duration: 60 }, false), true);
eq('non-legacy + duration "60" (string from DB) -> true', tileGrid.canComputeWithoutRender({ uri: 'a.flac', duration: '60' }, false), true);
eq('legacy project_ uri -> false (sox-rendered PNG, width unknown)', tileGrid.canComputeWithoutRender({ uri: 'project_1/x.wav', duration: 60 }, true), false);
eq('missing duration -> false (fall back to render)', tileGrid.canComputeWithoutRender({ uri: 'a.flac' }, false), false);
eq('duration 0 -> false', tileGrid.canComputeWithoutRender({ uri: 'a.flac', duration: 0 }, false), false);
eq('duration NaN -> false', tileGrid.canComputeWithoutRender({ uri: 'a.flac', duration: 'abc' }, false), false);
eq('null recording -> false', tileGrid.canComputeWithoutRender(null, false), false);

console.log('3. shipped fetchSpectrogramTiles takes the fast path before any fetch');
const src = fs.readFileSync(path.join(root, 'app/model/recordings.js'), 'utf8');
const fn = src.slice(src.indexOf('fetchSpectrogramTiles: function'), src.indexOf('attachTileMediaTokens: function'));
eq('requires tile-grid', /require\('\.\.\/utils\/tile-grid\.js'\)/.test(src), true);
eq('fast-path gate present', /tileGrid\.canComputeWithoutRender\(recording, isLegacy\)/.test(fn), true);
eq('fast path returns gridFor(specWidthForDuration(duration), 255-const)', /tileGrid\.gridFor\(width, tileGrid\.MEDIA_API_SPECTRO_HEIGHT\)/.test(fn), true);
eq('fast-path gate comes BEFORE fetchSpectrogramFile in the function', fn.indexOf('canComputeWithoutRender') < fn.indexOf('fetchSpectrogramFile'), true);
eq('render path still present for legacy/fallback', /Recordings\.fetchSpectrogramFile\(recording, function\(err, specFile\)/.test(fn), true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);