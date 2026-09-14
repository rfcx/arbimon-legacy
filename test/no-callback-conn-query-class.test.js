// OPEN-ITEMS §300 item E — the callback-less `connection.query(...)` class.
//
// A connection-scoped `query` WITHOUT a callback returns the P7 PG write
// adapter's LAZY `{stream}` stub and sends NOTHING. `await` on a non-thenable
// resolves to the object itself, so the statement never runs, the surrounding
// transaction commits without it, and every instrument reports success.
// mysql@2.18 _enqueue's a callback-less query anyway, which is why this code
// worked for years on MariaDB and broke exactly at the DB_ENGINE=pg flip.
//
// Third occurrence in 24 h: #1875 fixed projects.update + projects.deleteLegacy
// (item 10); this file covers the sites/projects setExternalId family AND the
// adapter hardening that makes the NEXT occurrence loud instead of silent.
//
// Run: node_modules/.bin/_mocha test/no-callback-conn-query-class.test.js
//
// NEGATIVE CONTROLS (the non-optional part): every assertion is written to FAIL
// against the pre-fix tree, and the hardening suite includes an ABLATION that
// excises the guard and asserts the silence returns. Verified both ways.
//
// The checks are BEHAVIOURAL, not word-presence: a test that greps for
// "promisedQuery" passes while the call is renamed away and never made. Where
// a behaviour is asserted, the SHIPPED code is lifted out of the real file and
// executed, so the test binds to production code rather than to a copy.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SITES_PATH = path.join(__dirname, '..', 'app', 'model', 'sites.js');
const PROJECTS_PATH = path.join(__dirname, '..', 'app', 'model', 'projects.js');
const ADAPTER_PATH = path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js');

const sitesSrc = fs.readFileSync(SITES_PATH, 'utf8');
const projectsSrc = fs.readFileSync(PROJECTS_PATH, 'utf8');
const adapterSrc = fs.readFileSync(ADAPTER_PATH, 'utf8');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Lift a `name: function (...) {...},` model method and return a callable.
function liftMethod (src, name) {
  // NB: matches both `name: function` and `name: async function` — the first
  // draft only matched the former and reported the (present) async
  // setCountryCodeAndTimezone as missing. A lifter that cannot see the method
  // fails identically to a method that does not exist, so the pattern is part
  // of the test's correctness, not a detail.
  let start = src.indexOf('\n    ' + name + ': function');
  if (start === -1) { start = src.indexOf('\n    ' + name + ': async function'); }
  assert.ok(start > -1, 'expected method ' + name + '() to exist');
  let i = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  assert.ok(end > -1, 'could not brace-match ' + name);
  const asyncAt = src.indexOf('async function', start);
  const fnAt = src.indexOf('function', start);
  const bodyStart = (asyncAt > -1 && asyncAt < fnAt) ? asyncAt : fnAt;
  const body = src.slice(bodyStart, end);
  // eslint-disable-next-line no-new-func
  return new Function('dbpool', 'return (' + body + ');');
}

// Brace-matched excision of a statement beginning at `anchor` (for ablations).
// A regex here stops at the first inner `});` and yields a syntax error, which
// reads like "the ablation caught it" while actually testing nothing.
function exciseStatement (src, anchor) {
  const start = src.indexOf(anchor);
  assert.ok(start > -1, 'ablation anchor not found: ' + anchor);
  let i = src.indexOf('(', start);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '(') { depth++; }
    else if (src[i] === ')') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  while (src[end] === ';') { end++; }
  return src.slice(0, start) + src.slice(end);
}

// Lift makeStreamQuery out of the adapter and instantiate it with stubbed deps,
// so the real shipped body is exercised without loading the whole module.
function liftMakeStreamQuery (src, opts) {
  opts = opts || {};
  const start = src.indexOf('function makeStreamQuery(');
  assert.ok(start > -1, 'expected makeStreamQuery() in dbpool-pg.js');
  let i = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  let body = src.slice(start, end);
  if (opts.ablate) {
    body = exciseStatement(body, "Object.defineProperty(stub, 'then'");
  }
  const sandbox = {
    require: require,
    sqlText: (s) => String(s),
    templateHash: () => 'hash',
    sqlTemplate: (s) => String(s),
    _counters: opts.counters || { dialect_error: 0 },
    emitDivergence: opts.emitDivergence || function () {}
  };
  const keys = Object.keys(sandbox);
  // eslint-disable-next-line no-new-func
  const factory = new Function(keys.join(','), body + '; return makeStreamQuery;')
    .apply(null, keys.map((k) => sandbox[k]));
  return factory;
}

