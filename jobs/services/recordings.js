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
    console.log('\n\n--------sql------', sql)
    const [rows, fields] = await connection.execute(sql)
    return rows
}

async function getCountConnections (options = {}) {
    const connection = await mysql.getConnection()
    const sql = `SELECT COUNT(*) FROM information_schema.PROCESSLIST`
    const [rows, fields] = await connection.execute(sql)
    return rows
}


module.exports = {
  deleteRecordings,
  getExportRecordingsRow,
  updateExportRecordings,
  getCountConnections
}
