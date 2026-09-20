// OPQ-5 (RULED DISARM 2026-09-12) -> RETIRED at P7 step 5 (2026-09-20, rfcx-local
// OPEN-ITEMS §320): the MariaDB read-fallback no longer exists at all. This test
// used to pin the DISARMED default of DB_PG_FALLBACK; it now pins its ABSENCE, so a
// re-introduction of a second engine behind a flag fails here.
// String-level, no live DB. Negative control: FAILS against the pre-step-5 tree.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const strip = s => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const pgSrc = strip(fs.readFileSync(path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js'), 'utf8'));
const dbSrc = strip(fs.readFileSync(path.join(__dirname, '..', 'app', 'utils', 'dbpool.js'), 'utf8'));

describe('P7 step 5 — the DB_PG_FALLBACK read-fallback (OPQ-5) is retired, not merely disarmed', function () {
  it('dbpool-pg.js no longer reads DB_PG_FALLBACK or defines PG_ROUTE_FALLBACK', function () {
    assert.ok(!/process\.env\.DB_PG_FALLBACK/.test(pgSrc), 'DB_PG_FALLBACK is still read');
    assert.ok(!/PG_ROUTE_FALLBACK/.test(pgSrc), 'PG_ROUTE_FALLBACK is still defined');
    assert.ok(!/pgFallbackEnabled/.test(pgSrc), 'pgFallbackEnabled is still exported');
  });

  it('dbpool.js has no MariaDB fallback closure and no MariaDB pool', function () {
    assert.ok(!/mysqlFallback/.test(dbSrc), 'mysqlFallback closure still present');
    assert.ok(!/getMysqlConnection/.test(dbSrc), 'getMysqlConnection still present');
    assert.ok(!/mysql\.createPool/.test(dbSrc), 'mysql.createPool still present');
    assert.ok(!/pgFallbackEnabled/.test(dbSrc), 'dbpool.js still consults pgFallbackEnabled');
  });

  it('a routed-read failure surfaces to the caller (no retry on another engine)', function () {
    // The exact shape: pgReadQuery's error callback returns callback(pgErr) directly.
    assert.ok(/pgshadow\.pgReadQuery\(pgFinal, function \(pgErr, rows\) \{\s*\n\s*if \(pgErr\) \{ return callback\(pgErr\); \}/.test(dbSrc),
      'expected the routed read to hand pgErr straight to the caller');
  });

  it('CONTROL: mysql.format is STILL required — it renders placeholders for the PG path', function () {
    assert.ok(/require\('mysql'\)/.test(dbSrc), 'dbpool.js must keep the mysql formatter');
    assert.ok(/mysql\.format\(rawSql, options, false/.test(dbSrc) || /mysql\.format\(/.test(dbSrc),
      'mysql.format must still render the routed-read SQL');
    // positive control for the negative asserts above: a token that IS present is detected
    assert.ok(/getWriteConnection/.test(dbSrc), 'positive control: getWriteConnection is present');
  });
});
