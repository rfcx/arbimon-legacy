// Engine selector for the jobs/ DB facade (mysql2pg — arbimon exports on PG).
//
// jobs/services/* require THIS module instead of ./mysql directly. Selection:
//   EXPORTS_DB_ENGINE=pg     -> jobs/db/pg.js  (PG via the P6 translator)
//   EXPORTS_DB_ENGINE=mysql  -> jobs/db/mysql.js (legacy, unchanged)
//   (unset)                  -> mysql            (ships inert / rollback-safe)
//
// The cron CronJob keeps running on mysql until the queue cutover; the
// export-consumer worker Deployment sets EXPORTS_DB_ENGINE=pg.
const ENGINE = (process.env.EXPORTS_DB_ENGINE || 'mysql').toLowerCase()

module.exports = ENGINE === 'pg' ? require('./pg') : require('./mysql')
module.exports.engine = ENGINE