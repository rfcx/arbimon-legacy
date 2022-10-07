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

module.exports = {
  deleteRecordings
}
