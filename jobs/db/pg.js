// PostgreSQL backend for the jobs/ tree (mysql2pg — arbimon exports on PG).
//
// Exposes the facade shape jobs/services/* were written against (getConnection()
// -> { execute(sql) -> [rows, fields] }, the mysql2/promise shape; that backend
// was removed at P7 step 5, rfcx-local OPEN-ITEMS §320, 2026-09-20) so the
// services needed no per-call-site changes. MySQL-dialect SQL is run
// through the P6 translate() layer (app/utils/dbpool-pg.js) before execution
// — the same translator the Phase-6 shadow canary validates in production.
//
// Parity choices (deliberate, mirror the retired mysql2 config: dateStrings:true):
//   - dateStrings parity: timestamp/date OIDs parse to raw STRINGS so CSV/
//     email formatting sees identical values on both engines.
//   - numerics parse to Numbers (mysql2 default; values here are ids/counts/
//     scores far below 2^53).
//   - Type parsers are PER-POOL (pool `types` option), NOT pg-lib-global:
//     app/utils/dbpool-pg.js installs its own global 1114 parser for the
//     shadow path, and a global override here would corrupt it (and vice
//     versa) whenever both live in one process.
//
// Role model (defense in depth, mirrors the platform pattern):
//   - READ pool  = POSTGRES_* env -> arbimon_ro. TRUE SINCE 2026-09-16 (S1 /
//     OPQ-14): until then this comment was ASPIRATIONAL and both pools
//     authenticated as arbimon_worker (full DML) -- the manifest said as much
//     in its own comment while this line claimed otherwise. The privilege is
//     now enforced by the ROLE, not by code-path discipline: arbimon_ro holds
//     SELECT only (110-role-grants.sql), verified live
//     has_table_privilege(arbimon_ro,'recordings_deleted','DELETE') = false.
//   - WRITE pool = POSTGRES_WRITER_* env -> arbimon_worker (claim + status
//     writes on recordings_export_parameters ONLY), used via writerQuery().
//
// ONE KNOWN EXCEPTION, deliberately left in place (S1, 2026-09-16):
// `services/recordings.js: deleteRecordings()` issues a DELETE through
// getConnection() -- i.e. on the READ pool -- and that call fails with 42501
// rather than succeed. It is NOT reachable: its only caller is CronJob
// `arbimon-recording-delete-job`, which is suspend=true and carries MYSQL_*
// creds only (parked at `mariadb.retired.invalid`); since P7 step 5 there is no
// mysql backend for it to resolve to, so a resume fails loudly at the pool
// (no POSTGRES_* env). Its SQL is also MySQL-only (`DELETE ... ORDER BY ...
// LIMIT` = 42601 on PG, returned byte-identical by translate()), so it could
// never have run here regardless of privilege.
// Fixing it is deferred on purpose: that statement reaps the `recordings_deleted`
// TOMBSTONE ledger (never recordings), whose retention semantics are an open
// question in the delete->archive arc -- porting the syntax before the policy
// is settled would be building it twice.
const { Pool, types } = require('pg')

// Per-pool type parsing (see header). OIDs: 1114 timestamp, 1184 timestamptz,
// 1082 date, 1700 numeric, 20 int8.
const STRING_DATES_TYPES = {
  getTypeParser: (oid, format) => {
    if (oid === 1114 || oid === 1184 || oid === 1082) return v => v
    if (oid === 1700) return v => (v === null ? null : parseFloat(v))
    if (oid === 20) return v => (v === null ? null : parseInt(v, 10))
    return types.getTypeParser(oid, format)
  }
}

const pgshadow = require('../../app/utils/dbpool-pg') // translate() only; INERT otherwise

let readPool
let writePool

function mkPool (prefix) {
  const env = (k, dflt) => process.env[prefix + k] || process.env['POSTGRES_' + k] || dflt
  return new Pool({
    host: env('HOSTNAME'),
    port: parseInt(env('PORT', '5432'), 10),
    database: env('NAME', 'arbimon'),
    user: env('USERNAME'),
    password: env('PASSWORD'),
    max: parseInt(process.env.POSTGRES_POOL_MAX || '5', 10),
    // NB: do NOT set `statement_timeout` as a CONNECTION option — node-pg sends
    // it as a startup parameter, and the arbimon pgbouncer runs pool_mode=
    // transaction with ignore_startup_parameters=extra_float_digits,options
    // (statement_timeout NOT listed), so a connection carrying it is REJECTED
    // (unsupported startup parameter). This is the pgbouncer :6432 the flipped
    // workers + this worker use. Export CSV builds are intentionally long, so we
    // run WITHOUT a statement timeout. If a per-statement bound is ever needed,
    // use `SET LOCAL statement_timeout` inside an explicit txn (the pattern the
    // P6 shadow adapter uses: `BEGIN READ ONLY; SET LOCAL statement_timeout=...`).
    types: STRING_DATES_TYPES
  })
}

function getReadPool () {
  if (!readPool) {
    readPool = mkPool('POSTGRES_')
    readPool.on('error', err => console.error('[jobs/db/pg] read pool idle error', err.message))
  }
  return readPool
}

function getWritePool () {
  if (!writePool) {
    writePool = mkPool('POSTGRES_WRITER_')
    writePool.on('error', err => console.error('[jobs/db/pg] write pool idle error', err.message))
  }
  return writePool
}

// Facade parity (the former mysql.js shape): getConnection() -> { execute }.
// The services hand us MySQL-dialect SQL (values interpolated, no placeholders) — translate,
// then execute on the READ (arbimon_ro) pool.
async function getConnection () {
  const pool = getReadPool()
  return {
    execute: async (sql) => {
      const pgSql = pgshadow.translate(sql)
      const res = await pool.query(pgSql)
      return [res.rows, res.fields]
    },
    // mysql-path callers call commit() after writes; reads are autocommit
    // here and writes go through writerQuery(), so this is a no-op.
    commit: async () => {}
  }
}

// Parameterized PG-NATIVE query on the WRITER pool (claim/status updates on
// recordings_export_parameters — written in PG dialect, NOT translated).
async function writerQuery (sql, params) {
  return getWritePool().query(sql, params)
}

// Parameterized PG-native query on the READ pool.
async function readQuery (sql, params) {
  const res = await getReadPool().query(sql, params)
  return res.rows
}

async function closeConnection () {
  if (readPool) { await readPool.end(); readPool = undefined }
  if (writePool) { await writePool.end(); writePool = undefined }
}

module.exports = {
  getConnection,
  closeConnection,
  readQuery,
  writerQuery
}