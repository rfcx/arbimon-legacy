/* jshint node:true */
'use strict';

// 2026-10-08: the staff checks were `email.includes('rfcx.org')`, which a
// spoofed address such as `x@rfcx.org.evil.com` passes. They now share
// app/utils/rfcx-staff.js (exact domain match).
//
// Run: node test/rfcx-staff-email.test.js
//
// Block 1 tests the helper; every spoof listed PASSED the old substring test
// (red-tested 2026-10-08 on rfcx/arbimon#2818: the old logic fails 8/16).
// The in-file negative control was removed because CodeQL flags the very
// anti-pattern it demonstrated. Block 2 checks the SHIPPED call sites by
// source: no staff check may use a substring test again.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isRfcxStaffEmail } = require('../app/utils/rfcx-staff');

let pass = 0;
let fail = 0;
function ok (label, cond) {
    try {
        assert.ok(cond);
        console.log('  ok   ' + label);
        pass++;
    } catch (e) {
        console.log('  FAIL ' + label);
        fail++;
    }
}

const staff = ['topher@rfcx.org', 'support@rfcx.org', 'Support@RFCX.org', '  arbimon-admin@rfcx.org  '];
const spoofs = ['x@rfcx.org.evil.com', 'rfcx.org@gmail.com', 'someone@notrfcx.org', 'someone@evil-rfcx.org', 'someone@rfcx.org.com', 'someone@mail.rfcx.org', 'rfcx.org'];
const junk = [undefined, null, '', '@rfcx.org', 'someone@gmail.com', 42];

console.log('helper');
staff.forEach(e => ok('accepts staff ' + JSON.stringify(e), isRfcxStaffEmail(e) === true));
spoofs.forEach(e => ok('rejects spoof ' + JSON.stringify(e), isRfcxStaffEmail(e) === false));
junk.forEach(e => ok('rejects junk ' + JSON.stringify(e), isRfcxStaffEmail(e) === false));

console.log('shipped call sites');
const root = path.join(__dirname, '..');
const sites = ['app/model/users.js', 'app/routes/project.js', 'app/model/pattern_matchings.js'];
sites.forEach(rel => {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    ok(rel + ' uses isRfcxStaffEmail', src.includes('isRfcxStaffEmail('));
    ok(rel + " has no includes('rfcx.org')", !/includes\(\s*['"]@?rfcx\.org['"]\s*\)/.test(src));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);