// OPQ-5 (RULED DISARM 2026-09-12): the read-fallback to MariaDB is disarmed BY DEFAULT.
// Asserts the shape of the default in dbpool-pg.js — string-level, no live DB.
// Negative control: this test FAILS against the pre-OPQ-5 tree (default was '1').
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js'), 'utf8');

describe('OPQ-5 — DB_PG_FALLBACK is disarmed by default at the flip', function () {
  it('the PG_ROUTE_FALLBACK default is the disarmed value', function () {
    // The armed default is `|| '1'`; disarmed is `|| '0'`. After the flip the
    // deliberate re-arm path is env DB_PG_FALLBACK=1.
    assert.ok(
      /var PG_ROUTE_FALLBACK = \(process\.env\.DB_PG_FALLBACK \|\| '0'\) !== '0'/.test(src),
      'expected PG_ROUTE_FALLBACK to default to disarmed (\'0\')'
    );
  });

  it('no armed default remains on the PG_ROUTE_FALLBACK assignment', function () {
    assert.ok(
      !/var PG_ROUTE_FALLBACK = \(process\.env\.DB_PG_FALLBACK \|\| '1'\) !== '0'/.test(src),
      'an armed default (\'1\') is still present'
    );
  });

  it('the env still overrides the default both ways (re-arm and re-disarm)', function () {
    // The expression form `(process.env.X || '0') !== '0'` means env '1' re-arms and
    // env '0' (or unset) leaves it disarmed. Assert the override shape is intact.
    assert.ok(
      /process\.env\.DB_PG_FALLBACK \|\| '0'\) !== '0'/.test(src),
      'the env override shape changed — re-arm via DB_PG_FALLBACK=1 would break'
    );
  });
});
