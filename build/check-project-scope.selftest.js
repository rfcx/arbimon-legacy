#!/usr/bin/env node
/*
 * build/check-project-scope.selftest.js — proves BOTH halves of the §391 fix can
 * fail, on a bare `node` (no npm install; runs in the PR gate).
 *
 *  A. app/utils/project-scope.js against a fake DB holding the four cases the
 *     prompt names: OWN, IMPORTED, FOREIGN, MISSING (+ malformed ids and
 *     selector shapes). A fake that records every SQL/params pair lets us
 *     assert the guard never answers "owned" without a row, and never queries
 *     for a malformed id.
 *  B. build/check-project-scope.js against synthetic route trees:
 *     a KNOWN-GOOD tree must pass (control), and each KNOWN-BAD shape must
 *     fail with exit 1 naming the file — an unguarded router.param (the
 *     §391/sites.js shape), an unguarded :id route, a lying declaration,
 *     a non-literal path, and a tree too small to be real (exit 2).
 *
 * Exit 0 only if every case behaves. Any surprise = exit 1.
 */
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
let failures = 0
let passes = 0
function ok (cond, name, detail) {
  if (cond) { passes++; console.log('  ✓ ' + name) } else { failures++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')) }
}

// ---------------------------------------------------------------- A. guard
async function partA () {
  console.log('A. app/utils/project-scope.js')
  const { makeProjectScope } = require(path.join(ROOT, 'app/utils/project-scope.js'))
  // Fixture: project 10 owns site 100 (rec 1000) and has imported site 200
  // (rec 2000, owned by project 20). Project 30 owns site 300 (rec 3000).
  // Site 400 (rec 4000) is a REMOVED site of project 10 — still owned.
  const sites = { 100: 10, 200: 20, 300: 30, 400: 10 }
  const recs = { 1000: 100, 2000: 200, 3000: 300, 4000: 400 }
  const imported = [[200, 10]]
  const calls = []
  function fakeQuery (sql, params) {
    calls.push({ sql, params })
    const [id, pid, pid2] = params
    if (pid !== pid2) throw new Error('project param mismatch')
    let site
    if (/FROM recordings r/.test(sql)) site = recs[id]
    else if (/FROM sites s/.test(sql)) site = sites[id] !== undefined ? id : undefined
    else throw new Error('unexpected sql')
    if (site === undefined) return Promise.resolve([])
    const own = sites[site] === pid || imported.some(([s, p]) => s === site && p === pid)
    return Promise.resolve(own ? [{ owned: 1 }] : [])
  }
  const g = makeProjectScope(fakeQuery)
  ok(await g.ownedByProject('recording', 1000, 10) === true, 'own recording → true')
  ok(await g.ownedByProject('recording', '1000', '10') === true, 'own recording (string ids) → true')
  ok(await g.ownedByProject('recording', 2000, 10) === true, 'IMPORTED-site recording → true')
  ok(await g.ownedByProject('recording', 4000, 10) === true, 'recording on a REMOVED own site → true (playlists/PM reference these)')
  ok(await g.ownedByProject('recording', 3000, 10) === false, 'FOREIGN recording → false')
  ok(await g.ownedByProject('recording', 9999, 10) === false, 'MISSING recording → false')
  ok(await g.ownedByProject('recording', 2000, 20) === true, 'imported site is still its owner\'s')
  ok(await g.ownedByProject('site', 100, 10) === true, 'own site → true')
  ok(await g.ownedByProject('site', 200, 10) === true, 'imported site → true')
  ok(await g.ownedByProject('site', 300, 10) === false, 'FOREIGN site → false')
  ok(await g.ownedByProject('site', 9999, 10) === false, 'MISSING site → false')
  const before = calls.length
  for (const bad of ['1 OR 1=1', '-1', '0', '', null, undefined, '1e3', '12abc', {}, [], 1.5, NaN]) {
    ok(await g.ownedByProject('recording', bad, 10) === false, `malformed id ${JSON.stringify(bad)} → false`)
  }
  ok(await g.ownedByProject('recording', 1000, 'x') === false, 'malformed project id → false')
  ok(calls.length === before, 'malformed ids never reach the DB', `${calls.length - before} queries`)
  let threw = false
  try { await g.ownedByProject('widget', 1, 10) } catch (e) { threw = true }
  ok(threw, 'unknown kind rejects (fails closed)')
  // selector verdicts (shapes produced by recordings.parseUrlQuery)
  ok(await g.selectorOwned({}, 10) === true, 'project-wide selector → allowed (model applies its own union)')
  ok(await g.selectorOwned({ id: { '=': 1000 } }, 10) === true, 'id= own → true')
  ok(await g.selectorOwned({ id: { '=': 3000 } }, 10) === false, 'id= foreign → false')
  ok(await g.selectorOwned({ id: { IN: ['1000', '2000'] } }, 10) === true, 'id IN all-own → true')
  ok(await g.selectorOwned({ id: { IN: ['1000', '3000'] } }, 10) === false, 'id IN with ONE foreign → false')
  ok(await g.selectorOwned({ site: { '=': 100 }, year: { '=': '2020' } }, 10) === true, 'site= own (+year) → true')
  ok(await g.selectorOwned({ site: { '=': 300 } }, 10) === false, 'site= foreign → false')
  ok(await g.selectorOwned({ site: { no_match: true } }, 10) === false, 'site no_match → false (already empty in the model)')
  ok(await g.selectorOwned({ site: { IN: [100] } }, 10) === false, 'site IN → false (unsupported shape fails closed)')
  ok(await g.selectorOwned({ id: { BETWEEN: [1, 2] } }, 10) === false, 'id BETWEEN → false (fails closed)')
  ok(await g.selectorOwned(null, 10) === false, 'null selector → false')
  // recordingUrlOwned routes through the caller-supplied parser
  const parser = { parseUrlQuery: u => Promise.resolve(u === '1000' ? { id: { '=': 1000 } } : u === '3000.flac' ? { id: { '=': 3000 } } : {}) }
  ok(await g.recordingUrlOwned(parser, '1000', 10) === true, 'recordingUrlOwned own → true')
  ok(await g.recordingUrlOwned(parser, '3000.flac', 10) === false, 'recordingUrlOwned foreign → false')
  // §394: model kinds. Project 10 owns original 500 and shared COPY 501 (a row
  // in 10 whose uri names project 20); project 20 owns 600, IMPORTED into 10
  // via project_imported_models; project 30 owns 700. Same fake-DB contract:
  // a row proves ownership, nothing else does.
  const models = { 500: 10, 501: 10, 600: 20, 700: 30 }
  const pim = [[600, 10]]
  const mcalls = []
  function fakeModelQuery (sql, params) {
    mcalls.push({ sql, params })
    const [id, pid, pid2] = params
    if (pid !== pid2) throw new Error('project param mismatch')
    if (!/FROM models m/.test(sql)) throw new Error('unexpected sql')
    if (models[id] === undefined) return Promise.resolve([])
    const row = models[id] === pid
    const imp = /project_imported_models/.test(sql) && pim.some(([m, p]) => m === id && p === pid)
    return Promise.resolve(row || imp ? [{ owned: 1 }] : [])
  }
  const gm = makeProjectScope(fakeModelQuery)
  ok(await gm.ownedByProject('model', 500, 10) === true, 'model: own original → true')
  ok(await gm.ownedByProject('model', 501, 10) === true, 'model: shared COPY in the project → true')
  ok(await gm.ownedByProject('model', 600, 10) === true, 'model: IMPORTED (project_imported_models) → true')
  ok(await gm.ownedByProject('model', 700, 10) === false, 'model: FOREIGN → false')
  ok(await gm.ownedByProject('model', 9999, 10) === false, 'model: MISSING → false')
  ok(await gm.ownedByProject('model_own', 500, 10) === true, 'model_own: own original → true')
  ok(await gm.ownedByProject('model_own', 501, 10) === true, 'model_own: shared copy row is the project\'s → true')
  ok(await gm.ownedByProject('model_own', 600, 10) === false, 'model_own: IMPORTED is NOT writable from the importer → false')
  ok(await gm.ownedByProject('model_own', 700, 10) === false, 'model_own: FOREIGN → false')
  const mb = mcalls.length
  ok(await gm.ownedByProject('model', '1 OR 1=1', 10) === false && mcalls.length === mb, 'model: malformed id never reaches the DB')
  ok(!/project_imported_models/.test(g._sql.model_own), 'model_own SQL has no import branch (writes need the row)')
  // The fake DB above cannot SEE the SQL, so pin the exact shapes here: dropping a predicate must go red.
  ok(g._sql.model === 'SELECT 1 AS owned FROM models m WHERE m.model_id = ? AND (m.project_id = ? OR EXISTS (' +
    'SELECT 1 FROM project_imported_models pim WHERE pim.model_id = m.model_id AND pim.project_id = ?)) LIMIT 1',
    'model SQL is EXACTLY: id AND (own row OR imported into the project)')
  ok(g._sql.model_own === 'SELECT 1 AS owned FROM models m WHERE m.model_id = ? AND m.project_id = ? AND m.project_id = ? LIMIT 1',
    'model_own SQL is EXACTLY: id AND own row')
  for (const k of ['playlist', 'training_set', 'job', 'pattern_matching']) {
    ok(/project_id = \? AND \w+\.project_id = \? LIMIT 1$/.test(g._sql[k]), `${k} SQL binds the row's project_id`)
  }
  // §393: pattern_matching. Project 10 owns PM 50 (live) and 51 (DELETED — ownership, not listing);
  // project 20 owns 60. A row in the project proves ownership; nothing else does.
  const pms = { 50: 10, 51: 10, 60: 20 }
  const pcalls = []
  const gp = makeProjectScope(function (sql, params) {
    pcalls.push(sql)
    const [id, pid, pid2] = params
    if (pid !== pid2) throw new Error('project param mismatch')
    if (!/FROM pattern_matchings pm/.test(sql)) throw new Error('unexpected sql')
    return Promise.resolve(pms[id] === pid ? [{ owned: 1 }] : [])
  })
  ok(await gp.ownedByProject('pattern_matching', 50, 10) === true, 'pattern_matching: own → true')
  ok(await gp.ownedByProject('pattern_matching', '51', '10') === true, 'pattern_matching: own DELETED → true (ownership, not listing)')
  ok(await gp.ownedByProject('pattern_matching', 60, 10) === false, 'pattern_matching: FOREIGN → false')
  ok(await gp.ownedByProject('pattern_matching', 9999, 10) === false, 'pattern_matching: MISSING → false')
  const pb = pcalls.length
  ok(await gp.ownedByProject('pattern_matching', '_', 10) === false && pcalls.length === pb, 'pattern_matching: non-numeric id never reaches the DB')
  ok(g._sql.pattern_matching === 'SELECT 1 AS owned FROM pattern_matchings pm WHERE pm.pattern_matching_id = ? AND pm.project_id = ? AND pm.project_id = ? LIMIT 1',
    'pattern_matching SQL is EXACTLY: id AND the row\'s project (no deleted filter)')
  // §393 slice B: clustering_job. Project 10 owns run 70 (live) and 71 (deleted flag — ownership, not listing);
  // project 20 owns 80.
  const cjs = { 70: 10, 71: 10, 80: 20 }
  const cc = []
  const gc = makeProjectScope(function (sql, params) {
    cc.push(sql)
    const [id, pid, pid2] = params
    if (pid !== pid2) throw new Error('project param mismatch')
    if (!/FROM job_params_audio_event_clustering c/.test(sql)) throw new Error('unexpected sql')
    return Promise.resolve(cjs[id] === pid ? [{ owned: 1 }] : [])
  })
  ok(await gc.ownedByProject('clustering_job', 70, 10) === true, 'clustering_job: own → true')
  ok(await gc.ownedByProject('clustering_job', '71', '10') === true, 'clustering_job: own deleted-flag → true')
  ok(await gc.ownedByProject('clustering_job', 80, 10) === false, 'clustering_job: FOREIGN → false')
  ok(await gc.ownedByProject('clustering_job', 9999, 10) === false, 'clustering_job: MISSING → false')
  ok(g._sql.clustering_job === 'SELECT 1 AS owned FROM job_params_audio_event_clustering c WHERE c.job_id = ? AND c.project_id = ? AND c.project_id = ? LIMIT 1',
    'clustering_job SQL is EXACTLY: id AND the row\'s project')
  // §393 slice C: template. Project 20 is public_templates_enabled; project 10 is the viewer.
  // t300 public original in 20 (source NULL, live) → readable under 10.
  // t301 a COPY living in 20 (source set) → own rows only.
  // t304 public original but DELETED → the public arm requires deleted=0.
  // t305 private-foreign (30, no flag) → false. Own rows count even deleted.
  const tpls = {
    300: { project_id: 20, source_project_id: null, deleted: 0 },
    301: { project_id: 20, source_project_id: 5, deleted: 0 },
    302: { project_id: 10, source_project_id: null, deleted: 0 },
    303: { project_id: 10, source_project_id: 7, deleted: 1 },
    304: { project_id: 20, source_project_id: null, deleted: 1 },
    305: { project_id: 30, source_project_id: null, deleted: 0 }
  }
  const tflags = { 20: 1 }
  const gt = makeProjectScope(function (sql, params) {
    const [id, pid] = params
    if (!/FROM templates t JOIN projects p/.test(sql)) throw new Error('unexpected sql')
    const t = tpls[id]
    const owned = !!t && (t.project_id === pid || (tflags[t.project_id] === 1 && t.source_project_id === null && t.deleted === 0))
    return Promise.resolve(owned ? [{ owned: 1 }] : [])
  })
  ok(await gt.ownedByProject('template', 302, 10) === true, 'template: own original → true')
  ok(await gt.ownedByProject('template', 303, 10) === true, 'template: own DELETED copy → true (ownership, not listing)')
  ok(await gt.ownedByProject('template', 300, 10) === true, 'template: PUBLIC ORIGINAL under a viewer slug → true')
  ok(await gt.ownedByProject('template', 301, 10) === false, 'template: foreign COPY (source set) is NOT a public original → false')
  ok(await gt.ownedByProject('template', 304, 10) === false, 'template: DELETED public original → false (public arm needs deleted=0)')
  ok(await gt.ownedByProject('template', 304, 20) === true, 'template: the owner still resolves its deleted original')
  ok(await gt.ownedByProject('template', 305, 10) === false, 'template: PRIVATE-foreign → false')
  ok(await gt.ownedByProject('template', 9999, 10) === false, 'template: MISSING → false')
  ok(g._sql.template === 'SELECT 1 AS owned FROM templates t JOIN projects p ON p.project_id = t.project_id WHERE t.template_id = ? AND (t.project_id = ? OR (p.public_templates_enabled = 1 AND t.source_project_id IS NULL AND t.deleted = 0)) LIMIT 1',
    'template SQL is EXACTLY the ruled rule (own row OR live public original)')
  // SQL shape: both predicates present, both params bound
  const sql = g._sql.recording
  ok(/s\.project_id = \?/.test(sql) && /pis\.project_id = \?/.test(sql) && /r\.recording_id = \?/.test(sql), 'recording SQL binds id + own-site + imported-site predicates')
  ok(!/deleted_at/.test(sql) && !/deleted_at/.test(g._sql.site), 'ownership SQL does NOT filter removed sites (ownership ≠ listing)')
}

// ---------------------------------------------------------------- B. gate
function tree (files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-'))
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, 'app/routes/data-api/project', rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, body)
  }
  return dir
}
function gate (dir) {
  return spawnSync(process.execPath, [path.join(__dirname, 'check-project-scope.js'), '--root', dir], { encoding: 'utf8' })
}
const GOOD = {
  'widgets.js': [
    "const projectScope = require('../../../utils/project-scope');",
    "router.param('widget', function(req, res, next, id){",
    "  projectScope.ownedByProject('site', id, req.project.project_id).then(o => o ? next() : res.status(404).json({})).catch(next);",
    '});',
    "router.get('/:widget/info', function(req, res){ res.json(req.widget) });",
    '// project-scope: model findThing',
    "router.get('/thing/:thingId', function(req, res, next){ model.things.findThing(req.params.thingId, req.project.project_id) });",
    '// project-scope: allow offset_limit paging, not an entity id',
    "router.param('paging', function(req, res, next, p){ next() });",
    "router.get('/', function(req, res){ res.json([]) });",
    "router.use(function(req, res, next){ next() });"
  ].join('\n')
}
function partB () {
  console.log('B. build/check-project-scope.js (red-test)')
  let r = gate(tree(GOOD))
  ok(r.status === 0, 'CONTROL: a correctly-bound tree passes', r.stderr.trim())
  const cases = [
    ['unguarded router.param (the sites.js shape)', { 'sites.js': "router.param('siteid', function(req, res, next, id){ model.sites.findById(id, next) });\nrouter.get('/:siteid/data.txt', function(){})" }, /param 'siteid' is NOT bound/],
    ['unguarded :id route', { 'r.js': "router.get('/info/:recId', function(req, res){ model.recordings.findById(req.params.recId) })" }, /:recId NOT bound/],
    ['declared model that ignores req.project', { 'r.js': "// project-scope: model findById\nrouter.get('/info/:recId', function(req, res){ model.recordings.findById(req.params.recId) })" }, /never passes req\.project/],
    ['declared guard with no guard call', { 'r.js': "// project-scope: guard\nrouter.get('/info/:recId', function(req, res){ model.x.y(req.params.recId) })" }, /declared guard/],
    ['allow with no reason', { 'r.js': "// project-scope: allow ok\nrouter.param('x', function(req, res, next){ next() })" }, /allow needs a reason/],
    ['debt without an OPEN-ITEMS ref', { 'r.js': "// project-scope: debt later\nrouter.get('/:x', function(){})" }, /debt needs an OPEN-ITEMS ref/],
    ['unknown kind', { 'r.js': "// project-scope: trustme because\nrouter.get('/:x', function(){})" }, /unknown project-scope kind/],
    ['non-literal path (fails closed)', { 'r.js': "router.get('/', function(){})\nrouter.get(PATH, function(){})" }, /cannot parse route declaration/],
    ['.route( chain (fails closed)', { 'r.js': "router.get('/', function(){})\nrouter.route('/:x').get(function(){})" }, /\.route\(/],
    ['params naming a param the path lacks', { 'r.js': "// project-scope: params nope because reasons here\nrouter.get('/:x', function(){})" }, /does not have/]
  ]
  for (const [name, files, re] of cases) {
    r = gate(tree(files))
    ok(r.status === 1 && re.test(r.stderr), 'RED: ' + name, `status=${r.status} ${r.stderr.trim().slice(0, 160)}`)
  }
  r = gate(tree({}))
  ok(r.status === 2, 'RED: empty tree cannot pass vacuously (exit 2)', `status=${r.status}`)
  // debt ceiling
  const many = Array.from({ length: 21 }, (_, i) => `// project-scope: debt §393 x\nrouter.get('/d${i}/:x', function(){})`).join('\n')
  r = gate(tree({ 'd.js': many }))
  ok(r.status === 1 && /DEBT_MAX/.test(r.stderr), 'RED: debt above DEBT_MAX fails')
  // and the REAL tree
  r = spawnSync(process.execPath, [path.join(__dirname, 'check-project-scope.js')], { encoding: 'utf8' })
  ok(r.status === 0, 'the real app/routes tree passes', r.stderr.trim().slice(0, 300))
}

(async function () {
  try { await partA() } catch (e) { failures++; console.log('  ✗ part A crashed: ' + (e && e.stack)) }
  try { partB() } catch (e) { failures++; console.log('  ✗ part B crashed: ' + (e && e.stack)) }
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : (passes >= 40 ? 0 : 1))
})()