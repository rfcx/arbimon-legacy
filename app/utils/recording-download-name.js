'use strict';
// Download filename for a recording (operator 2026-09-25 09:22):
//   "the download filename [is] the original recording name. If the original
//    recording was split into segments, then there should be a '.001.wav' for
//    that segment number."
//
// A long upload is ingested as ONE Arbimon recording per segment, and every
// segment row keeps the ORIGINAL upload filename (measured: a 5 h
// `20260920_050000.WAV` = 300 rows sharing site_id + filename). There is no
// stored segment number, so it is DERIVED: the 1-based position of this row
// among the rows with the same (site_id, filename), ordered by datetime then
// recording_id (index recordings_site_filename_idx covers the lookup).
//
// Pure and dependency-free so it is unit-testable.

// Keep the name recognisably the uploader's, but never let it carry a path or
// a header-breaking character into Content-Disposition / <a download>.
function sanitizeStem (name) {
    const base = String(name || '').split(/[\\/]/).pop().trim();
    const stem = base.replace(/\.[^.]+$/, '');
    // control chars, quotes and the chars Windows forbids in filenames
    return stem.replace(/[\u0000-\u001f\u007f"*:<>?|]/g, '_').trim();
}

/**
 * @param {object} rec        recording row: { filename, recording_id }
 * @param {number} index      1-based segment position (see above)
 * @param {number} count      rows sharing site_id + filename
 * @returns {string} e.g. "20210405_003000.wav" or "20260920_050000.001.wav"
 */
/**
 * The original upload name. Modern rows carry it in `filename`; legacy
 * `project_*` rows have NO filename (measured: rec 126313, filename empty),
 * but their storage key IS the uploaded name
 * (`project_38/site_211/2015/2/T34_20150225_190000.flac`). Modern keys are
 * storage UUIDs (`2021/04/05/<stream>/<uuid>.flac`) and must never be used.
 */
function originalName (rec) {
    if (!rec) return '';
    if (rec.filename && String(rec.filename).trim()) return rec.filename;
    if (typeof rec.uri === 'string' && rec.uri.indexOf('project_') === 0) return rec.uri;
    return '';
}

function recordingDownloadName (rec, index, count) {
    const stem = sanitizeStem(originalName(rec)) || `recording-${rec && rec.recording_id}`;
    if (count > 1 && index >= 1) {
        const width = Math.max(3, String(count).length);
        return `${stem}.${String(index).padStart(width, '0')}.wav`;
    }
    return `${stem}.wav`;
}

module.exports = { recordingDownloadName, sanitizeStem, originalName };