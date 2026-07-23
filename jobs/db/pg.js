// PostgreSQL backend for the jobs/ tree (mysql2pg — arbimon exports on PG).
//
// Exposes the SAME facade shape as jobs/db/mysql.js (getConnection() ->
// { execute(sql) -> [rows, fields] }) so jobs/services/* switch engines via
// jobs/db/backend.js with no per-call-site changes. MySQL-dialect SQL is run
// through the P6 translate() layer (app/utils/dbpool-pg.js) before execution
// — the same translator the Phase-6 shadow canary validates in production.
//
// Parity choices (deliberate, mirror the mysql2 config in ./mysql.js):
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
//   - READ pool  = POSTGRES_* env -> arbimon_ro (read-only role; the export
//     data collection can physically never mutate PG).
//   - WRITE pool = POSTGRES_WRITER_* env -> arbimon_worker (claim + status
//     writes on recordings_export_parameters ONLY), used via writerQuery().
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

// mysql.js facade parity: getConnection() -> { execute }. The services hand
// us MySQL-dialect SQL (values interpolated, no placeholders) — translate,
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