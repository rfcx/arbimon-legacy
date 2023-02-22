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

async function getExportRecordingsRow (options = {}) {
    const connection = await mysql.getConnection()
    const sql = `SELECT * FROM recordings_export_parameters
                 WHERE ${options.where}
                 ORDER BY ${options.orderBy}
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
    return rows
}

module.exports = {
  deleteRecordings,
  getExportRecordingsRow,
  updateExportRecordings
}
