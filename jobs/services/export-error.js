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

module.exports = { formatExportError }