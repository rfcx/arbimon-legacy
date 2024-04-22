const mysql = require('../db/mysql')

async function getSoundscapes (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select soundscape_id, name, user (first name, last name, email), playlist name, bin bandwidth, aggregation, peak_filtering_amplitude, peak_filtering_frequency
    ;
  `
  const [rows, fields] = await connection.execute(sql)
  return rows
}

module.exports = {
  getSoundscapes
}
