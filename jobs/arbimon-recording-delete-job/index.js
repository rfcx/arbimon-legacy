require('dotenv').config()
const db = require('../db')
const moment = require('moment')
const { deleteRecordings } = require('../services/recordings')
const { reportStats } = require('../services/stats')

async function main () {
  try {
    console.log('arbimon-recording-delete job started')
  
    const dateByCondition = moment.utc().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss')
    const where = `deleted_at < '${dateByCondition}'`
    const limit = 10000
    let toProcess = true
    let countOfDeletedRows = 0

    while (toProcess === true) {
      // Delete recordings
     const result =  await deleteRecordings({
        where,
        orderBy: 'deleted_at ASC',
        limit
     })
     toProcess = result.affectedRows > 0
     countOfDeletedRows += result.affectedRows
    }
    await db.closeAll()

    // Send report to the slack arbimon-dev
    await reportStats(countOfDeletedRows)
    console.log('arbimon-recording-delete job finished')
  } catch (e) {
    console.error(e)
    await db.closeAll()
  }
}

main()
