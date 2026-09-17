var expect = require('chai').expect;

// Pure-function guard for the per-site top-N UNION sort builder. Deliberately
// requires the standalone util rather than app/model/recordings.js -- the model
// pulls in the whole DB connection stack, which cannot be loaded in a plain
// unit test.
var persite = require('../app/utils/persite-sort');
var build = persite.buildPerSiteSortSql;

var BASE = {
  expr: 'r.filename',
  nullable: true,
  sortRev: false,
  siteIds: [6725, 6726, 6727],
  archiveScope: 'r.archived_at IS NULL',
  offset: 0,
  limit: 10,
  isPg: false
};

/**
 * REGRESSION GUARD (P7 pre-flip read-timeout sweep, 2026-09-12).
 *
 * A global ORDER BY over a multi-site project cannot be index-served (every
 * sortable column's composite index leads with site_id), so both engines
 * materialise + sort the project's whole recording set for page 1 — measured
 * 100.9 s on MariaDB and a deterministic 8 s statement_timeout cancel on PG
 * for the 950-site giant (pg_route_timeout f44b4c1fdbb60431 / 16670983c3ff6008).
 * The union emits index-walked top-(offset+limit) arms per site and merges.
 *
 * The TWO-ARM split (value band / NULL band) exists because PG's btree cannot
 * serve the MySQL NULL placement (NULLS FIRST on ASC) from the index — it
 * plans a per-site full scan + sort instead (measured on the live leader:
 * the single-arm NULLS FIRST union cancelled at 15 s where the index-served
 * shape runs 1.38 s). Inside an arm the placement is irrelevant, so arms use
 * PG-NATIVE placement (also a translate() passthrough marker); the OUTER key
 * carries the app-semantic placement.
 *
 * These tests pin: the gate, per-arm k = offset+limit (top-N-of-union
 * correctness), the NULL-band split, the placements, and the dual-dialect
 * LIMIT forms.
 */
