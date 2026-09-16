/* jshint node:true */
'use strict';

// OPEN-ITEMS §271: the request logger wrote the caller's COMPLETE credential
// (cookie id_token OR Authorization bearer header) into pod logs, which
// promtail ships to Loki (retention 336h). Measured 2026-09-15: 100% of
// sampled tokens were still valid when read, with 29-362 days of life left.
//
// Run: node test/jwt-log-redaction.test.js
//
// These assert on the SHIPPED modules, so a regression in the real files fails
// the test. The last block is a NEGATIVE CONTROL on the real line builder: it
// FAILS against the pre-fix code, which interpolated the raw token.

const assert = require('assert');

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
function eq (label, actual, expected) {
    try {
        assert.deepStrictEqual(actual, expected);
        console.log('  ok   ' + label);
        pass++;
    } catch (e) {
        console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) +
                    ', want ' + JSON.stringify(expected) + ')');
        fail++;
    }
}

// A syntactically real but WORTHLESS token: signed by nothing, dummy payload.
// Never put a real credential in a test fixture.
const FAKE_JWT = [
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJzdWIiOiJ0ZXN0LXN1YmplY3QiLCJleHAiOjk5OTk5OTk5OTl9',
    'c2lnbmF0dXJlLXBsYWNlaG9sZGVy'
].join('.');

const redact = require('../app/utils/logging-redact').redactCredential;

console.log('app/utils/logging-redact');
const bearer = redact('Bearer ' + FAKE_JWT);
ok('a bearer token does not survive redaction', bearer.indexOf(FAKE_JWT) === -1);
ok('no JWT segment survives (a prefix would still carry the identity)',
    FAKE_JWT.split('.').every(function (s) { return bearer.indexOf(s) === -1; }));
ok('not even the "eyJ" opening survives', bearer.indexOf('eyJ') === -1);
ok('scheme kept + 8-hex fingerprint added', /^Bearer \[REDACTED:[0-9a-f]{8}\]$/.test(bearer));
eq('fingerprint is stable for one credential', redact('Bearer ' + FAKE_JWT), bearer);
ok('fingerprint differs across credentials', redact('Bearer other.tok.en') !== bearer);

// A cookie-borne id_token arrives as a BARE JWT with no scheme prefix -- this
// app authenticates both ways, so both shapes must be covered.
const bare = redact(FAKE_JWT);
ok('a bare (cookie) token is redacted too', /^\[REDACTED:[0-9a-f]{8}\]$/.test(bare));
ok('bare token leaks nothing', bare.indexOf('eyJ') === -1);

// Anonymous traffic is real signal (measured 173 `Authorization: undefined`
// lines in a 20-minute sample) and must stay distinguishable from a credential.
eq('undefined passes through', redact(undefined), undefined);
eq('the string "undefined" is preserved', redact('undefined'), 'undefined');
eq('"none" is preserved', redact('none'), 'none');
eq('empty string is preserved', redact(''), '');

console.log('app/utils/logging (NEGATIVE CONTROL on the real line builder)');
const buildLogMessage = require('../app/utils/logging').buildLogMessage;
ok('the line builder is reachable', typeof buildLogMessage === 'function');
const line = buildLogMessage({
    method: 'GET',
    url: '/legacy-api/project/some-project/tiering-usage',
    headers: { authorization: 'Bearer ' + FAKE_JWT },
    cookies: {},
    body: {}
}, { statusCode: 200, responseTime: 56 });
ok('the built log line carries no token material', line.indexOf(FAKE_JWT) === -1 && line.indexOf('eyJ') === -1);
ok('the built log line shows the redaction marker', line.indexOf('Authorization: Bearer [REDACTED:') !== -1);
ok('the line SHAPE is unchanged (support greps / Loki rules keep matching)',
    line.indexOf('GET 200 /legacy-api/project/some-project/tiering-usage Response Time: 56') === 0);

// The cookie leg is the one this app uses for browser sessions.
const cookieLine = buildLogMessage({
    method: 'GET',
    url: '/legacy-api/user/projectlist',
    headers: {},
    cookies: { id_token: FAKE_JWT },
    body: {}
}, { statusCode: 200, responseTime: 12 });
ok('the cookie id_token leg is redacted too',
    cookieLine.indexOf(FAKE_JWT) === -1 && cookieLine.indexOf('eyJ') === -1);
ok('the cookie leg shows the redaction marker',
    /Authorization: \[REDACTED:[0-9a-f]{8}\]/.test(cookieLine));

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);