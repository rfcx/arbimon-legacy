// PostgreSQL is the only engine since P7 step 5 (rfcx-local OPEN-ITEMS §320,
// 2026-09-20); jobs/db/mysql.js and the mysql2 driver were removed.
const pg = require('./pg')

async function closeAll () {
  await pg.closeConnection()
}

async function getAllByChunks (func, filters = {}, options = {}, chunkSize = 1000) {
  let items = []
  let step = 0
  while (true) {
    const result = await func(filters, {
      limit: chunkSize,
      offset: step * chunkSize,
      ...options
    })
    if (result.length) {
      items = items.concat(result)
      step++
    } else {
      break
    }
  }
  return items
}

module.exports = {
  closeAll,
  getAllByChunks
}
