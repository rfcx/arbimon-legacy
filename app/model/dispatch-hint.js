'use strict'
// Dispatch hints (2026-09-21, P3 of runbooks/DESIGN-2026-09-21-dispatch-redis-hints.md
// in evity-squibbon/rfcx-local; operator goifirr 05:33 + 06:46).
//
// After a job row is COMMITTED, drop "<job_id>:<type_id>" into the
// jobs:dispatch:hint Redis SET. The jobqueue-dispatcher pops hints on a 5s
// cadence and runs its UNCHANGED claim path (SKIP LOCKED + cancel predicate +
// deterministic k8s Job name). The hint is only a TRIGGER, never the
// authority: PG stays the source of truth and the dispatcher's reconcile scan
// keeps full correctness for any job whose hint is missing (writer crash
// between commit and emit, redis down, ad-hoc SQL requeue). A hint for a job
// that is not claim-eligible (already claimed, cancelled, wrong type/state)
// is discarded by the dispatcher for the cost of one indexed PK lookup.
//
// FIRE-AND-FORGET BY CONTRACT: job creation must never fail, block on, or
// even notice a hint failure. Every error is logged and swallowed; nothing
// here is awaited by the caller. Disable with DISPATCH_HINT_ENABLED=0
// (tests/dev); in prod the shared app redis client already points at redis-ha
// (the SAME instance the dispatcher reads), so no new env is needed.

const redis = require('../utils/redis')

const KEY = process.env.DISPATCH_HINT_REDIS_KEY || 'jobs:dispatch:hint'
const ENABLED = (process.env.DISPATCH_HINT_ENABLED || '1') !== '0'

function hint (jobId, typeId) {
  if (!ENABLED) return
  if (jobId === undefined || jobId === null || !typeId) return
  try {
    // The shared client is legacyMode:true, so the modern API lives under
    // .v4 (same pattern as app/utils/prewarm.js). sAdd returns a promise; we
    // deliberately do not return or await it — fire and forget.
    const p = redis.v4.sAdd(KEY, `${jobId}:${typeId}`)
    if (p && typeof p.catch === 'function') {
      p.catch(e => console.warn('dispatch-hint: SADD failed (ignored):', e && e.message))
    }
  } catch (e) {
    console.warn('dispatch-hint: emit failed (ignored):', e && e.message)
  }
}

module.exports = { hint }
