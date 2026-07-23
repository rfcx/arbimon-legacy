require('dotenv').config()

const amqp = require('amqplib')
const db = require('../db')
const { processExportRow } = require('./index')
const { claimExportRow, setExportTerminal, clearClaim, recoverStaleClaims } = require('../services/export-queue')

const AMQP_URL = process.env.AMQP_URL || process.env.RABBITMQ_URL
const QUEUES = (process.env.EXPORTS_QUEUES || 'exports.work.express,exports.work.0,exports.work.1,exports.work.2,exports.work.3')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
const DLQ = process.env.EXPORTS_DLQ || 'exports.work.dlq'
const PREFETCH = parseInt(process.env.EXPORTS_PREFETCH || '1', 10)
const MAX_ATTEMPTS = parseInt(process.env.EXPORTS_MAX_ATTEMPTS || '3', 10)
const TEST_RECIPIENT = process.env.EXPORTS_FORCE_RECIPIENT
// E2E defense-in-depth: when set, the DB claim itself filters user_email = this
// value, so a test consumer PHYSICALLY cannot claim a real user's row even if a
// real message reaches it (2026-07-15 incident class). Test pods set BOTH this
// and EXPORTS_FORCE_RECIPIENT to the operator's address.
const CLAIM_ONLY_EMAIL = process.env.EXPORTS_CLAIM_ONLY_EMAIL || null

if (!AMQP_URL) {
  console.error('Missing AMQP_URL/RABBITMQ_URL')
  process.exit(2)
}
if ((process.env.EXPORTS_DB_ENGINE || '').toLowerCase() !== 'pg') {
  console.error('export-consumer requires EXPORTS_DB_ENGINE=pg')
  process.exit(2)
}

function parseMessage (msg) {
  const body = msg.content.toString('utf8')
  const parsed = JSON.parse(body)
  if (parsed.v !== 1) throw new Error('unsupported export message version')
  if (!parsed.project_id || !parsed.user_id || !parsed.created_at) throw new Error('missing export key fields')
  return parsed
}

async function publishDlq (ch, original, reason, attempts) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    failed_at: new Date().toISOString(),
    reason: String(reason && reason.message ? reason.message : reason).slice(0, 2000),
    attempts,
    original
  }))
  await ch.sendToQueue(DLQ, payload, { persistent: true, contentType: 'application/json' })
}

async function requeue (ch, original, attempts) {
  const next = { ...original, attempt: attempts }
  const q = original.queue || QUEUES[0]
  await ch.sendToQueue(q, Buffer.from(JSON.stringify(next)), { persistent: true, contentType: 'application/json' })
}

async function handleMessage (ch, msg) {
  let payload
  let claimed
  let acked = false
  const ackOnce = () => { if (!acked) { acked = true; ch.ack(msg) } }
  try {
    payload = parseMessage(msg)
    const attempt = Number(payload.attempt || 0)
    const { token, row } = await claimExportRow(payload, null, CLAIM_ONLY_EMAIL)
    claimed = { token, row }
    if (!row) {
      // Already terminal, stale duplicate, or another worker claimed it.
      ackOnce()
      return
    }

    // ACK-ON-CLAIM (2026-07-23 E2E finding): exports run for HOURS (pmAll
    // chunked 2,153 CSV chunks before RabbitMQ's default 30-min
    // consumer_timeout killed the channel: 406 PRECONDITION-FAILED 'delivery
    // acknowledgement timed out'). The DB claim is the source of truth — once
    // the row is sentinelled, the message's dispatch job is DONE. Ack now;
    // a worker crash mid-export leaves the sentinel → stale-claim TTL →
    // reconciler republish (the same recovery path as SIGTERM, already
    // proven). Retry/DLQ below REPUBLISH rather than nack.
    ackOnce()

    // Safe-test hook: only enabled in isolated test pods. Production workers do
    // NOT set this. We override the row before processExportRow sees it, so all
    // send paths (legacy + notify gateway) target the forced recipient.
    if (TEST_RECIPIENT) row.user_email = TEST_RECIPIENT

    try {
      await processExportRow(row)
      // Success: processExportRow's success branches already wrote
      // processed_at (via setExportTerminal, keyed on the claim token). If a
      // branch recorded a deterministic error and resolved (legacy #1759
      // semantics for bad-params/poison rows), the row is terminal-with-error
      // and won't be re-picked. Message was acked at claim.
    } catch (err) {
      // processExportRow threw WITHOUT recording terminal state (the branches
      // that reject/throw). The claim sentinel is still set, so we own the
      // terminal decision here. (Message already acked — we republish.)
      if (attempt + 1 >= MAX_ATTEMPTS) {
        // Terminal failure: record the error (keyed on the token, first-writer
        // -wins) and quarantine to the DLQ. Do NOT clearClaim — we WANT the row
        // to stay terminal (error set), not become pending again.
        await setExportTerminal(token, { error: String(err && err.message ? err.message : err) })
        await publishDlq(ch, payload, err, attempt + 1)
      } else {
        // Retryable: release the claim (error -> NULL) so the next delivery can
        // re-claim, and republish with attempt+1.
        await clearClaim(row, token)
        await requeue(ch, payload, attempt + 1)
      }
    }
  } catch (err) {
    console.error('[export-consumer] message failed before claim/terminal', err)
    try { if (payload) await publishDlq(ch, payload, err, Number(payload.attempt || 0) + 1) } catch (_) {}
    ackOnce() // guarded: never double-ack (a double basic.ack is a channel error)
  }
}

async function main () {
  console.log('[export-consumer] starting', { queues: QUEUES, dlq: DLQ, prefetch: PREFETCH })
  const recovered = await recoverStaleClaims()
  if (recovered) console.log('[export-consumer] recovered stale claims', recovered)

  const conn = await amqp.connect(AMQP_URL)
  const ch = await conn.createChannel()
  // PER-CONSUMER prefetch (global QoS is NOT-IMPLEMENTED on quorum queues —
  // learned live in E2E: connection 540 on the first consume). With one
  // consumer per lane this admits up to N-lanes unacked deliveries into the
  // pod, but the serialize mutex below guarantees only ONE export executes at
  // a time (the rest wait in the promise chain), which is the actual
  // correctness requirement (shared tmpfilecache/ + fixed zip paths).
  await ch.prefetch(PREFETCH)

  // Topology is declared by the bootstrap Job; passive check here catches drift
  // without accidentally redeclaring with incompatible args.
  for (const q of [...QUEUES, DLQ]) await ch.checkQueue(q)

  // Belt-and-braces: serialize handleMessage in-process regardless of QoS
  // semantics (a simple promise-chain mutex). One export at a time per pod is
  // the design (the old cron was serial); parallelism comes from KEDA replicas.
  let chain = Promise.resolve()
  const serialize = (fn) => { chain = chain.then(fn, fn); return chain }

  for (const q of QUEUES) {
    await ch.consume(q, msg => serialize(() => handleMessage(ch, msg)), { noAck: false })
  }

  const shutdown = async () => {
    console.log('[export-consumer] shutting down')
    try { await ch.close() } catch (_) {}
    try { await conn.close() } catch (_) {}
    try { await db.closeAll() } catch (_) {}
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch(async err => {
  console.error('[export-consumer] fatal', err)
  try { await db.closeAll() } catch (_) {}
  process.exit(1)
})
