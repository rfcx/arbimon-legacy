#!/usr/bin/env node
/*
 * build/check-stage-copy-closure.js
 *
 * PRE-MERGE GATE for the export/delete-stage `COPY` trap.
 *
 * WHY THIS EXISTS
 * ---------------
 * `build/Dockerfile` builds THREE targets from one commit. The web stage
 * (`arbimon-legacy`) does `COPY app /app/app` — the WHOLE tree. The two job
 * stages (`arbimon-recording-delete-job`, `arbimon-recording-export-job`)
 * copy `app/model/*` INDIVIDUALLY BY NAME. So a PR can add
 * `app/model/new-thing.js`, require it from a file the job path already
 * reaches, build all three images GREEN (a by-name COPY of an unrelated file
 * cannot fail), roll via CD, and CrashLoop `arbimon-export-consumer` on
 * `Cannot find module './new-thing'`.
 *
 * It has bitten TWICE, both caught POST-roll by a human soak check:
 *   2026-09-16  app/model/site-rec-count.js      #1892 -> hotfix #1893  (~3 min)
 *   2026-09-22  app/model/playlist-rec-count.js  #1939 -> hotfix #1940  (~9 min,
 *               consumer CrashLoop x3)
 *
 * WHAT IT CHECKS
 * --------------
 * For each job stage, walk the `require()` graph from that stage's CMD
 * entrypoint(s) and assert that EVERY reached repo file under `app/` is
 * covered by a `COPY` line in that stage (a directory COPY covers its
 * subtree). Additionally assert that every BARE npm specifier reached is
 * declared in `jobs/package.json` — the sibling failure class with the
 * identical symptom (MODULE_NOT_FOUND at job start), currently satisfied only
 * TRANSITIVELY and therefore one `npm` dedup away from breaking.
 *
 * DELIBERATELY CONSERVATIVE (fails CLOSED): it counts a `require()` anywhere in
 * a file, including lazily-invoked ones inside a function body. A lazy require
 * that is never reached at runtime still MUST be present in the image, because
 * nothing guarantees it stays unreached. Over-approximating here costs one
 * `COPY` line; under-approximating costs a prod CrashLoop.
 *
 * SCOPE IS AN EXPLICIT ALLOW-LIST, NOT A GLOB (quickstart §TOOL-HYGIENE 3d
 * corollary): the stages and their entrypoints are enumerated in STAGES below.
 * Adding a new job stage means adding it here — deliberately, not silently.
 *
 * Exit 0 = clean. Exit 1 = a gap, naming the file and the stage. Exit 2 = the
 * checker itself could not run (missing Dockerfile/entrypoint) — a FAILURE, not
 * a skip, because a gate that cannot run must never report success.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DOCKERFILE = path.join(ROOT, 'build/Dockerfile')

// --- explicit allow-list: stage -> the entrypoints its CMD can start ---------
const STAGES = {
  'arbimon-recording-export-job': [
    // CMD runs index.js; the k8s Deployment/CronJob override `command` to run
    // consumer.js / reconciler.js from the SAME image, so all three are
    // entrypoints for COPY-coverage purposes.
    'jobs/arbimon-recording-export-job/index.js',
    'jobs/arbimon-recording-export-job/consumer.js',
    'jobs/arbimon-recording-export-job/reconciler.js'
  ],
  'arbimon-recording-delete-job': [
    'jobs/arbimon-recording-delete-job/index.js'
  ]
}

const JOBS_PKG = path.join(ROOT, 'jobs/package.json')

// --- Dockerfile parsing ------------------------------------------------------

function fail (msg) {
  console.error(`check-stage-copy-closure: ${msg}`)
  process.exit(2)
}

function parseStages (text) {
  // Returns { stageName: { parent, copies: [src], pairs: [{src,dest,line}] } }
  const stages = {}
  let current = null
  let lineNo = 0
  for (const rawLine of text.split('\n')) {
    lineNo++
    const line = rawLine.trim()
    const from = /^FROM\s+(\S+)\s+as\s+(\S+)/i.exec(line)
    if (from) {
      current = from[2]
      stages[current] = { parent: from[1], copies: [], pairs: [] }
      continue
    }
    if (!current) continue
    if (!/^COPY\s/i.test(line)) continue
    // Two forms: `COPY src dest` and `COPY ["a", "b", "dest"]`
    let srcs = []
    let dest = null
    const jsonForm = /^COPY\s+(\[.*\])\s*$/i.exec(line)
    if (jsonForm) {
      let arr
      try { arr = JSON.parse(jsonForm[1]) } catch (_) { arr = null }
      if (Array.isArray(arr) && arr.length >= 2) { srcs = arr.slice(0, -1); dest = arr[arr.length - 1] }
    } else {
      const parts = line.replace(/^COPY\s+/i, '').split(/\s+/).filter(Boolean)
      // drop flags like --from=x / --chown=y
      const positional = parts.filter(p => !p.startsWith('--'))
      if (positional.length >= 2) { srcs = positional.slice(0, -1); dest = positional[positional.length - 1] }
    }
    for (const s of srcs) {
      const clean = s.replace(/^\.\//, '')
      stages[current].copies.push(clean)
      stages[current].pairs.push({ src: clean, dest, line: lineNo })
    }
  }
  return stages
}

function effectiveCopies (stages, stageName) {
  // A stage inherits everything its parent stage copied.
  const out = []
  const seen = new Set()
  let cur = stageName
  while (cur && stages[cur] && !seen.has(cur)) {
    seen.add(cur)
    out.push(...stages[cur].copies)
    cur = stages[cur].parent
  }
  return out
}

function isCovered (relFile, copies) {
  for (const src of copies) {
    if (src.includes('*') || src.includes('?')) {
      // Only the jobs/package-lock.json* glob appears today; treat a glob as
      // covering its literal prefix, conservatively (no file under app/ uses one).
      const prefix = src.slice(0, Math.min(src.indexOf('*'), src.indexOf('?') === -1 ? Infinity : src.indexOf('?')))
      if (relFile.startsWith(prefix)) return true
      continue
    }
    if (relFile === src) return true
    if (relFile.startsWith(src.endsWith('/') ? src : src + '/')) return true
  }
  return false
}

// --- require() graph ---------------------------------------------------------

function resolveRelative (fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [base, base + '.js', base + '.json', path.join(base, 'index.js')]
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c } catch (_) {}
  }
  return null
}

function literalRequires (src) {
  const out = []
  const re = /require\(\s*(['"])([^'"]+)\1\s*\)/g
  let m
  while ((m = re.exec(src))) out.push(m[2])
  return out
}

function dynamicRequireSites (src) {
  // `require(` NOT immediately followed by a quote. Used to report an
  // un-analysable site loudly rather than passing over it silently.
  const out = []
  const re = /require\(\s*(?!['"])/g
  let m
  while ((m = re.exec(src))) {
    const upto = src.slice(0, m.index)
    const line = upto.split('\n').length
    const lineText = src.split('\n')[line - 1] || ''
    // Skip comment lines — a `require(` inside a // or * comment is prose.
    const trimmed = lineText.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
    out.push(line)
  }
  return out
}

function closure (entryAbs) {
  const seen = new Set()
  const bare = new Map() // pkg -> Set(requiring files)
  const dynamic = []
  const unresolved = []
  const queue = [entryAbs]
  while (queue.length) {
    const f = queue.shift()
    if (seen.has(f)) continue
    seen.add(f)
    let src
    try { src = fs.readFileSync(f, 'utf8') } catch (_) { continue }
    if (f.endsWith('.json')) continue
    for (const line of dynamicRequireSites(src)) {
      dynamic.push(`${path.relative(ROOT, f)}:${line}`)
    }
    for (const spec of literalRequires(src)) {
      if (spec.startsWith('.')) {
        const r = resolveRelative(f, spec)
        if (!r) { unresolved.push(`${path.relative(ROOT, f)} -> ${spec}`); continue }
        if (!r.startsWith(ROOT) || r.includes('node_modules')) continue
        queue.push(r)
      } else {
        const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
        if (!bare.has(pkg)) bare.set(pkg, new Set())
        bare.get(pkg).add(path.relative(ROOT, f))
      }
    }
  }
  return { files: seen, bare, dynamic, unresolved }
}

// --- main --------------------------------------------------------------------

function main () {
  if (!fs.existsSync(DOCKERFILE)) fail(`missing ${path.relative(ROOT, DOCKERFILE)}`)
  if (!fs.existsSync(JOBS_PKG)) fail('missing jobs/package.json')

  const stages = parseStages(fs.readFileSync(DOCKERFILE, 'utf8'))
  const jobsPkg = JSON.parse(fs.readFileSync(JOBS_PKG, 'utf8'))
  const declared = new Set([
    ...Object.keys(jobsPkg.dependencies || {}),
    ...Object.keys(jobsPkg.devDependencies || {})
  ])
  const builtin = new Set(require('module').builtinModules)

  const problems = []
  let checked = 0

  for (const [stage, entries] of Object.entries(STAGES)) {
    if (!stages[stage]) fail(`Dockerfile has no stage named '${stage}' (allow-list is stale)`)
    const copies = effectiveCopies(stages, stage)

    // --- destination sanity: a single-FILE copy must land at the SAME relative
    // path inside the image, or `require('./x')` resolves to the wrong module.
    // This is a THIRD historical shape: commit e6e31c14 (2023-05-16) fixed
    // `COPY app/model/recordings.js /app/app/model/clustering-jobs.js` — a
    // green build that shipped recordings.js UNDER TWO NAMES. Source-side
    // closure checking cannot see it; destination checking can.
    for (const { src, dest, line } of (stages[stage].pairs || [])) {
      if (!src.startsWith('app/')) continue
      let isFile = false
      try { isFile = fs.statSync(path.join(ROOT, src)).isFile() } catch (_) { continue }
      if (!isFile) continue
      const expected = '/app/' + src
      if (dest !== expected) {
        problems.push(
          `${stage}: build/Dockerfile:${line} copies '${src}' to '${dest}', expected '${expected}'.\n` +
          `    A file copied to a DIFFERENT name still builds green but ships the wrong module\n` +
          `    (precedent: commit e6e31c14, recordings.js shipped as clustering-jobs.js).`
        )
      }
    }

    for (const entry of entries) {
      const abs = path.join(ROOT, entry)
      if (!fs.existsSync(abs)) fail(`entrypoint '${entry}' (stage ${stage}) does not exist`)
      const { files, bare, dynamic, unresolved } = closure(abs)
      checked++

      const reached = [...files].map(f => path.relative(ROOT, f)).sort()
      const appFiles = reached.filter(f => f.startsWith('app/'))
      const missing = appFiles.filter(f => !isCovered(f, copies))
      const missingPkgs = [...bare.keys()]
        .filter(p => !builtin.has(p) && !p.startsWith('node:') && !declared.has(p))
        .sort()

      console.log(
        `[${stage}] ${entry}: ${reached.length} files reached, ` +
        `${appFiles.length} under app/, ${bare.size} npm specifiers`
      )

      for (const f of missing) {
        problems.push(
          `${stage}: '${f}' is reached from ${entry} but NO COPY in that stage covers it.\n` +
          `    FIX: add to build/Dockerfile under 'FROM build as ${stage}':\n` +
          `      COPY ${f} /app/${f}`
        )
      }
      for (const p of missingPkgs) {
        const sites = [...bare.get(p)].slice(0, 3).join(', ')
        problems.push(
          `${stage}: npm package '${p}' is required on the ${entry} path ` +
          `(e.g. ${sites}) but is NOT declared in jobs/package.json.\n` +
          `    It resolves today only TRANSITIVELY; an npm hoist change breaks the job image.\n` +
          `    FIX: add '${p}' to jobs/package.json dependencies.`
        )
      }
      for (const d of dynamic) {
        problems.push(
          `${stage}: NON-LITERAL require() at ${d} on the ${entry} path — this checker ` +
          `cannot follow it, so COPY coverage cannot be proven.\n` +
          `    FIX: make the specifier a string literal, or COPY the target explicitly and ` +
          `allow-list the site here.`
        )
      }
      for (const u of unresolved) {
        problems.push(`${stage}: unresolved relative require: ${u}`)
      }
    }
  }

  if (checked === 0) fail('0 entrypoints checked — refusing to report success')

  if (problems.length) {
    console.error('\n=== export/delete-stage COPY closure: ' + problems.length + ' PROBLEM(S) ===\n')
    for (const p of problems) console.error('  ✗ ' + p + '\n')
    console.error(
      'Background: build/Dockerfile\'s job stages copy app/model/* BY NAME while the web\n' +
      'stage copies app/ whole, so the web image works and the job image CrashLoops on\n' +
      'MODULE_NOT_FOUND after CD rolls. Precedents: #1892->#1893 (2026-09-16),\n' +
      '#1939->#1940 (2026-09-22).\n'
    )
    process.exit(1)
  }

  console.log(`\nOK: ${checked} entrypoint closures fully covered by their stage's COPY lines.`)
  process.exit(0)
}

main()