require('dotenv').config()

const db = require('../db')
const { recoverStaleClaims } = require('../services/export-queue')
const { publishPending } = require('../services/export-publisher')

async function main () {
  if ((process.env.EXPORTS_DB_ENGINE || '').toLowerCase() !== 'pg') {
    throw new Error('export reconciler requires EXPORTS_DB_ENGINE=pg')
  }
  const stale = await recoverStaleClaims()
  if (stale) console.log('[export-reconciler] recovered stale claims', stale)
  const limit = parseInt(process.env.EXPORTS_RECONCILE_LIMIT || '100', 10)
  const n = await publishPending(limit)
  console.log('[export-reconciler] published pending exports', n)
}

main()
  .catch(err => {
    console.error('[export-reconciler] fatal', err)
    process.exitCode = 1
  })
  .finally(async () => {
    try { await db.closeAll() } catch (_) {}
  })
