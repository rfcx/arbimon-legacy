// Export queue publisher/reconciler (ADR-023).
const amqp = require('amqplib')
const { listPendingExports, messageFromRow } = require('./export-queue')

const AMQP_URL = process.env.AMQP_URL || process.env.RABBITMQ_URL
const EXCHANGE = process.env.EXPORTS_EXCHANGE || '' // direct-to-queue v1 (default exchange)
const EXPRESS_QUEUE = process.env.EXPORTS_EXPRESS_QUEUE || 'exports.work.express'
const LANES = (process.env.EXPORTS_LANES || 'exports.work.0,exports.work.1,exports.work.2,exports.work.3')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function exportType (projection) {
  if (!projection) return 'recording'
  if (projection.rfmClassify) return 'rfmClassify'
  if (projection.pmAll) return 'pmAll'
  if (projection.pmIds) return 'pmIds'
  if (projection.aed) return 'aed'
  if (projection.grouped && projection.validation) return 'grouped'
  if (projection.species) return 'species'
  if (projection.soundscapes) return 'soundscapes'
  if (projection.projectTemplate) return 'projectTemplate'
  return 'recording'
}

function laneFor (msg) {
  // v1 conservative: small/metadata exports express; heavy row-scan exports lane.
  const t = msg.export_type
  if (t === 'projectTemplate' || t === 'rfmClassify') return EXPRESS_QUEUE
  if (!LANES.length) return EXPRESS_QUEUE
  const key = `${msg.project_id}|${msg.user_id}|${msg.created_at}`
  let h = 0
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0
  return LANES[Math.abs(h) % LANES.length]
}

function messageFromExportRow (row) {
  let projection = null
  try { projection = JSON.parse(row.projection_parameters) } catch (_) {}
  const msg = messageFromRow({ ...row, export_type: exportType(projection) })
  msg.queue = laneFor(msg)
  return msg
}

async function connect () {
  if (!AMQP_URL) throw new Error('Missing AMQP_URL/RABBITMQ_URL')
  const conn = await amqp.connect(AMQP_URL)
  const ch = await conn.createConfirmChannel()
  return { conn, ch }
}

async function publishExport (ch, row) {
  const msg = messageFromExportRow(row)
  const body = Buffer.from(JSON.stringify(msg))
  const ok = EXCHANGE
    ? ch.publish(EXCHANGE, msg.queue, body, { persistent: true, contentType: 'application/json' })
    : ch.sendToQueue(msg.queue, body, { persistent: true, contentType: 'application/json' })
  if (!ok) await new Promise(resolve => ch.once('drain', resolve))
  return msg
}

async function publishPending (limit) {
  const rows = await listPendingExports(limit)
  const { conn, ch } = await connect()
  let n = 0
  try {
    for (const row of rows) {
      await publishExport(ch, row)
      n++
    }
    await ch.waitForConfirms()
    return n
  } finally {
    try { await ch.close() } catch (_) {}
    try { await conn.close() } catch (_) {}
  }
}

module.exports = {
  publishExport,
  publishPending,
  messageFromExportRow,
  exportType,
  laneFor
}
