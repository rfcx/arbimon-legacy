// mysql2pg: the `mysql` binding below is jobs/db/backend.js, which is PostgreSQL-only
// since P7 step 5 (MySQL-dialect SQL here is run through the P6 translator).
const mysql = require('../db/backend')

async function deleteRecordings (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `DELETE FROM recordings_deleted
               WHERE ${options.where}
               ORDER BY ${options.orderBy}
               LIMIT ${options.limit}`
  const [rows, fields] = await connection.execute(sql)
  return rows
}

async function getRecordingByIds (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `select * from recordings where recording_id in (${options.recordingIds})`
  const [rows, fields] = await connection.execute(sql)
  return rows
}

// For export audio links: just the fields exportAudioUrl() needs. ANY() + a bound
// int array (no string-built IN list); site external_id is the stream-id fallback.
// Timestamps come back as raw strings (jobs/db/pg.js OID 1114 parser).
async function getRecordingsForAudioUrls (recordingIds) {
  const ids = (recordingIds || []).map(Number).filter(Number.isInteger)
  if (!ids.length) return []
  // PG-native + parameterised: readQuery, NOT the translated execute() facade.
  return mysql.readQuery(
    `select r.recording_id, r.uri, r.datetime, r.datetime_utc, r.duration, s.external_id
       from recordings r left join sites s on s.site_id = r.site_id
      where r.recording_id = ANY($1::bigint[])`, [ids])
}

async function getExportRecordingsRow (options = {}) {
    const connection = await mysql.getConnection()
    const sql = `SELECT rep.*, p.name FROM recordings_export_parameters rep
                 JOIN projects p ON p.project_id = rep.project_id
                 WHERE rep.created_at < '${options.currentTime}' AND rep.processed_at is null AND error is null
                 ORDER BY rep.created_at ASC
                 LIMIT ${options.limit}`
    const [rows, fields] = await connection.execute(sql)
    return rows
}

async function updateExportRecordings (options, attrs) {
    // PG queue path: when the row was claimed by a worker (carries a unique
    // claim token), route the terminal status write to the PG WRITER pool,
    // targeted by the token (safe under the non-unique logical key), and clear
    // the sentinel. Parameterized — no interpolation. See export-queue.js.
    if (options && options._claimToken) {
        const { setExportTerminal } = require('./export-queue')
        await setExportTerminal(options._claimToken, attrs)
        return { affectedRows: 1 }
    }
    const connection = await mysql.getConnection()
    const updatableFields = ['error', 'processed_at']
    const setStr = updatableFields
        .filter(f => attrs[f] !== undefined)
        .map((f) => {
        const valueWrapper = (typeof attrs[f] === 'number') ? '' : '\''
        return `${f}=${valueWrapper}${attrs[f]}${valueWrapper}`
        })
        .join(', ')
    const sql = `UPDATE recordings_export_parameters
                 SET ${setStr}
                 WHERE project_id = ${options.project_id}
                    AND user_id = ${options.user_id}
                    AND created_at = '${options.created_at}'`
    const [rows, fields] = await connection.execute(sql)
    await connection.commit()
    return rows
}

// REMOVED 2026-09-16 (operator ruling, S1b): `getCountConnections`.
//
// It read `information_schema.PROCESSLIST` -- a MySQL-only catalog that the P6
// translator does NOT rewrite -- so on EXPORTS_DB_ENGINE=pg it threw 42P01
// inside its caller's swallowing `catch`, i.e. the export job's own overload
// throttle FAILED OPEN. It was also semantically stale: it throttled on
// MariaDB thread count while this path's data now lives in PG, where an `idle`
// pgbouncer server connection is held capacity, not load (measured 2026-09-16:
// 68-92 backends `state IS NOT NULL`, of which only 2-3 `active`, against a
// `> 10` threshold calibrated for MariaDB -- a faithful port would have bailed
// the job on EVERY invocation, forever, silently).
//
// Measured dead, four ways, before deletion: unreachable from the live consumer
// (`consumer.js` imports `processExportRow`, not `main()`); its only real caller
// -- CronJob `arbimon-recording-export-job` -- is `suspend=true`, last scheduled
// 2026-06-22, last success 2026-07-15; its log line fired 0 times in 7 days
// against a 436-line positive control in the same stream; and it threw before
// it could throttle anyway.
//
// Overload protection on this path now rests on `replicas=1` + `EXPORTS_PREFETCH=1`
// (one export in flight by construction), `FOR UPDATE SKIP LOCKED` claim
// serialisation, and pgbouncer `default_pool_size=20` vs `max_connections=400`.
// If the CronJob is ever un-suspended, design a throttle THEN against measured
// PG behaviour -- do not restore this one.