describe('recordings per-site union sort builder', function () {

  it('emits TWO arms per nullable-sort site (value band + NULL band), each with per-arm LIMIT = offset+limit', function () {
    var sql = build(Object.assign({}, BASE, { offset: 10, limit: 10 }));
    var arms = sql.match(/\(SELECT r\.recording_id AS id/g);
    expect(arms).to.have.length(6);
    expect((sql.match(/r\.filename IS NOT NULL/g) || []).length).to.equal(3);
    expect((sql.match(/r\.filename IS NULL/g) || []).length).to.equal(3);
    expect((sql.match(/LIMIT 20\)/g) || []).length).to.equal(6); // k = 10 + 10
    expect(sql).to.contain('LIMIT 10, 10'); // MariaDB outer form
  });

  it('applies the archive scope inside every arm', function () {
    var sql = build(BASE);
    expect((sql.match(/AND r\.archived_at IS NULL/g) || []).length).to.equal(6);
  });

  it('omits the archive predicate when scope is empty (archived=all)', function () {
    var sql = build(Object.assign({}, BASE, { archiveScope: '' }));
    expect(sql).to.not.contain('archived_at');
  });

  it('MySQL form carries NO NULLS keywords (MariaDB syntax); its defaults match the app semantics', function () {
    var sql = build(BASE);
    expect(sql).to.not.contain('NULLS');
    expect(sql).to.contain('ORDER BY r.filename ASC, r.recording_id ASC');
    expect(sql).to.contain('ORDER BY u.sort_key ASC, u.id ASC');
  });

  it('PG form: arms PG-native placement (index-servable), outer MySQL-semantic placement', function () {
    var sql = build(Object.assign({}, BASE, { isPg: true }));
    expect(sql).to.contain('ORDER BY r.filename ASC NULLS LAST, r.recording_id ASC');
    expect(sql).to.contain('ORDER BY u.sort_key ASC NULLS FIRST, u.id ASC');
    expect(sql).to.contain('LIMIT 10 OFFSET 0');
  });

  it('PG DESC form: arms NULLS FIRST (native for DESC), outer NULLS LAST', function () {
    var sql = build(Object.assign({}, BASE, { isPg: true, sortRev: true, offset: 10 }));
    expect(sql).to.contain('ORDER BY r.filename DESC NULLS FIRST, r.recording_id DESC LIMIT 20)');
    expect(sql).to.contain('ORDER BY u.sort_key DESC NULLS LAST, u.id DESC');
  });

  it('non-nullable sort columns: single arm per site, no IS NULL split, no placement', function () {
    var sql = build(Object.assign({}, BASE, { expr: 'r.site_id', nullable: false, isPg: true }));
    expect((sql.match(/\(SELECT r\.recording_id AS id/g) || []).length).to.equal(3);
    expect(sql).to.not.contain('NULLS');
    expect(sql).to.not.contain('IS NOT NULL');
  });

  it('returns null for a single-site project (already index-served)', function () {
    expect(build(Object.assign({}, BASE, { siteIds: [6725] }))).to.equal(null);
  });

  it('MariaDB: returns null above MAX_SITES (no LATERAL there; the SQL-text bound still applies)', function () {
    var ids = [];
    for (var i = 1; i <= persite.PERSITE_SORT_MAX_SITES + 1; i++) { ids.push(i); }
    expect(build(Object.assign({}, BASE, { siteIds: ids }))).to.equal(null);
    var ok = [];
    for (var j = 1; j <= persite.PERSITE_SORT_MAX_SITES; j++) { ok.push(j); }
    expect(build(Object.assign({}, BASE, { siteIds: ok }))).to.be.a('string');
  });

  /**
   * THE >MAX_SITES LATERAL BRANCH (PG only, added 2026-09-17; operator GO
   * 04:33; evidence rfcx-local runbooks/evidence/keyset-p1-g1-refutation-2026-09-17.md).
   * Until this change the >MAX_SITES class (exactly ONE project: 3165, 2,473
   * sites) was gated OFF the fast path and timed out on ANY non-default sort.
   * The union cannot serve it (~465 KB of SQL at 2,473 sites vs the ~700 KB
   * text bound); LATERAL's text is ~30 KB. LATERAL is deliberately NOT the
   * default for smaller projects: it has no Merge Append early stop, and on
   * the dense 970-site giant at k=20,000 it cancels at the 8 s prod bound
   * where the union returns in ~195 ms (measured on the live leader, twice).
   * These tests pin the branch gate and the emitted SHAPE.
   */
  var BIG = { isPg: true, offset: 19900, limit: 100 }; // k = 20,000: deepest served page
  var bigIds = function () {
    var ids = [];
    for (var i = 10; i <= persite.PERSITE_SORT_MAX_SITES + 10; i++) { ids.push(i); }
    return ids;
  };

  it('PG above MAX_SITES emits the LATERAL form: one array literal, one CROSS JOIN LATERAL per band, per-LATERAL LIMIT = offset+limit', function () {
    var sql = build(Object.assign({}, BASE, BIG, { siteIds: bigIds() }));
    expect(sql).to.be.a('string');
    expect(sql).to.contain('FROM unnest(ARRAY[10,11,12');
    expect(sql).to.contain(']::bigint[]) AS t(site_id)');
    expect((sql.match(/CROSS JOIN LATERAL/g) || []).length).to.equal(2); // value band + NULL band
    expect((sql.match(/r\.filename IS NOT NULL/g) || []).length).to.equal(1);
    expect((sql.match(/r\.filename IS NULL/g) || []).length).to.equal(1);
    expect((sql.match(/LIMIT 20000\n\) x/g) || []).length).to.equal(2); // k = 19900 + 100, per LATERAL
    expect(sql).to.contain('WHERE r.site_id = t.site_id AND r.archived_at IS NULL');
    expect(sql).to.contain('LIMIT 100 OFFSET 19900'); // PG outer form
  });

  it('PG LATERAL branch: arms PG-native placement (index-servable), outer MySQL-semantic placement — the NULL-split is preserved', function () {
    var asc = build(Object.assign({}, BASE, BIG, { siteIds: bigIds() }));
    expect(asc).to.contain('ORDER BY r.filename ASC NULLS LAST, r.recording_id ASC');
    expect(asc).to.contain('ORDER BY u.sort_key ASC NULLS FIRST, u.id ASC');
    var desc = build(Object.assign({}, BASE, BIG, { siteIds: bigIds(), sortRev: true }));
    expect(desc).to.contain('ORDER BY r.filename DESC NULLS FIRST, r.recording_id DESC');
    expect(desc).to.contain('ORDER BY u.sort_key DESC NULLS LAST, u.id DESC');
  });

  it('PG LATERAL branch, non-nullable sort column: ONE LATERAL, no IS NULL split, no placement keywords', function () {
    var sql = build(Object.assign({}, BASE, BIG, { siteIds: bigIds(), expr: 'r.datetime', nullable: false }));
    expect((sql.match(/CROSS JOIN LATERAL/g) || []).length).to.equal(1);
    expect(sql).to.not.contain('NULLS');
    expect(sql).to.not.contain('IS NOT NULL');
    expect(sql).to.contain('ORDER BY r.datetime ASC, r.recording_id ASC');
  });

  it('PG LATERAL branch still obeys MAX_WINDOW and the positive-limit gate', function () {
    expect(build(Object.assign({}, BASE, { isPg: true, siteIds: bigIds(), offset: 20000, limit: 100 }))).to.equal(null);
    expect(build(Object.assign({}, BASE, { isPg: true, siteIds: bigIds(), limit: 0 }))).to.equal(null);
    expect(build(Object.assign({}, BASE, { isPg: true, siteIds: [6725] }))).to.equal(null); // 1-site: still the old path
  });

  it('PG LATERAL branch coerces/drops non-integer site ids (the array literal is not parameterized)', function () {
    var ids = bigIds().concat(['x; DROP TABLE recordings', '31337']);
    var sql = build(Object.assign({}, BASE, BIG, { siteIds: ids }));
    expect(sql).to.be.a('string');
    expect(sql).to.not.contain('DROP');
    expect(sql).to.contain(',31337]'); // the one valid trailing id survives, at the end of the array
  });

  it('returns null for deep pages (§270 owns the residual deep-page cost)', function () {
    expect(build(Object.assign({}, BASE, { offset: persite.PERSITE_SORT_MAX_WINDOW }))).to.equal(null);
    expect(build(Object.assign({}, BASE, { offset: persite.PERSITE_SORT_MAX_WINDOW - 10 }))).to.be.a('string');
  });

  /**
   * The bound moved 500 -> 20000 on 2026-09-16 after measuring that the union
   * plans as a Merge Append (streams the already-sorted arms and stops at k),
   * so cost is dominated by opening ~970 index scans, not by k.
   *
   * Pinned as a VALUE, not just symbolically: the whole point of the change is
   * WHICH pages get the fast path, so a silent revert to 500 -- or an
   * over-eager raise -- must fail here rather than only show up as a
   * production timeout on the one project big enough to notice.
   */
  it('serves the pages the 2026-09-16 raise was made for', function () {
    expect(persite.PERSITE_SORT_MAX_WINDOW).to.equal(20000);

    // limit=100: page 200 is inside, page 201 is not.
    expect(build(Object.assign({}, BASE, { limit: 100, offset: 19900 }))).to.be.a('string');
    expect(build(Object.assign({}, BASE, { limit: 100, offset: 20000 }))).to.equal(null);

    // The old bound's cliff edge (page 6 at limit=100) is now firmly inside.
    expect(build(Object.assign({}, BASE, { limit: 100, offset: 500 }))).to.be.a('string');
  });

  it('returns null without a positive finite limit (the dump-everything path keeps the old shape)', function () {
    expect(build(Object.assign({}, BASE, { limit: undefined }))).to.equal(null);
    expect(build(Object.assign({}, BASE, { limit: 0 }))).to.equal(null);
  });

  it('coerces/drops non-integer site ids (the IN-list it replaces was parameterized)', function () {
    var sql = build(Object.assign({}, BASE, { siteIds: ['6725', 'x; DROP TABLE recordings', 6726] }));
    expect(sql).to.not.contain('DROP');
    expect((sql.match(/\(SELECT r\.recording_id AS id/g) || []).length).to.equal(4); // 2 sites x 2 bands
  });
});
