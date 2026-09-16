/**
 * S1 acceptance — export executor -> arbimon_ro, and the retired PROCESSLIST throttle.
 *
 * NEGATIVE CONTROLS ARE THE POINT (the #1866 lesson): each assertion below is
 * written so that it FAILS on the pre-fix tree. Verified by re-running this file
 * against origin/master (pre-fix) — see the PR body for the recorded output.
 *
 * S1b's acceptance is necessarily a NEGATIVE (you cannot test a deleted guard),
 * so we assert the call site, the export, and the import are all gone, and that
 * the surviving module still loads and still exposes what the export path uses.
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('S1b — PROCESSLIST overload throttle is RETIRED', function () {
  const svc = 'jobs/services/recordings.js'
  const idx = 'jobs/arbimon-recording-export-job/index.js'

  it('the MySQL-only catalog reference is gone from EXECUTABLE code', function () {
    // Comments may (and do) name the retired catalog to explain the removal;
    // what must be gone is any statement that could REACH it. Strip comments
    // first, then assert — the same distinction the export-list check makes.
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // pre-fix: recordings.js:64 has it in live code -> FAILS
    assert.strictEqual(/information_schema\.PROCESSLIST/i.test(strip(read(svc))), false,
      'no executable statement may reference information_schema.PROCESSLIST')
  })

  it('getCountConnections is not defined, not exported, not imported', function () {
    const svcSrc = read(svc)
    const idxSrc = read(idx)
    // Strip comments so the explanatory block naming the removal does not
    // masquerade as a live reference (and vice versa: a real reference hiding
    // in a comment must not let this pass).
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    assert.strictEqual(/async function getCountConnections/.test(strip(svcSrc)), false,
      'the function definition must be removed')       // pre-fix: FAILS
    assert.strictEqual(/getCountConnections/.test(strip(idxSrc)), false,
      'no import or call site may remain in index.js') // pre-fix: FAILS

    // The export list is the one a careless deletion gets wrong: an
    // exported-but-undefined name is a runtime TypeError at require time.
    const exportBlock = strip(svcSrc).split('module.exports')[1] || ''
    assert.strictEqual(/getCountConnections/.test(exportBlock), false,
      'getCountConnections must be removed from module.exports') // pre-fix: FAILS
  })

  it('every name the export path uses is still exported, and only that set', function () {
    // Non-vacuity: proves the deletion did not break the surviving surface.
    // Parsed from source rather than require()d: loading this module pulls in
    // the mysql2 driver chain, which is not installed in a CI lint/unit lane —
    // and a test that can only run with a DB driver present is a test that gets
    // skipped. The export list is the thing under test, so read it directly.
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const exportBlock = strip(read(svc)).split('module.exports')[1] || ''
    assert.ok(exportBlock.length, 'positive control: module.exports block was found')

    for (const name of ['exportOccupancyModels', 'getExportRecordingsRow',
      'getCountSitesRecPerDates', 'updateExportRecordings', 'deleteRecordings']) {
      assert.ok(new RegExp(`\\b${name}\\b`).test(exportBlock), `${name} must still be exported`)
    }
    assert.strictEqual(/\bgetCountConnections\b/.test(exportBlock), false,
      'getCountConnections must be absent from module.exports') // pre-fix: FAILS
  })

  it('CONTROL: this harness can fail — a name that IS present is detected', function () {
    // If this ever passes trivially, the greps above prove nothing.
    assert.ok(/async function deleteRecordings/.test(read(svc)),
      'positive control: deleteRecordings is still defined in this file')
  })
})

describe('S1b — main() no longer short-circuits on a connection count', function () {
  it('the "high mysql db connections count" early-return is gone', function () {
    const src = read('jobs/arbimon-recording-export-job/index.js')
    // pre-fix: index.js:330 logs exactly this -> FAILS
    assert.strictEqual(/stopped due to high mysql db connections count/i.test(src), false,
      'the throttle log line and its early return must be removed')
  })
})

describe('S1 1b — the role-model comment is no longer false', function () {
  const src = () => read('jobs/db/pg.js')

  it('documents that arbimon_ro is effective, with a date', function () {
    assert.ok(/TRUE SINCE 2026-09-16/.test(src()),
      'the comment must state when the claim became true, not assert it timelessly')
  })

  it('names the deleteRecordings exception rather than claiming a blanket guarantee', function () {
    const s = src()
    // The pre-fix comment claimed the collection "can physically never mutate
    // PG" with no exception. That absolute is what made it false.
    assert.strictEqual(/can physically never mutate PG/.test(s), false,
      'the unqualified "never mutate" claim must be gone')          // pre-fix: FAILS
    assert.ok(/deleteRecordings/.test(s),
      'the one READ-pool write must be named in the role model')    // pre-fix: FAILS
  })
})
