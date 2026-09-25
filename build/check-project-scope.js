#!/usr/bin/env node
/*
 * build/check-project-scope.js
 *
 * PRE-MERGE GATE: every id in a /legacy-api/project/:projectUrl/... path must be
 * bound to the project in the URL.
 *
 * WHY THIS EXISTS (rfcx-local OPEN-ITEMS §391, 2026-09-25)
 * --------------------------------------------------------
 * index.js `router.param('projectUrl')` authorises the URL's project. Any OTHER
 * id in the path was historically resolved by id alone, so a logged-in user
 * could read or change another project's entity by quoting its id under a
 * project they can open. The class fired three times, each audit fixing the
 * routes it happened to read:
 *   §291 (09-09) classifications / pattern-matchings / templates
 *   §292 (09-09) jobs / tags / soundscape-composition
 *   §391 (09-25) recordings (info/audio/image/…, list/count by site, tiles)
 *                + sites.js `siteid` (found while designing THIS gate)
 * A fourth audit would find more. This gate makes the question mechanical.
 *
 * THE RULE
 * --------
 * For every file under app/routes/data-api/project/ (recursively), every
 * `<router>.param('<name>', …)` and every `<router>.<verb>('<path>', …)` whose
 * path contains a `:param` must be BOUND, one of:
 *
 *   1. AUTOMATIC — a param whose callback calls the guard (`projectScope.` or
 *      a same-file helper function that does), a SINGLE-param route whose
 *      handler does, or a route whose every `:param` is `projectUrl` or is
 *      handled by a router.param in the SAME FILE that is itself bound.
 *      (A multi-param route that calls the guard must still declare which
 *      of its params are not entity ids — `params` below.)
 *   2. DECLARED — a `// project-scope: <kind> <arg>` line in the comment block
 *      directly above the declaration. Each kind is CHECKED, not trusted:
 *        guard              body calls `projectScope.`
 *        model <fn>         body calls `<fn>(` AND mentions `req.project`
 *                           (a model call that takes the URL's project)
 *        parent <param>     resolved under an already-bound router.param
 *                           <param> in this file (e.g. regions under
 *                           :soundscape)
 *        allow <reason>     not an entity id (paging, bbox, a type name) or
 *                           authorisation delegated elsewhere; reason ≥ 12 chars
 *        params <a,b> <why> ROUTE-only: the named params are not entity ids
 *                           (or are resolved THROUGH another bound entity in
 *                           the same handler); every OTHER :param must still
 *                           be bound. why ≥ 12 chars
 *        debt §<N>          KNOWN-unbound, tracked in OPEN-ITEMS §<N>; the
 *                           total may not exceed DEBT_MAX below, so new debt
 *                           needs an edit to THIS file, visible in review
 *
 * FAILS CLOSED: a declaration whose path is not a string literal, a
 * `.route(` chain, a declared kind the body does not satisfy, an unknown kind,
 * or a scan that finds implausibly few declarations — all FAIL. Exit 0 =
 * clean; 1 = an unbound or mis-declared id route (named); 2 = the checker
 * could not run (a gate that cannot run must never report success).
 *
 * Usage: node build/check-project-scope.js [--root <repoRoot>] [--list]
 */
'use strict'

const fs = require('fs')
const path = require('path')

// Ceiling on `debt` declarations. Lowering it is always welcome; RAISING it is
// the one way to add an unbound id route and must be argued in the PR.
const DEBT_MAX = 7
// A scan that sees fewer declarations than this is not a scan of this tree.
const MIN_DECLS = 60

const args = process.argv.slice(2)
const rootIdx = args.indexOf('--root')
const ROOT = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : path.resolve(__dirname, '..')
const LIST = args.includes('--list')
const MIN = rootIdx >= 0 ? 1 : MIN_DECLS
const BASE = path.join(ROOT, 'app/routes/data-api/project')