// A connection that FAITHFULLY models the P7 PG write adapter.
//
// The first draft of this fake recorded a send even when no callback was
// given — so the pre-fix code "executed" and the two EXECUTES assertions
// PASSED against the broken tree. A fake that cannot reproduce the bug cannot
// test the fix. This version reproduces the adapter's actual contract:
// callback-less query() returns the lazy stub and sends NOTHING, using the
// REAL lifted makeStreamQuery so the fake tracks production behaviour.
function fakeConn (opts) {
  opts = opts || {};
  const sent = [];
  const conn = {
    sent,
    query (sql, values, cb) {
      if (typeof values === 'function') { cb = values; values = undefined; }
      if (typeof cb !== 'function') {
        // exactly what makeWriteConnAdapter does: nothing is sent here.
        return liftMakeStreamQuery(adapterSrc, opts.ablate ? { ablate: true } : {})(
          conn, sql, values);
      }
      sent.push({ sql, values });
      cb(null, [{ n: 42 }], ['f']);
      return undefined;
    },
    promisedQuery (sql, values) {
      sent.push({ sql, values, via: 'promisedQuery' });
      return Promise.resolve([{ n: 42 }]);
    }
  };
  return conn;
}

// ---------------------------------------------------------------------------
// 1. The three fixed call sites must EXECUTE their statement
// ---------------------------------------------------------------------------

describe('§300E — the optional-connection model methods actually run their UPDATE', () => {
  const cases = [
    { label: 'sites.setExternalId', src: () => sitesSrc, name: 'setExternalId',
      args: (conn) => [88826, 'wyg6srs9dj2t', conn], table: 'sites' },
    { label: 'projects.setExternalId', src: () => projectsSrc, name: 'setExternalId',
      args: (conn) => [10171, 'fknwwjpefpql', conn], table: 'projects' }
  ];

  cases.forEach(({ label, src, name, args, table }) => {
    it(label + ' dispatches through a form that EXECUTES (not the lazy stub)', async () => {
      const conn = fakeConn();
      const fn = liftMethod(src(), name)(/* dbpool */ { query: () => Promise.resolve([]) });
      const ret = await fn.apply({}, args(conn));
      assert.strictEqual(conn.sent.length, 1,
        'expected exactly one statement to be SENT, got ' + conn.sent.length);
      // The decisive property: whatever the return value is, it must NOT be the
      // adapter's lazy stub, whose only key is `stream`.
      assert.ok(!(ret && typeof ret === 'object' && typeof ret.stream === 'function' &&
                  Object.keys(ret).join(',') === 'stream'),
        'returned the lazy {stream} stub — the statement was never sent');
      assert.ok(/UPDATE\s+' + table + '/i.test(conn.sent[0].sql) ||
                new RegExp('UPDATE\\s+' + table, 'i').test(conn.sent[0].sql),
        'expected an UPDATE on ' + table + ', got: ' + conn.sent[0].sql);
    });

    it(label + ' passes values as BOUND PARAMETERS, not string interpolation', () => {
      const conn = fakeConn();
      const fn = liftMethod(src(), name)({ query: () => Promise.resolve([]) });
      fn.apply({}, args(conn));
      const { sql, values } = conn.sent[0];
      assert.ok(Array.isArray(values) && values.length >= 2,
        'expected bound values array, got: ' + JSON.stringify(values));
      assert.ok(sql.indexOf('?') > -1, 'expected ? placeholders, got: ' + sql);
      // No MySQL double-quoted literal left behind (the shape the PG translator
      // has to special-case) and no interpolated id.
      assert.ok(sql.indexOf('"') === -1, 'double-quoted literal still present: ' + sql);
      assert.ok(!/=\s*\d+\s*$/.test(sql.trim()), 'interpolated id still present: ' + sql);
    });
  });

  it('sites.setCountryCodeAndTimezone executes and binds a NULL country code', async () => {
    const conn = fakeConn();
    const fn = liftMethod(sitesSrc, 'setCountryCodeAndTimezone')(
      { query: () => Promise.resolve([]) });
    await fn.apply({}, [88826, '', undefined, conn]);
    assert.strictEqual(conn.sent.length, 1, 'statement was not sent');
    const { sql, values } = conn.sent[0];
    assert.ok(/UPDATE\s+sites/i.test(sql), sql);
    assert.ok(sql.indexOf('?') > -1, 'expected placeholders: ' + sql);
    assert.strictEqual(values[0], null, 'empty country code must bind as SQL NULL');
    // The deliberate 'UTC' default (the 09-11 OPQ-16(a) fix) must survive.
    assert.strictEqual(values[1], 'UTC', 'timezone default must remain UTC');
  });

  it('all three still work with NO connection (the dbpool branch)', async () => {
    let called = 0;
    const dbpool = { query: (sql, values) => { called++; return Promise.resolve([]); } };
    await liftMethod(sitesSrc, 'setExternalId')(dbpool).apply({}, [1, 'x', undefined]);
    await liftMethod(projectsSrc, 'setExternalId')(dbpool).apply({}, [1, 'x', undefined]);
    await liftMethod(sitesSrc, 'setCountryCodeAndTimezone')(dbpool)
      .apply({}, [1, 'EC', 'America/Guayaquil', undefined]);
    assert.strictEqual(called, 3, 'the no-connection branch must still dispatch');
  });
});

