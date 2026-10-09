/* jshint node:true */
'use strict';

/**
 * Is this email an RFCx staff address?
 *
 * EXACT DOMAIN MATCH: the part after the LAST '@' must be exactly
 * `rfcx.org` (case-insensitive, surrounding whitespace ignored).
 *
 * WHY (2026-10-08): the staff checks were `email.includes('rfcx.org')`, a
 * substring test, which `x@rfcx.org.evil.com` or `rfcx.org@gmail.com` pass.
 * Live users table, 2026-10-08: 93 exact `@rfcx.org`, 0 substring-only,
 * 0 case variants, 0 subdomains -- the exact match changes nothing for a
 * real account and closes the spoof.
 *
 * Mirrors `isRfcxStaffEmail` in rfcx/arbimon `packages/common/src/rfcx-staff`.
 * Lives in app/utils because every image stage COPYs app/utils whole.
 */
var RFCX_STAFF_DOMAIN = 'rfcx.org';

function isRfcxStaffEmail (email) {
    if (typeof email !== 'string') return false;
    var normalized = email.trim().toLowerCase();
    var at = normalized.lastIndexOf('@');
    if (at <= 0) return false;
    return normalized.slice(at + 1) === RFCX_STAFF_DOMAIN;
}

module.exports = { isRfcxStaffEmail: isRfcxStaffEmail, RFCX_STAFF_DOMAIN: RFCX_STAFF_DOMAIN };