function die (msg) { console.error(`check-project-scope: CANNOT RUN: ${msg}`); process.exit(2) }

if (!fs.existsSync(BASE)) die(`missing ${BASE}`)
if (rootIdx < 0) {
  const guard = path.join(ROOT, 'app/utils/project-scope.js')
  if (!fs.existsSync(guard) || !/ownedByProject/.test(fs.readFileSync(guard, 'utf8'))) {
    die('app/utils/project-scope.js (ownedByProject) not found')
  }
}

function walk (dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.js')) out.push(p)
  }
  return out.sort()
}

const VERBS = 'param|get|post|put|delete|patch|all|use|head|options'
// Any `<ident>.<verb>(` where <ident> looks like a router. Deliberately broad:
// it must SEE every declaration, including ones it cannot parse.
const DECL_ANY = new RegExp(`^\\s*(\\w*[Rr]outer\\w*|app)\\s*\\.\\s*(${VERBS})\\s*\\(`)
const DECL_LIT = new RegExp(`^\\s*(\\w*[Rr]outer\\w*|app)\\s*\\.\\s*(${VERBS})\\s*\\(\\s*(['"])([^'"\`]*)\\3\\s*[,)]`)

const problems = []
const listing = []
let declCount = 0
let debtCount = 0

function paramsOf (p) {
  return (p.match(/:(\w+)\??/g) || []).map(s => s.replace(/^:/, '').replace(/\?$/, ''))
}

function commentAbove (lines, i) {
  const block = []
  for (let k = i - 1; k >= 0; k--) {
    const t = lines[k].trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) { block.unshift(t); continue }
    break
  }
  return block
}

function declaredKind (block) {
  const hits = block.map(l => /project-scope:\s*(\S+)(?:\s+(.*?))?\s*(\*\/)?$/.exec(l.replace(/^\/\/\s*|^\*\s*/, ''))).filter(Boolean)
  if (hits.length > 1) return { error: 'more than one project-scope declaration' }
  if (!hits.length) return null
  return { kind: hits[0][1], arg: (hits[0][2] || '').trim() }
}

