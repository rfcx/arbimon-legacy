// Engine selector for the jobs/ DB facade (mysql2pg — arbimon exports on PG).
//
// jobs/services/* require THIS module. Since P7 step 5 (rfcx-local OPEN-ITEMS
// §320, 2026-09-20) PostgreSQL is the ONLY engine: jobs/db/mysql.js and its
// mysql2 driver are gone. EXPORTS_DB_ENGINE is still READ, as a fail-fast:
//   EXPORTS_DB_ENGINE=pg     -> jobs/db/pg.js
//   EXPORTS_DB_ENGINE=mysql  -> THROWS at require time (the engine no longer exists)
//   (unset)                  -> jobs/db/pg.js (the former `mysql` default is gone;
//                               a workload that never set the flag now runs PG,
//                               and jobs/db/pg.js fails loudly if POSTGRES_* is
//                               absent -- there is nothing silent to fall back to)
//
// ⚠️ THIS IS NOT THE ONLY READER OF EXPORTS_DB_ENGINE. app/utils/dbpool.js also
// reads it, and when it is `pg` that module reroutes ALL app/model/* reads in
// this process to jobs/db/pg.js readQuery() -- so setting this var changes the
// POOL and the CREDENTIAL for code that has nothing to do with jobs/services/*.
// See the block at the top of app/utils/dbpool.js for the measured proof and for
// the probe that answers this correctly (dbpool.query, not dbpool.getConnection).
const ENGINE = (process.env.EXPORTS_DB_ENGINE || 'pg').toLowerCase()

if (ENGINE !== 'pg') {
  throw new Error(
    'jobs/db/backend: EXPORTS_DB_ENGINE=' + ENGINE + ' is not an engine. MariaDB was retired ' +
    '(rfcx-local OPEN-ITEMS §320, P7 step 5); the only backend is jobs/db/pg.js. Unset the ' +
    'variable or set EXPORTS_DB_ENGINE=pg.'
  )
}

module.exports = require('./pg')
module.exports.engine = ENGINE