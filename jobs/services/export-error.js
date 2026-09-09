const fs = require('fs')

// Pure helpers for recording export failures.
//
// Deliberately a standalone module with NO db/aws imports so it can be unit
// tested without loading the whole export job's connection stack (the same
// reason app/utils/date-range-fastpath.js exists).

/**
 * Render an error for the `error` column of recordings_export_parameters.
 *
 * TWO HAZARDS, both previously solved only inside the Pattern Matchings
 * branch and now shared by every branch:
 *
 * 1. `JSON.stringify(anError)` === '{}'. Error's own properties (message,
 *    stack) are NON-ENUMERABLE, so the obvious implementation destroys the
 *    diagnosis at the moment of recording. Measured on prod 2026-09-09:
 *    15 stranded export rows (6 real users, oldest 2023-10-10) ALL carry the
 *    literal '{}' and are now permanently undiagnosable.
 *
 * 2. `updateExportRecordings` interpolates this value inside a single-quoted
 *    SQL literal WITHOUT escaping, so a stack trace containing a quote,
 *    backslash or newline would break the UPDATE and throw again -- turning
 *    the error-recording path into a second failure.
 *
 * @param {*} e - anything thrown (Error, object, string)
 * @returns {string} a single-line, SQL-safe, <=2000 char description
 */
function formatExportError (e) {
    const raw = e instanceof Error ? (e.message || String(e)) : JSON.stringify(e)
    return String(raw).replace(/[\\']/g, ' ').replace(/\s+/g, ' ').slice(0, 2000)
}

/**
 * True when collectData produced a file with NO ROWS AT ALL (0 bytes).
 *
 * The CSV header is written inside writeChunk(), which never runs when there
 * are no chunks -- so "no results" is unambiguously 0 bytes, not header-only.
 *
 * ⚠️ Returns FALSE for a missing/unstattable path. That is deliberate and is
 * the load-bearing case: collectData passes filePath=undefined on early
 * failures, and an fs fault must NEVER be answered with "no matching
 * recordings" -- that would turn a real failure into a false, confident answer
 * to the user.
 *
 * @param {string|undefined|null} filePath
 * @returns {boolean}
 */
function isEmptyExportFile (filePath) {
    // NOTE: this early return is BEHAVIOURALLY REDUNDANT -- statSync(undefined)
    // throws and the catch below already yields false (verified by mutation
    // test: removing this line keeps all 5 tests green). It is kept because it
    // states the intent explicitly rather than depending on a throw for
    // control flow, and because the falsy case is the one that must never be
    // reported as "no matching recordings". Do not read its presence as
    // evidence of a behaviour the tests pin.
    if (!filePath) { return false }
    try { return fs.statSync(filePath).size === 0 } catch (e) { return false }
}

module.exports = { formatExportError, isEmptyExportFile }