async function exportOccupancyModels (specie, filters) {
    const connection = await mysql.getConnection()
    const isRangeAvailable = filters.range !== undefined
    // (rv.present=1 OR ...) sums as 0/1 on MySQL; PG SUM() rejects boolean.
    // CASE WHEN is engine-portable and identical on both.
    // PG lowercases unquoted aliases; MariaDB preserves them. Use a lowercase
    // alias (site_id) so the RESULT KEY is identical on both engines, and the
    // consumer reads row.site_id (see index.js occupancy path).
    let sql = `SELECT S.name as site, S.site_id as site_id, DATE_FORMAT(R.datetime, "%Y/%m/%d") as date, SUM(CASE WHEN (rv.present=1 OR rv.present_review>0 OR rv.present_aed>0) THEN 1 ELSE 0 END) as count
        FROM recordings R
        JOIN sites S ON S.site_id = R.site_id
        LEFT JOIN project_imported_sites AS pis ON S.site_id = pis.site_id AND pis.project_id = ${filters.project_id}
        LEFT JOIN recording_validations AS rv ON R.recording_id = rv.recording_id
        WHERE rv.species_id = ${specie}
            AND (S.project_id = ${filters.project_id} OR pis.project_id = ${filters.project_id})
            AND (rv.present_review>0 OR rv.present_aed>0 OR rv.present is not null)
            ${isRangeAvailable ? 'AND (R.datetime >= ' + '"' + filters.range.from + '"' + ' AND R.datetime <=' + '"' + filters.range.to + '"' + ')' : ''}
        GROUP BY S.name, S.site_id, DATE_FORMAT(R.datetime, "%Y/%m/%d") ORDER BY MIN(R.datetime) ASC
    `;

    const [rows, fields] = await connection.execute(sql)
    console.log('[exportOccupancyModels]', rows.length)
    return rows
}

async function getCountSitesRecPerDates (projectId, filters) {
    const connection = await mysql.getConnection()
    const isRangeAvailable = filters.range !== undefined
    // PG GROUP BY strictness: S.site_id is selected, so group it too (S.name
    // alone is not a key; groups are unchanged on MySQL — site_id determines name).
    let query = `SELECT S.name as site, S.site_id as site_id, YEAR(R.datetime) as year, MONTH(R.datetime) as month, DAY(R.datetime) as day,COUNT(*) as count
        FROM sites S
        LEFT JOIN recordings R ON S.site_id = R.site_id
        WHERE S.project_id = ${projectId}
            AND S.deleted_at is null
            ${isRangeAvailable ? 'AND (R.datetime >= ' + '"' + filters.range.from + '"' + ' AND R.datetime <= ' + '"' + filters.range.to + '"' + ')' : ''}
        GROUP BY S.name, S.site_id, YEAR(R.datetime), MONTH(R.datetime), DAY(R.datetime);
    `;
    const [rows, fields] = await connection.execute(query)
    return rows
}


module.exports = {
  deleteRecordings,
  exportOccupancyModels,
  getExportRecordingsRow,
  getRecordingByIds,
  getRecordingsForAudioUrls,
  updateExportRecordings,
  getCountSitesRecPerDates
}
