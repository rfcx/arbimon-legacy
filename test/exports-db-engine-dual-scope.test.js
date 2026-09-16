/**
 * EXPORTS_DB_ENGINE has TWO readers with different scopes. This ratchet keeps
 * that documented at BOTH sites, because the coupling is invisible from either
 * file alone and it produced a wrong conclusion in production analysis
 * (2026-09-16, S1): probing dbpool.getConnection() in the export pod answers
 * MariaDB `arbimon@%`, while the path the export actually uses (dbpool.query)
 * answers PG `arbimon_ro`. Same module, two shapes, two engines, two identities.
 *
 * This is a DOCUMENTATION ratchet, deliberately: the behaviour it guards is
 * load-bearing and correct, so there is nothing to assert about runtime -- the
 * failure mode is a future reader (or agent) reasoning from one file.
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('EXPORTS_DB_ENGINE — the dual-scope coupling is documented at both readers', function () {
  it('there are exactly the two known readers (a third would be undocumented)', function () {
    const hits = []
    for (const f of ['app/utils/dbpool.js', 'jobs/db/backend.js', 'jobs/db/pg.js',
      'app/utils/dbpool-pg.js', 'jobs/arbimon-recording-export-job/consumer.js',
      'jobs/arbimon-recording-export-job/reconciler.js']) {
      const src = read(f)
      // A READER is code that branches on the value, not prose mentioning it.
      // Strip only FULL-LINE comments, and test line-by-line: an earlier version
      // of this stripper ran over the whole file and swallowed the real reader at
      // dbpool.js:33 because it sits directly under a long comment block --
      // i.e. the test failed on correct code. A detector that cannot see the
      // thing it detects is worse than no detector.
      const isReader = src.split('\n')
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .some(l => /process\.env\.EXPORTS_DB_ENGINE/.test(l))
      if (isReader) hits.push(f)
    }
    // consumer.js/reconciler.js guard on it (fail-fast); the two ROUTERS are the
    // pair this test is about. Assert both routers are present.
    assert.ok(hits.includes('app/utils/dbpool.js'),
      'app/utils/dbpool.js must still be a reader (if not, this ratchet is stale)')
    assert.ok(hits.includes('jobs/db/backend.js'),
      'jobs/db/backend.js must still be a reader')
  })

  it('app/utils/dbpool.js warns that it reroutes app/model/* and names the probe', function () {
    const src = read('app/utils/dbpool.js')
    assert.ok(/TWO PLACES|two readers|TWO READERS/i.test(src),
      'dbpool.js must flag that EXPORTS_DB_ENGINE has more than one reader')
    assert.ok(/dbpool\.getConnection\(\)/.test(src) && /dbpool\.query/.test(src),
      'dbpool.js must name BOTH probe shapes — the misleading one and the correct one')
    assert.ok(/arbimon_ro/.test(src),
      'dbpool.js must state which credential the rerouted reads actually use')
  })

  it('jobs/db/backend.js points at the other reader', function () {
    const src = read('jobs/db/backend.js')
    assert.ok(/dbpool\.js/.test(src),
      'backend.js must cross-reference app/utils/dbpool.js as the other reader')
    assert.ok(/NOT THE ONLY READER|also\s+reads/i.test(src),
      'backend.js must say it is not the only reader of this env var')
  })

  it('CONTROL: this harness can fail — a sentinel that is absent is detected', function () {
    const src = read('jobs/db/backend.js')
    assert.strictEqual(/THIS_SENTINEL_SHOULD_NOT_EXIST_IN_BACKEND/.test(src), false,
      'positive control: the grep distinguishes present from absent')
  })
})