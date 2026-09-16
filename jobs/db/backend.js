// Engine selector for the jobs/ DB facade (mysql2pg — arbimon exports on PG).
//
// jobs/services/* require THIS module instead of ./mysql directly. Selection:
//   EXPORTS_DB_ENGINE=pg     -> jobs/db/pg.js  (PG via the P6 translator)
//   EXPORTS_DB_ENGINE=mysql  -> jobs/db/mysql.js (legacy, unchanged)
//   (unset)                  -> mysql            (ships inert / rollback-safe)
//
// The cron CronJob keeps running on mysql until the queue cutover; the
// export-consumer worker Deployment sets EXPORTS_DB_ENGINE=pg.
//
// ⚠️ THIS IS NOT THE ONLY READER OF EXPORTS_DB_ENGINE. app/utils/dbpool.js also
// reads it, and when it is `pg` that module reroutes ALL app/model/* reads in
// this process to jobs/db/pg.js readQuery() -- so setting this var changes the
// engine AND the credential for code that has nothing to do with jobs/services/*.
// See the block at the top of app/utils/dbpool.js for the measured proof and for
// the probe that answers this correctly (dbpool.query, not dbpool.getConnection).
const ENGINE = (process.env.EXPORTS_DB_ENGINE || 'mysql').toLowerCase()

module.exports = ENGINE === 'pg' ? require('./pg') : require('./mysql')
module.exports.engine = ENGINE