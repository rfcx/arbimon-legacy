const mysql = require('./mysql')

async function closeAll () {
  await mysql.closeConnection()
}

async function getAllByChunks (func, filters = {}, options = {}, chunkSize = 1000) {
  let items = []
  let step = 0
  while (true) {
    // const result = await query({}, { limit: chunkSize, offset: step * chunkSize })
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
  mysql,
  closeAll,
  getAllByChunks
}
