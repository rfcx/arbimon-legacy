'use strict';
// Reader-side helpers for the soundscape heat-map GRID (soundscape_grids,
// 2026-09-25/26; design + IRR: rfcx-local
// runbooks/evidence/irr-ledger-20260925-soundscape-grid-and-membership.md).
//
// The grid row carries:
//   grid    bytea  -- v3 exact encoding: gzip( u16 counts[w*h] LE, then the
//                     per-cell sorted float32 amplitudes as delta-coded IEEE
//                     bits, byte-plane shuffled )
//   preview bytea  -- gzip( u8[w*h] ) display-order (TOP row = highest bin)
//                     luminance matrix at the soundscape's STORED settings --
//                     exactly the pre-palette pixel indices of
//                     utils/soundscape-image.js renderSoundscapePng
//   norm_vector jsonb -- FROZEN at creation (never re-queried live)
//
// Everything here is pure/read-only; the DB fetch lives in model.soundscapes
// (getGrid). Used by: the /:soundscape/grid route, the scale route (preview
// recompute), and the arbimon2-asset PNG handler (preview -> palette -> PNG).

const zlib = require('zlib');
const Jimp = require('jimp');
const { loadPalette } = require('./soundscape-image');

/** Decode the v3 grid payload -> { counts: Uint16Array, cells: Float32Array[] }. */
function decodeGrid (gridBuf, width, height) {
    const raw = zlib.gunzipSync(gridBuf);
    const n = width * height;
    const counts = new Uint16Array(n);
    for (let i = 0; i < n; i++) counts[i] = raw.readUInt16LE(i * 2);
    const body = raw.subarray(n * 2);
    const m = body.length / 4;
    const un = Buffer.alloc(body.length);
    for (let b = 0; b < 4; b++) for (let i = 0; i < m; i++) un[i * 4 + b] = body[b * m + i];
    const deltas = new Uint32Array(un.buffer, un.byteOffset, m);
    const cells = new Array(n);
    let k = 0;
    for (let i = 0; i < n; i++) {
        const c = counts[i];
        const bits = new Uint32Array(c);
        let prev = 0;
        for (let j = 0; j < c; j++) { prev = (prev + deltas[k++]) >>> 0; bits[j] = prev; }
        cells[i] = new Float32Array(bits.buffer, bits.byteOffset, c);
    }
    return { counts, cells };
}

function countAbove (sortedAmps, th) {
    let lo = 0, hi = sortedAmps.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sortedAmps[mid] > th) hi = mid; else lo = mid + 1; }
    return sortedAmps.length - lo;
}

/**
 * The u8 luminance matrix (display order: row 0 = highest bin) at the given
 * settings -- mirrors soundscapes/old/soundscape/grid.py preview() and the
 * renderer's scaleFn exactly. `gridRow` = { width, height, offsetx, max_count,
 * max_amp, grid(Buffer), norm_vector(obj|null) }; `sc` = the settings carrier
 * ({ visual_max_value, normalized, threshold, threshold_type }).
 */
function previewMatrix (gridRow, sc) {
    const w = gridRow.width | 0, h = gridRow.height | 0;
    const { counts, cells } = decodeGrid(gridRow.grid, w, h);
    const nv = gridRow.norm_vector || null;
    const offx = gridRow.offsetx | 0;
    let scale = (sc.visual_max_value != null && +sc.visual_max_value > 0) ? +sc.visual_max_value : +gridRow.max_count;
    if (!scale) scale = 1;
    const normalized = !!(sc.normalized | 0) && nv;
    if (normalized) scale = 1;
    let th = +sc.threshold || 0;
    if (th && sc.threshold_type === 'relative-to-peak-maximum') th *= +gridRow.max_amp;
    const out = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) {
        const y = h - 1 - r;
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            let v = (th && cells[i].length) ? countAbove(cells[i], th) : counts[i];
            if (normalized) v = v / (+(nv[offx + x] || nv[String(offx + x)] || 1) || 1);
            out[r * w + x] = Math.max(0, Math.min(Math.trunc(v * 255 / scale), 255));
        }
    }
    return out;
}

/** gzip a preview matrix for storage (matches grid.py: level 6, no timestamp). */
function gzipPreview (matrix) {
    return zlib.gzipSync(Buffer.from(matrix.buffer, matrix.byteOffset, matrix.byteLength), { level: 6 });
}

/** preview bytea -> PNG, colouring the stored u8 matrix through the palette. */
async function previewPng (gridRow, paletteId) {
    const w = gridRow.width | 0, h = gridRow.height | 0;
    if (w <= 0 || h <= 0 || w > 5000 || h > 5000) throw new Error('bad grid dimensions ' + w + 'x' + h);
    const matrix = zlib.gunzipSync(gridRow.preview);
    if (matrix.length !== w * h) throw new Error('preview size mismatch: ' + matrix.length + ' != ' + w + 'x' + h);
    const pal = loadPalette(paletteId);
    const img = new Jimp(w, h);
    const data = img.bitmap.data;
    for (let i = 0; i < matrix.length; i++) {
        const p = pal[matrix[i]];
        const o = i * 4;
        data[o] = p[0]; data[o + 1] = p[1]; data[o + 2] = p[2]; data[o + 3] = 255;
    }
    return img.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { decodeGrid, countAbove, previewMatrix, gzipPreview, previewPng };
