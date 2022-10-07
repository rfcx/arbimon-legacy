const mysql = require('mysql2/promise')
const { MYSQL_HOSTNAME, MYSQL_NAME, MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_PORT } = process.env
let connection;

async function getConnection () {
  if (!connection) {
    connection = await mysql.createConnection({
      host: MYSQL_HOSTNAME,
      port: MYSQL_PORT,
      database: MYSQL_NAME,
      user: MYSQL_USERNAME,
      password: MYSQL_PASSWORD,
      dateStrings: true
    });
  }
  return connection
}

async function closeConnection () {
  if (connection) {
    await connection.end()
  }
}

module.exports = {
  getConnection,
  closeConnection
}
