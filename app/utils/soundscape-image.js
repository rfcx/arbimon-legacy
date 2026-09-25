'use strict';
// Server-side render of a soundscape heat-map PNG from its `.scidx` index
// (2026-09-24). Replaces the pre-baked `arbimon2/project_N/soundscapes/<id>/image.png`
// which (a) had to be served from the public, signature-ignoring storage host and
// (b) had been DELETED for most soundscapes by the §275 retirement (4,267 of the
// 4,958 internet requests for soundscape images in the week to 2026-09-24 were 404s).
//
// A soundscape is NOT a spectrogram (it aggregates a whole playlist), so media-api
// cannot render it. This is a straight port of the Python writer
// (lib/soundscape/soundscape.py write_image + rows_gen/cols_gen, driven by
// lib/soundscape/set_visual_scale_lib.py) -- the same algorithm the SPA already
// re-implements in the browser (sidebar-soundscape-drawer.vue):
//
//   scale     = visual_max_value || max_count            (clip_max overrides max_count)
//   value     = count of recordings in the cell, OR (threshold set) count of
//               amplitudes > th, where th = threshold * maxAmp when
//               threshold_type == 'relative-to-peak-maximum'
//   normalized: value / (norm_vector[col] || 1), scale forced to 1
//   pixel     = clamp(int(value * 255 / scale), 0, 255) -> palette[pixel]
//   rows      = drawn TOP = highest frequency bin (y from height-1 down to 0)
//   width     = the scidx width (offsetx .. offsetx+width-1), height = scidx height
//
// Palette: the 256-entry palettes the legacy UI already ships as
// public/images/palettes/<id>.png (BMP-encoded, 1x256, 8-bit indexed, bottom
// row = index 0 -- export_palette() writes rows [h-i-1]). Read once, cached.

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const PALETTE_DIR = path.resolve(__dirname, '..', '..', 'public', 'images', 'palettes');
const paletteCache = new Map();

// Parse a Windows BMP 8-bit indexed 1xN palette strip -> array of [r,g,b] by INDEX.
// The strip's pixel at row r holds palette index (h - r - 1) as written by
// export_palette(), so reading the colour TABLE directly (index -> BGRA) is exact
// and independent of row order.
function loadPalette (id) {
    const n = Number.isInteger(+id) ? Math.abs(+id) : 1;
    const files = fs.readdirSync(PALETTE_DIR).filter(f => /^\d+\.png$/.test(f));
    const count = files.length || 1;
    const pid = n % count; // get_palette(id) == palette[id % len(palette)]
    if (paletteCache.has(pid)) return paletteCache.get(pid);
    const buf = fs.readFileSync(path.join(PALETTE_DIR, pid + '.png'));
    if (buf.toString('ascii', 0, 2) !== 'BM') throw new Error('palette ' + pid + ' is not a BMP strip');
    const bitsOffset = buf.readUInt32LE(10);
    const dibSize = buf.readUInt32LE(14);
    const bpp = buf.readUInt16LE(28);
    if (bpp !== 8) throw new Error('palette ' + pid + ' is not 8-bit');
    let colors = buf.readUInt32LE(46) || 256;
    const tableStart = 14 + dibSize;
    colors = Math.min(colors, Math.floor((bitsOffset - tableStart) / 4));
    const pal = [];
    for (let i = 0; i < colors; i++) {
        const o = tableStart + i * 4;
        pal.push([buf[o + 2], buf[o + 1], buf[o]]); // BGRA -> RGB
    }
    while (pal.length < 256) pal.push(pal[pal.length - 1] || [0, 0, 0]);
    paletteCache.set(pid, pal);
    return pal;
}

/**
 * @param {object} sc      soundscape row (visual_max_value, visual_palette, normalized, threshold, threshold_type)
 * @param {object} idx     read scidx: { index: {y: {x: [recIdxArray, ampArray|null]}}, width, height, offsetx, offsety, stats: {maxAmp} }
 * @param {object} [normVector] {col: count} (required only when sc.normalized)
 * @returns {Promise<Buffer>} PNG bytes
 */
async function renderSoundscapePng (sc, idx, normVector) {
    const width = idx.width | 0, height = idx.height | 0;
    if (width <= 0 || height <= 0 || width > 5000 || height > 5000) throw new Error('bad scidx dimensions ' + width + 'x' + height);
    const offx = idx.offsetx | 0, offy = idx.offsety | 0;
    const pal = loadPalette(sc.visual_palette);

    // max_count over the file (Soundscape.read_from_index stats) -- the count of the busiest cell
    let maxCount = 0;
    for (const y in idx.index) for (const x in idx.index[y]) {
        const c = idx.index[y][x]; const n = c && c[0] ? c[0].length : 0;
        if (n > maxCount) maxCount = n;
    }
    let scale = (sc.visual_max_value !== null && sc.visual_max_value !== undefined && +sc.visual_max_value > 0) ? +sc.visual_max_value : maxCount;
    if (!scale) scale = 1;
    const normalized = !!(sc.normalized | 0) && normVector;
    if (normalized) scale = 1;
    let ampTh = +sc.threshold || 0;
    if (ampTh && sc.threshold_type === 'relative-to-peak-maximum') ampTh = ampTh * ((idx.stats && idx.stats.maxAmp) || 0);

    const scaleFn = (v, col) => {
        if (normalized) { const nv = +(normVector[col] || 1) || 1; v = v / nv; }
        return Math.max(0, Math.min(Math.trunc(v * 255.0 / scale), 255));
    };

    const img = new Jimp(width, height);
    const data = img.bitmap.data;
    for (let r = 0; r < height; r++) {           // output row r = bin y (height-1-r)
        const y = offy + (height - 1 - r);
        const row = idx.index[y];
        for (let c = 0; c < width; c++) {
            const x = offx + c;
            const cell = row && row[x];
            let v = 0;
            if (cell) {
                if (ampTh && cell[1]) { let a = 0; for (const amp of cell[1]) if (amp > ampTh) a++; v = a; }
                else v = cell[0] ? cell[0].length : 0;
            }
            const p = pal[scaleFn(v, x)];
            const o = (r * width + c) * 4;
            data[o] = p[0]; data[o + 1] = p[1]; data[o + 2] = p[2]; data[o + 3] = 255;
        }
    }
    return img.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { renderSoundscapePng, loadPalette };