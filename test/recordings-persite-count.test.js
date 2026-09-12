var expect = require('chai').expect;

// Pure-function guard for the per-site count fan-out runner. Dependency-
// injected (no DB): runQuery is a stub.
var persiteCount = require('../app/utils/persite-count');
var runPerSite = persiteCount.runPerSite;

/**
 * REGRESSION GUARD (P7 pre-flip read-timeout sweep, 2026-09-12).
 *
 * The exact active-recordings count for a project ran as ONE aggregate
 * statement over all of the project's rows — I/O-bound on PG's heap-scattered
 * rows and deterministically over the 8 s routed-read statement_timeout for
 * million-row projects (pg_route_timeout ae287941… / dae78d5b… / cf1aae07…,
 * 89/36/7 events in 24 h). The fan-out runs one bounded statement per site
 * (capped 4-deep) and merges app-side.
 *
 * These tests pin: per-site statements (one per site), the concurrency cap,
 * result alignment (a site whose query returns zero rows must NOT shift the
 * others), error propagation, and site-id hygiene.
 */
describe('per-site count fan-out runner', function () {

  it('runs exactly one query per site and returns per-site rows in input order', async function () {
    var seen = [];
    var out = await runPerSite([10, 20, 30],
      function (sid) { return 'sql-for-' + sid; },
      async function (sql) { seen.push(sql); return [{ n: sql }]; });
    expect(seen).to.deep.equal(['sql-for-10', 'sql-for-20', 'sql-for-30']);
    expect(out.map(function (r) { return r[0].n; })).to.deep.equal(['sql-for-10', 'sql-for-20', 'sql-for-30']);
  });

  it('never exceeds the concurrency cap', async function () {
    var live = 0, maxLive = 0;
    var ids = [];
    for (var i = 0; i < 40; i++) { ids.push(i + 1); }
    await runPerSite(ids,
      function (sid) { return sid; },
      async function () {
        live++; if (live > maxLive) { maxLive = live; }
        await new Promise(function (r) { setTimeout(r, 5); });
        live--;
        return [];
      });
    expect(maxLive).to.be.at.most(persiteCount.PERSITE_COUNT_CAP);
    expect(maxLive).to.be.above(1); // it really parallelises
  });

  it('keeps alignment when a site returns zero rows', async function () {
    var out = await runPerSite([1, 2, 3],
      function (sid) { return sid; },
      async function (sid) { return sid === 2 ? [] : [{ n: sid }]; });
    expect(out.length).to.equal(3);
    expect(out[0][0].n).to.equal(1);
    expect(out[1]).to.deep.equal([]);
    expect(out[2][0].n).to.equal(3);
  });

  it('propagates a per-site failure (callers rely on dbpool fail-open per statement; a hard error must not be swallowed)', async function () {
    var threw = false;
    try {
      await runPerSite([1, 2],
        function (sid) { return sid; },
        async function (sid) { if (sid === 2) { throw new Error('boom'); } return [{ n: 1 }]; });
    } catch (e) { threw = e.message === 'boom'; }
    expect(threw).to.equal(true);
  });

  it('coerces/drops non-integer site ids', async function () {
    var seen = [];
    await runPerSite(['6725', 'x; DROP TABLE recordings', 6726],
      function (sid) { return sid; },
      async function (sid) { seen.push(sid); return []; });
    expect(seen).to.deep.equal([6725, 6726]);
  });
});
