const mysql = require('../db/mysql')

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

async function getExportRecordingsRow (options = {}) {
    const connection = await mysql.getConnection()
    const sql = `SELECT rep.*, p.name FROM recordings_export_parameters rep
                 JOIN projects p ON p.project_id = rep.project_id
                 WHERE rep.created_at < '${options.dateByCondition}' AND rep.processed_at is null AND error is null
                 ORDER BY rep.created_at ASC
                 LIMIT ${options.limit}`
    const [rows, fields] = await connection.execute(sql)
    return rows
}

async function updateExportRecordings (options, attrs) {
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

async function getCountConnections (options = {}) {
    const connection = await mysql.getConnection()
    const sql = `SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE state IS NOT NULL`
    const [rows, fields] = await connection.execute(sql)
    return rows
}

async function exportOccupancyModels (specie, filters) {
    const connection = await mysql.getConnection()
    const isRangeAvailable = filters.range !== undefined
    let sql = `SELECT S.name as site, S.site_id as siteId, DATE_FORMAT(R.datetime, "%Y/%m/%d") as date, SUM(rv.present=1 OR rv.present_review>0 OR rv.present_aed>0) as count
        FROM recordings R
        JOIN sites S ON S.site_id = R.site_id
        LEFT JOIN project_imported_sites AS pis ON S.site_id = pis.site_id AND pis.project_id = ${filters.project_id}
        LEFT JOIN recording_validations AS rv ON R.recording_id = rv.recording_id
        WHERE rv.species_id = ${specie}
            AND (S.project_id = ${filters.project_id} OR pis.project_id = ${filters.project_id})
            AND (rv.present_review>0 OR rv.present_aed>0 OR rv.present is not null)
            ${isRangeAvailable ? 'AND (R.datetime >= ' + '"' + filters.range.from + '"' + ' AND R.datetime <=' + '"' + filters.range.to + '"' + ')' : ''}
        GROUP BY S.name, YEAR(R.datetime), MONTH(R.datetime), DAY(R.datetime) ORDER BY R.datetime ASC
    `;

    const [rows, fields] = await connection.execute(sql)
    console.log('[exportOccupancyModels]', rows.length)
    return rows
}

async function getCountSitesRecPerDates (projectId, filters) {
    const connection = await mysql.getConnection()
    const isRangeAvailable = filters.range !== undefined
    let query = `SELECT S.name as site, S.site_id as siteId, YEAR(R.datetime) as year, MONTH(R.datetime) as month, DAY(R.datetime) as day,COUNT(*) as count
        FROM sites S
        LEFT JOIN recordings R ON S.site_id = R.site_id
        WHERE S.project_id = ${projectId}
            AND S.deleted_at is null
            ${isRangeAvailable ? 'AND (R.datetime >= ' + '"' + filters.range.from + '"' + ' AND R.datetime <= ' + '"' + filters.range.to + '"' + ')' : ''}
        GROUP BY S.name, YEAR(R.datetime), MONTH(R.datetime), DAY(R.datetime);
    `;
    const [rows, fields] = await connection.execute(query)
    return rows
}


module.exports = {
  deleteRecordings,
  exportOccupancyModels,
  getExportRecordingsRow,
  getRecordingByIds,
  updateExportRecordings,
  getCountConnections,
  getCountSitesRecPerDates
}
