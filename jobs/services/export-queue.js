// Arbimon export queue PG claim/status helpers (OPEN-ITEMS #64 / ADR-023).
//
// V1 deliberately uses NO schema changes. A message contains the legacy logical
// key (project_id,user_id,created_at), which is not unique in live data. The
// worker claims exactly ONE matching un-terminal row using PG's `ctid` +
// `FOR UPDATE SKIP LOCKED`, so collisions and concurrent workers are safe.
//
// State machine in recordings_export_parameters (NO schema change):
//   processed_at NULL + error NULL              -> pending
//   error = 'IN_PROGRESS|<iso8601>|<uuid>'      -> claimed by a worker
//   processed_at non-null                       -> success (existing code path)
//   error non-null (not IN_PROGRESS|)           -> terminal failure
//
// We use `error` as the in-progress sentinel to avoid a schema change. The
// sentinel EMBEDS the claim time so recoverStaleClaims() measures CLAIM age,
// NOT the row's (ancient, backlog) created_at — a dead worker's claim is
// released only after a real claim-age TTL. The '|' delimiter avoids the colons
// inside the ISO timestamp. listPendingExports excludes error IS NOT NULL, so a
// claimed row is never republished. The legacy cron is suspended in queue mode.
const crypto = require('crypto')
const pg = require('../db/pg')

const CLAIM_PREFIX = 'IN_PROGRESS|'

function normalizeCreatedAt (v) {
  if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 19)
  return String(v).replace('T', ' ').replace(/\.\d+Z?$/, '').slice(0, 19)
}

function messageFromRow (row) {
  return {
    v: 1,
    project_id: Number(row.project_id),
    user_id: Number(row.user_id),
    created_at: normalizeCreatedAt(row.created_at),
    export_type: row.export_type || 'unknown'
  }
}

function claimToken () {
  return CLAIM_PREFIX + new Date().toISOString() + '|' + crypto.randomUUID()
}

async function claimExportRow (msg, token, onlyEmail) {
  token = token || claimToken()
  // Claim exactly ONE un-terminal row matching the (non-unique) logical key,
  // picked by ctid under SKIP LOCKED so collisions + concurrent workers are
  // safe. Stamp the unique claim token into `error` as an in-progress sentinel
  // (no schema change). We JOIN projects so the claimed row carries `name`,
  // matching what the cron's getExportRecordingsRow returns (rep.*, p.name) —
  // processExportRow reads rowData.name for logs + the RFM email projectName.
  const sql = `
    WITH target AS (
      SELECT rep.ctid
      FROM recordings_export_parameters rep
      WHERE rep.project_id = $1
        AND rep.user_id = $2
        AND rep.created_at = $3::timestamp
        AND rep.processed_at IS NULL
        AND rep.error IS NULL
        AND ($5::text IS NULL OR rep.user_email = $5::text)
      ORDER BY rep.created_at ASC, rep.ctid ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE recordings_export_parameters rep
    SET error = $4
    FROM target
    WHERE rep.ctid = target.ctid
    RETURNING rep.*`
  // onlyEmail (EXPORTS_CLAIM_ONLY_EMAIL): E2E-test defense-in-depth — a test
  // consumer physically cannot claim (and thereby consume/mark-processed) a
  // REAL user's row even if a real message somehow reaches it (2026-07-15
  // incident class). Production workers leave it unset (NULL = no filter).
  const res = await pg.writerQuery(sql, [msg.project_id, msg.user_id, normalizeCreatedAt(msg.created_at), token, onlyEmail || null])
  const row = res.rows && res.rows[0]
  if (row) {
    row._claimToken = token
    // enrich with project name (claim UPDATE can't JOIN in RETURNING)
    const pr = await pg.readQuery('SELECT name FROM projects WHERE project_id = $1', [row.project_id])
    row.name = pr && pr[0] ? pr[0].name : row.name
  }
  return { token, row }
}

// Terminal status write for the CLAIMED row, targeted by the unique claim
// token (safe under the non-unique logical key collision). On success we clear
// the sentinel (error -> NULL) and set processed_at; on failure error -> msg.
// Parameterized on the WRITER pool (arbimon_worker) — no interpolation.
async function setExportTerminal (token, attrs) {
  if (attrs.processed_at !== undefined) {
    await pg.writerQuery(
      `UPDATE recordings_export_parameters
       SET processed_at = $1::timestamp, error = NULL
       WHERE error = $2`,
      [normalizeCreatedAt(attrs.processed_at), token]
    )
  } else if (attrs.error !== undefined) {
    await pg.writerQuery(
      `UPDATE recordings_export_parameters
       SET error = $1
       WHERE error = $2`,
      [String(attrs.error).slice(0, 4000), token]
    )
  }
}

async function clearClaim (row, token) {
  if (!row) return
  await pg.writerQuery(
    `UPDATE recordings_export_parameters
     SET error = NULL
     WHERE project_id = $1 AND user_id = $2 AND created_at = $3::timestamp AND error = $4`,
    [row.project_id, row.user_id, normalizeCreatedAt(row.created_at), token]
  )
}

async function recoverStaleClaims (olderThanMinutes) {
  olderThanMinutes = olderThanMinutes || parseInt(process.env.EXPORTS_STALE_CLAIM_MINUTES || '120', 10)
  // Release a claim only if the CLAIM itself (the ISO time embedded in the
  // sentinel, field 2 of 'IN_PROGRESS|<iso>|<uuid>') is older than the TTL.
  // Keyed on claim age — NOT the row's created_at (which is ancient for the
  // backlog and would wrongly release a just-made claim). split_part indexes
  // are 1-based; the ISO timestamp is field 2.
  const res = await pg.writerQuery(
    `UPDATE recordings_export_parameters
     SET error = NULL
     WHERE processed_at IS NULL
       AND error LIKE 'IN_PROGRESS|%'
       AND split_part(error, '|', 2) <> ''
       AND (split_part(error, '|', 2))::timestamptz
             < now() - ($1 || ' minutes')::interval`,
    [olderThanMinutes]
  )
  return res.rowCount
}

async function listPendingExports (limit) {
  limit = limit || parseInt(process.env.EXPORTS_RECONCILE_LIMIT || '100', 10)
  return pg.readQuery(
    `SELECT rep.*, p.name
     FROM recordings_export_parameters rep
     JOIN projects p ON p.project_id = rep.project_id
     WHERE rep.processed_at IS NULL
       AND rep.error IS NULL
       AND rep.created_at < (now() AT TIME ZONE 'UTC')
     ORDER BY rep.created_at ASC
     LIMIT $1`,
    [limit]
  )
}

module.exports = {
  claimExportRow,
  setExportTerminal,
  clearClaim,
  recoverStaleClaims,
  listPendingExports,
  messageFromRow,
  normalizeCreatedAt
}