for (const file of walk(BASE)) {
  const rel = path.relative(ROOT, file)
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  if (/\.\s*route\s*\(/.test(text.replace(/\/\/.*$/gm, ''))) {
    problems.push(`${rel}: uses .route( — unsupported by this gate, declare routes individually`)
  }
  // Same-file helper functions that call the guard count as the guard.
  const helpers = []
  const fnRe = /^(?:async\s+)?function\s+(\w+)\s*\(/
  lines.forEach((l, i) => {
    const m = fnRe.exec(l)
    if (!m) return
    let j = i + 1
    while (j < lines.length && !/^(?:async\s+)?function\s|^\w*[Rr]outer\w*\s*\./.test(lines[j])) j++
    if (/projectScope\s*\./.test(lines.slice(i, j).join('\n'))) helpers.push(m[1])
  })
  const callsGuard = body => /projectScope\s*\./.test(body) ||
    helpers.some(h => new RegExp(`\\b${h}\\s*\\(`).test(body))

  // Pass 1: find declarations.
  const decls = []
  lines.forEach((l, i) => {
    if (!DECL_ANY.test(l)) return
    const m = DECL_LIT.exec(l)
    if (!m) {
      // A middleware `router.use(function…)` has no path: that is fine.
      if (/\.\s*use\s*\(\s*(function|async|\(|\w+\s*\))/.test(l) || /\.\s*use\s*\(\s*\w+\s*\)\s*;?\s*$/.test(l)) return
      problems.push(`${rel}:${i + 1}: cannot parse route declaration (non-literal path?) — fails closed`)
      return
    }
    decls.push({ line: i, router: m[1], verb: m[2], path: m[4] })
  })
  declCount += decls.length
  // Bodies run to the next declaration (or EOF).
  decls.forEach((d, k) => {
    const end = k + 1 < decls.length ? decls[k + 1].line : lines.length
    d.body = lines.slice(d.line, end).join('\n')
    d.block = commentAbove(lines, d.line)
  })

  function check (d) {
    const dk = declaredKind(d.block)
    if (dk && dk.error) return { ok: false, why: dk.error }
    if (!dk) return null
    const { kind, arg } = dk
    switch (kind) {
      case 'guard':
        return callsGuard(d.body) ? { ok: true, kind } : { ok: false, why: 'declared guard but body never calls projectScope. (or a local helper that does)' }
      case 'model': {
        if (!/^[\w.]+$/.test(arg)) return { ok: false, why: 'model needs a function name' }
        const fn = arg.split('.').pop()
        if (!new RegExp(`\\b${fn}\\s*\\(`).test(d.body)) return { ok: false, why: `declared model ${arg} but body never calls ${fn}(` }
        if (!/req\.project\b/.test(d.body)) return { ok: false, why: `declared model ${arg} but body never passes req.project` }
        return { ok: true, kind }
      }
      case 'parent':
        return { ok: 'parent', kind, arg }
      case 'allow':
        return arg.length >= 12 ? { ok: true, kind } : { ok: false, why: 'allow needs a reason (≥ 12 chars)' }
      case 'params': {
        const m = /^([\w,]+)\s+(.{12,})$/.exec(arg)
        if (!m) return { ok: false, why: 'params needs "<a,b> <reason ≥ 12 chars>"' }
        return { ok: 'params', kind, names: m[1].split(',') }
      }
      case 'debt':
        if (!/^§\d+\b/.test(arg)) return { ok: false, why: 'debt needs an OPEN-ITEMS ref like §391' }
        debtCount++
        return { ok: true, kind }
      default:
        return { ok: false, why: `unknown project-scope kind '${kind}'` }
    }
  }

  // Pass 2: params first (routes depend on them).
  const boundParams = {}
  const boundNames = new Set()
  const params = decls.filter(d => d.verb === 'param')
  for (const d of params) {
    const name = d.path
    let v = check(d)
    if (v === null && callsGuard(d.body)) v = { ok: true, kind: 'guard(auto)' }
    if (v && v.ok === 'parent') v = null // resolved below
    if (v && v.ok === 'params') { problems.push(`${rel}:${d.line + 1}: param '${name}': 'params' is a ROUTE-level declaration`); continue }
    if (v && v.ok === true) { boundParams[`${d.router}:${name}`] = v.kind; boundNames.add(name); listing.push(`${rel}:${d.line + 1} param ${name} -> ${v.kind}`); continue }
    if (v && v.ok === false) { problems.push(`${rel}:${d.line + 1}: param '${name}': ${v.why}`); continue }
    d.pending = true
  }
  // parent-declared params (after their parent is known)
  for (const d of params.filter(p => p.pending)) {
    const dk = declaredKind(d.block)
    if (dk && dk.kind === 'parent' && boundNames.has(dk.arg)) {
      boundParams[`${d.router}:${d.path}`] = `parent ${dk.arg}`
      boundNames.add(d.path)
      listing.push(`${rel}:${d.line + 1} param ${d.path} -> parent ${dk.arg}`)
    } else if (dk && dk.kind === 'parent') {
      problems.push(`${rel}:${d.line + 1}: param '${d.path}': declared parent '${dk.arg}' is not a bound router.param in this file`)
    } else {
      problems.push(`${rel}:${d.line + 1}: param '${d.path}' is NOT bound to the URL project (call projectScope.*, or declare // project-scope: …)`)
    }
  }

  // Pass 3: routes with :params.
  for (const d of decls.filter(x => x.verb !== 'param')) {
    const ps = paramsOf(d.path)
    if (!ps.length) continue
    const unbound = ps.filter(p => !(p === 'projectUrl' && path.basename(file) === 'index.js' && path.dirname(file) === BASE) && !boundParams[`${d.router}:${p}`])
    const where = `${rel}:${d.line + 1} ${d.verb} ${d.path}`
    let v = check(d)
    if (v && v.ok === 'parent') {
      v = boundNames.has(v.arg) ? { ok: true, kind: `parent ${v.arg}` } : { ok: false, why: `declared parent '${v.arg}' is not a bound router.param in this file` }
    }
    if (v && v.ok === false) { problems.push(`${where}: ${v.why}`); continue }
    if (v && v.ok === 'params') {
      const bad = v.names.filter(n => !ps.includes(n))
      if (bad.length) { problems.push(`${where}: params declares :${bad.join(', :')} which the path does not have`); continue }
      let rest = unbound.filter(p => !v.names.includes(p))
      if (rest.length === 1 && callsGuard(d.body)) rest = []
      if (rest.length) { problems.push(`${where}: :${rest.join(', :')} NOT bound to the URL project (params covers only :${v.names.join(', :')})`); continue }
      listing.push(`${where} -> params(${ps.join(',')}; non-entity ${v.names.join(',')})`); continue
    }
    if (v && v.ok === true) { listing.push(`${where} -> ${v.kind}`); continue }
    if (!unbound.length) { listing.push(`${where} -> params(${ps.join(',')})`); continue }
    if (ps.length === 1 && callsGuard(d.body)) { listing.push(`${where} -> guard(auto)`); continue }
    problems.push(`${where}: :${unbound.join(', :')} NOT bound to the URL project (bind via projectScope / a scoped router.param, or declare // project-scope: …)`)
  }
}

// OUTSIDE THE TREE: a route file elsewhere under app/routes that serves
// `/project/:projectUrl/...` itself is invisible to the scan above AND does not
// get index.js's projectUrl authorisation (Express params are per-router).
// Measured 2026-09-25: data-api/models.js (14 routes). Each such file must be
// on this list, with its tracking item; a NEW one fails the gate.
// §394 (2026-09-25): models.js moved under project/ — the list is EMPTY and
// should stay so; adding an entry is adding an unauthorised route file.
const OUTSIDE_KNOWN = {}
function walkAll (dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walkAll(p))
    else if (e.name.endsWith('.js')) out.push(p)
  }
  return out
}
const ROUTES = path.join(ROOT, 'app/routes')
if (fs.existsSync(ROUTES) && rootIdx < 0) {
  for (const f of walkAll(ROUTES)) {
    if (f.startsWith(BASE + path.sep)) continue
    const rel = path.relative(ROOT, f)
    const t = fs.readFileSync(f, 'utf8')
    if (!/\.(get|post|put|delete|patch|all|use)\(\s*['"`]\/project\/:projectUrl\//.test(t)) continue
    if (OUTSIDE_KNOWN[rel]) { listing.push(`${rel} -> OUTSIDE-KNOWN ${OUTSIDE_KNOWN[rel]}`); continue }
    problems.push(`${rel}: serves /project/:projectUrl/... outside app/routes/data-api/project/ — no projectUrl authorisation reaches it; move it under project/ (or add to OUTSIDE_KNOWN with a tracking item)`)
  }
}

if (declCount < MIN) die(`only ${declCount} route declarations found under ${path.relative(ROOT, BASE)} (expected ≥ ${MIN}) — refusing a vacuous pass`)
if (debtCount > DEBT_MAX) problems.push(`debt declarations ${debtCount} > DEBT_MAX ${DEBT_MAX} — new unbound id routes are not allowed; bind them instead`)

if (LIST) console.log(listing.join('\n'))
if (problems.length) {
  console.error(`check-project-scope: ${problems.length} problem(s):`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`check-project-scope: OK — ${declCount} declarations, ${listing.length} id routes/params bound (debt ${debtCount}/${DEBT_MAX})`)
process.exit(0)