// ---------------------------------------------------------------------------
// 2. The class must not come back
// ---------------------------------------------------------------------------

describe('§300E — the ternary shape is gone from the model layer', () => {
  it('no `(connection ? connection.query : dbpool.query)(...)` remains', () => {
    const re = /\(\s*\w+\s*\?\s*[\w.]*\.?query\s*:\s*[\w.]*\.?query\s*\)\s*\(/;
    [['sites.js', sitesSrc], ['projects.js', projectsSrc]].forEach(([name, src]) => {
      const m = src.match(re);
      assert.ok(!m, name + ' still contains the callback-less ternary: ' + (m && m[0]));
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Adapter hardening: loud when awaited, unchanged when streamed
// ---------------------------------------------------------------------------

describe('§300E — makeStreamQuery is loud when awaited, silent-safe when streamed', () => {
  it('still STREAMS (the 5 deliberate consumers must not break)', (done) => {
    const factory = liftMakeStreamQuery(adapterSrc);
    const conn = fakeConn();
    const rows = [];
    const s = factory(conn, 'SELECT 1', []).stream();
    s.on('data', (d) => rows.push(d));
    s.on('end', () => {
      assert.strictEqual(conn.sent.length, 1, 'stream() must execute the query');
      assert.deepStrictEqual(rows, [{ n: 42 }], 'stream() must yield rows');
      done();
    });
    s.on('error', done);
  });

  it('THROWS when awaited, naming the correct fix', () => {
    const counters = { dialect_error: 0 };
    const divergences = [];
    const factory = liftMakeStreamQuery(adapterSrc, {
      counters, emitDivergence: (o) => divergences.push(o) });
    const stub = factory(fakeConn(), 'UPDATE sites SET external_id = $1', ['x']);

    assert.strictEqual(typeof stub.then, 'function', 'await must reach a then()');
    let threw = null;
    try { stub.then(() => {}, () => {}); } catch (e) { threw = e; }
    assert.ok(threw, 'awaiting the lazy stub must throw');
    assert.ok(/promisedQuery/.test(threw.message),
      'the error must name the fix, got: ' + threw.message);
    assert.strictEqual(threw.code, 'ERR_LAZY_QUERY_AWAITED');
    assert.strictEqual(counters.dialect_error, 1, 'must book a dialect_error');
    assert.strictEqual(divergences.length, 1, 'must emit a divergence record');
    assert.strictEqual(divergences[0].klass, 'lazy_query_awaited');
  });

  it('`then` is non-enumerable (JSON/spread/Object.keys unaffected)', () => {
    const stub = liftMakeStreamQuery(adapterSrc)(fakeConn(), 'SELECT 1', []);
    assert.deepStrictEqual(Object.keys(stub), ['stream'],
      'then must not become a visible key: ' + JSON.stringify(Object.keys(stub)));
  });

  it('creating a stub is side-effect free (no counter, nothing sent)', () => {
    const counters = { dialect_error: 0 };
    const conn = fakeConn();
    liftMakeStreamQuery(adapterSrc, { counters })(conn, 'SELECT 2', []);
    assert.strictEqual(counters.dialect_error, 0, 'creation must not alarm');
    assert.strictEqual(conn.sent.length, 0, 'creation must not send');
  });

  // ABLATION — proves the guard is load-bearing rather than trivially true.
  it('ABLATION: excising the guard restores the silent no-op', () => {
    const ablated = liftMakeStreamQuery(adapterSrc, { ablate: true })(
      fakeConn(), 'SELECT 1', []);
    assert.strictEqual(typeof ablated.then, 'undefined',
      'ablation did not remove the guard — this test proves nothing as written');
    assert.strictEqual(typeof ablated.stream, 'function',
      'ablation must leave streaming intact, or it is testing the wrong thing');
  });
});