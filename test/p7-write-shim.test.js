/**
 * P7 GATE 4c — write-path conn adapter + RETURNING shim + ported-site shape guards.
 * (OPQ-4 (a) HYBRID; design: rfcx-local runbooks/DESIGN-2026-09-11-p7-write-rehearsal.md)
 *
 * Two layers, deliberately (same style as cached-metrics-cold-bound.test.js):
 *   (1) source-shape guards over the ported model files — fail on pre-port
 *       source even where the behavioural harness cannot run;
 *   (2) a behavioural harness: the REAL app/utils/dbpool-pg.js loaded with a
 *       stubbed `pg` module, DB_ENGINE=pg, exercising the adapter end to end
 *       without a database.
 *
 * Run standalone: node test/p7-write-shim.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var Module = require('module');

var ROOT = path.join(__dirname, '..');
var n = 0, fails = 0;
function ok(name, cond) {
    n++;
    if (cond) { console.log('ok   ' + name); }
    else { fails++; console.log('FAIL ' + name); }
}
function eq(name, a, b) {
    n++;
    try { assert.deepStrictEqual(a, b); console.log('ok   ' + name); }
    catch (e) { fails++; console.log('FAIL ' + name + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
}
function stripComments(src) {
    return src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n');
}

// ---------------------------------------------------------------- (1) shape
var ports = {
    'app/model/projects.js': [
        ['PG branch for INSERT INTO projects (port #18) incl. the negative-control flag', /pgshadow\.isPg\s*&&\s*!process\.env\.DB_PG_DISABLE_PORT_PROJECTS/],
        ['explicit (cols) VALUES for user_project_role', /INSERT INTO user_project_role \(user_id, project_id, role_id\) VALUES \(\?, \?, \?\)/],
        ['alias-qualified SET ported (cached_metrics)', /SET expires_at = '\$\{opts\.expiresAt\}'/],
        ['multi-table UPDATE ported to UPDATE ... FROM', /UPDATE recording_validations rv\s*\n\s*SET project_id = \$\{newProjectId\}\s*\n\s*FROM recordings r/]
    ],
    'app/model/sites.js': [
        ['SET %s list ported to (cols) VALUES (port #19)', /'INSERT INTO sites \\n'\s*\+\s*\n?\s*'\(' \+ pairs\.map/]
    ],
    'app/model/users.js': [
        ['SET %s list ported to (cols) VALUES (port #20)', /'INSERT INTO users \\n'\s*\+\s*\n?\s*'\(' \+ pairs\.map/]
    ],
    'app/model/templates.js': [
        ['FROM DUAL dropped in the PG branch (port #21)', /NOW\(\), \?, \?\\n"\s*\+\s*\n\s*"WHERE NOT EXISTS/],
        ['PG branch carries explicit RETURNING template_id', /RETURNING template_id/],
        ['PG_INSERT_NO_ROW is converted to a defined error', /err\.code === 'PG_INSERT_NO_ROW'/]
    ],
    'app/model/tags.js': [
        ['INSERT IGNORE ported to ON CONFLICT DO NOTHING (port #22)', /INSERT INTO tags\(tag\) VALUES \(\?\) ON CONFLICT DO NOTHING RETURNING tag_id/],
        ['the swallowing catch is NARROWED to PG_INSERT_NO_ROW', /if \(!err \|\| err\.code !== 'PG_INSERT_NO_ROW'\) \{ throw err; \}/],
        ['LAST_INSERT_ID ported to ON CONFLICT ... RETURNING (port #23)', /ON CONFLICT \(recording_id, tag_id, user_id\) DO UPDATE SET recording_tag_id = recording_tags\.recording_tag_id RETURNING recording_tag_id/]
    ],
    'app/model/playlists.js': [
        ['dup-key branch via sqlutil.isDuplicateKeyError', /if \(!sqlutil\.isDuplicateKeyError\(err\)\) \{\s*\n\s*throw err;/],
        ['MAX_EXECUTION_TIME hint gated off PG', /pgshadow\.isPg \? '' : '\/\*\+ MAX_EXECUTION_TIME\(360000\) \*\/ '/]
    ],
    'app/model/soundscape-composition.js': [
        ['dup-key branch via sqlutil.isDuplicateKeyError', /if\(sqlutil\.isDuplicateKeyError\(err\)\)\{\s*\n\s*throw new APIError\("Soundscape composition class already in project\."\);/],
        ['ON DUPLICATE KEY ported to ON CONFLICT (present)', /ON CONFLICT \(recordingId, scclassId\) DO UPDATE SET present = EXCLUDED\.present/]
    ],
    'app/model/soundscapes.js': [
        ['INSERT IGNORE ported to ON CONFLICT DO NOTHING', /ON CONFLICT \(playlist_id, recording_id\) DO NOTHING/]
    ],
    'app/model/recordings.js': [
        ['present_review increment ported (ON CONFLICT + self-reference)', /ON CONFLICT \(recording_id, species_id, songtype_id\) DO UPDATE SET present_review = recording_validations\.present_review \+ 1/],
        ['present upsert ported (EXCLUDED)', /ON CONFLICT \(recording_id, species_id, songtype_id\) DO UPDATE SET present = EXCLUDED\.present/],
        ['MAX_EXECUTION_TIME 840000 hint gated off PG', /pgshadow\.isPg \? 'SELECT' : 'SELECT \/\*\+ MAX_EXECUTION_TIME\(840000\) \*\/'/]
    ],
    'app/model/citizen-scientist.js': [
        ['pm validations upsert ported', /ON CONFLICT \(pattern_matching_roi_id, user_id\) DO UPDATE SET/],
        ['user statistics upsert ported', /ON CONFLICT \(user_id, project_id, species_id, songtype_id\) DO UPDATE SET validated=EXCLUDED\.validated/]
    ],
    'app/utils/dbpool.js': [
        ['getConnection routes to the PG adapter when isPg', /if \(pgshadow\.isPg\) \{\s*\n\s*return pgshadow\.getWriteConnection\(callback\);/],
        ['read fallback uses the explicitly-MySQL connection', /dbpool\.getMysqlConnection\(function \(err, connection\) \{\s*\n\s*if \(err\) \{ return callback\(err\); \}/]
    ],
    'app/utils/dbpool-pg.js': [
        ['WRITE_IDENTITY_PK map present', /var WRITE_IDENTITY_PK = \{/],
        ['no-row INSERT throws PG_INSERT_NO_ROW', /ne\.code = 'PG_INSERT_NO_ROW'/],
        ['release rolls back + destroys a leaked transaction', /pg_write_tx_leak/],
        ['write dialect errors book into the dialect_error gate metric', /_counters\.dialect_error\+\+; _counters\.write_error\+\+/]
    ]
};
Object.keys(ports).forEach(function (file) {
    var src = stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    ports[file].forEach(function (pair) {
        ok('shape ' + file + ': ' + pair[0], pair[1].test(src));
    });
});

// ---------------------------------------------------------------- (2) behaviour
// Stub `pg` before dbpool-pg lazily requires it; drive the REAL adapter.
var lastQueries = [];       // every statement the fake client received
var responder = null;       // function(sql) -> {err}|{command,rowCount,rows,fields}
var destroyedWith = null;   // error passed to done(err) on client destroy
var releasedClean = 0;
var fakeClient = {
    query: function (sql, cb) {
        lastQueries.push(sql);
        var r = responder ? responder(sql) : { command: 'SELECT', rowCount: 0, rows: [], fields: [] };
        process.nextTick(function () { cb(r.err || null, r.err ? undefined : r); });
    },
    on: function () {},
    removeListener: function () {}
};
function FakePool() {}
FakePool.prototype.on = function () {};
FakePool.prototype.connect = function (cb) {
    process.nextTick(function () {
        cb(null, fakeClient, function (err) {
            if (err) { destroyedWith = err; } else { releasedClean++; }
        });
    });
};
var fakePg = {
    Pool: FakePool,
    types: { setTypeParser: function () {}, getTypeParser: function () { return function (v) { return v; }; } }
};

var origLoad = Module._load;
Module._load = function (request, parent) {
    if (request === 'pg') { return fakePg; }
    return origLoad.apply(this, arguments);
};

process.env.DB_ENGINE = 'pg';
var dbpoolPgPath = path.join(ROOT, 'app/utils/dbpool-pg.js');
delete require.cache[require.resolve(dbpoolPgPath)];
var pgshadow = require(dbpoolPgPath);
// NB: Module._load stays patched for the WHOLE test — dbpool-pg requires 'pg'
// LAZILY (inside getPool, per its inert-mode contract), i.e. after this line.

function runQuery(conn, sql, values) {
    return new Promise(function (resolve, reject) {
        var cb = function (err, rows, fields) { err ? reject(err) : resolve({ rows: rows, fields: fields }); };
        if (values === undefined) { conn.query(sql, cb); } else { conn.query(sql, values, cb); }
    });
}

async function run() {
    ok('isPg is true under DB_ENGINE=pg', pgshadow.isPg === true);

    // -- mapped INSERT: shim appends RETURNING, insertId mapped back
    responder = function (sql) {
        if (/^INSERT INTO jobs/.test(sql)) {
            return { command: 'INSERT', rowCount: 1, rows: [{ job_id: 424242 }], fields: [{ name: 'job_id' }] };
        }
        return { command: 'SELECT', rowCount: 0, rows: [], fields: [] };
    };
    var conn = await pgshadow.getWriteConnection();
    var r = await runQuery(conn, 'INSERT INTO `jobs` (`job_type_id`, `project_id`) VALUES (?, ?)', [6, 10005]);
    eq('shim: INSERT into mapped table got RETURNING appended (translate strips backticks to bare idents)',
       /INSERT INTO jobs \(job_type_id, project_id\) VALUES \(6, 10005\) RETURNING job_id$/.test(lastQueries[0]), true);
    eq('shim: insertId mapped from RETURNING row', r.rows.insertId, 424242);
    eq('shim: affectedRows from rowCount', r.rows.affectedRows, 1);

    // -- port-written RETURNING (ON CONFLICT) is mapped too, never doubled
    lastQueries = [];
    responder = function () {
        return { command: 'INSERT', rowCount: 1, rows: [{ recording_tag_id: 777 }], fields: [{ name: 'recording_tag_id' }] };
    };
    r = await runQuery(conn,
        'INSERT INTO recording_tags(recording_id, tag_id, user_id) VALUES (?, ?, ?) ' +
        'ON CONFLICT (recording_id, tag_id, user_id) DO UPDATE SET recording_tag_id = recording_tags.recording_tag_id RETURNING recording_tag_id',
        [1, 2, 3]);
    eq('port RETURNING: not doubled', (lastQueries[0].match(/RETURNING/g) || []).length, 1);
    eq('port RETURNING: insertId mapped', r.rows.insertId, 777);

    // -- unmapped INSERT: no RETURNING, affectedRows only
    lastQueries = [];
    responder = function () { return { command: 'INSERT', rowCount: 5, rows: [], fields: [] }; };
    r = await runQuery(conn, 'INSERT INTO playlist_recordings(playlist_id, recording_id) VALUES (?, ?), (?, ?)', [9, 1, 9, 2]);
    eq('unmapped INSERT: no RETURNING appended', /RETURNING/.test(lastQueries[0]), false);
    eq('unmapped INSERT: affectedRows from rowCount', r.rows.affectedRows, 5);
    eq('unmapped INSERT: insertId stays 0', r.rows.insertId, 0);

    // -- no-row INSERT with RETURNING must THROW PG_INSERT_NO_ROW
    responder = function () { return { command: 'INSERT', rowCount: 0, rows: [], fields: [{ name: 'template_id' }] }; };
    var threw = null;
    try {
        await runQuery(conn, 'INSERT INTO `templates` (`name`) VALUES (?) RETURNING template_id', ['x']);
    } catch (e) { threw = e; }
    eq('no-row INSERT throws', threw && threw.code, 'PG_INSERT_NO_ROW');

    // -- UPDATE/DELETE shape
    responder = function () { return { command: 'UPDATE', rowCount: 3, rows: [], fields: [] }; };
    r = await runQuery(conn, 'UPDATE `playlists` SET `status` = ? WHERE `playlist_id` = ?', [1, 63834]);
    eq('UPDATE: affectedRows', r.rows.affectedRows, 3);
    eq('UPDATE: changedRows mirrors affectedRows', r.rows.changedRows, 3);

    // -- SELECT shape
    responder = function () { return { command: 'SELECT', rowCount: 2, rows: [{ a: 1 }, { a: 2 }], fields: [{ name: 'a' }] }; };
    r = await runQuery(conn, 'SELECT * FROM `tags` WHERE `tag_id` = ?', [5]);
    eq('SELECT: rows array', r.rows.length, 2);

    // -- translation is applied on the write path (backticks stripped)
    ok('translate: backticks stripped', lastQueries[lastQueries.length - 1].indexOf('`') === -1 &&
       lastQueries[lastQueries.length - 1].indexOf('FROM tags') !== -1);

    // -- tx verbs + txOpen tracking; release with an open tx rolls back + destroys
    responder = function (sql) {
        if (/^(BEGIN|START TRANSACTION)/.test(sql)) { return { command: 'BEGIN', rowCount: 0, rows: [], fields: [] }; }
        if (/^(COMMIT|ROLLBACK)/.test(sql)) { return { command: sql.slice(0, 1) === 'C' ? 'COMMIT' : 'ROLLBACK', rowCount: 0, rows: [], fields: [] }; }
        return { command: 'SELECT', rowCount: 0, rows: [], fields: [] };
    };
    await new Promise(function (res, rej) { conn.beginTransaction(function (e) { e ? rej(e) : res(); }); });
    ok('beginTransaction issued BEGIN', lastQueries.indexOf('BEGIN') !== -1);
    conn.release();
    await new Promise(function (res) { setImmediate(res); }); // ROLLBACK + done() land on the next tick
    ok('release with open tx issued ROLLBACK', lastQueries.indexOf('ROLLBACK') !== -1);
    ok('release with open tx DESTROYED the client (done(err))', destroyedWith !== null);
    eq('release with open tx: no clean release', releasedClean, 0);

    // -- clean release
    var conn2 = await pgshadow.getWriteConnection();
    await new Promise(function (res, rej) { conn2.beginTransaction(function (e) { e ? rej(e) : res(); }); });
    await new Promise(function (res, rej) { conn2.commit(function (e) { e ? rej(e) : res(); }); });
    conn2.release();
    eq('clean release after commit', releasedClean, 1);

    // -- promisedQuery resolves rows (get(0) shape)
    responder = function () { return { command: 'SELECT', rowCount: 1, rows: [{ tag_id: 55 }], fields: [{ name: 'tag_id' }] }; };
    var conn3 = await pgshadow.getWriteConnection();
    var rows = await conn3.promisedQuery('SELECT tag_id FROM tags WHERE tag = ?', ['x']);
    eq('promisedQuery resolves the rows arg', rows.length, 1);
    conn3.release();

    // -- PG dialect error surfaces with its SQLSTATE (never translated away)
    responder = function () { var e = new Error('syntax error at or near "SET"'); e.code = '42601'; return { err: e }; };
    var conn4 = await pgshadow.getWriteConnection();
    var errOut = null;
    try { await runQuery(conn4, "INSERT INTO projects SET `name`='x'"); } catch (e) { errOut = e; }
    eq('dialect error (the negative-control shape) surfaces with code 42601', errOut && errOut.code, '42601');
    conn4.release();

    // -- counters: the gate metric saw everything
    ok('counters: write_routed > 0', pgshadow._counters.write_routed > 0);
    ok('counters: write_ok > 0', pgshadow._counters.write_ok > 0);
    ok('counters: write_error > 0 (the deliberate 42601 + no-row)', pgshadow._counters.write_error >= 2);
    ok('counters: dialect_error folded the write failure', pgshadow._counters.dialect_error >= 1);

    // -- stream shim (no-cb query form): fields + rows + end, buffered
    var conn5 = await pgshadow.getWriteConnection();
    responder = function () { return { command: 'SELECT', rowCount: 2, rows: [{ a: 1 }, { a: 2 }], fields: [{ name: 'a' }] }; };
    var streamed = await new Promise(function (resolve, reject) {
        var rs = conn5.query('SELECT * FROM tags').stream({ highWaterMark: 5 });
        var got = [];
        rs.on('fields', function () { got.push('fields'); });
        rs.on('data', function (row) { got.push(row); });
        rs.on('end', function () { resolve(got); });
        rs.on('error', reject);
    });
    eq('stream shim: fields then 2 rows', streamed.length, 3);
    eq('stream shim: row payload', streamed[1], { a: 1 });
    conn5.release();

    console.log('\n' + (fails ? ('FAILURES: ' + fails + ' / ' + n) : ('ALL ' + n + ' PASSING')));
    process.exit(fails ? 1 : 0);
}

run().catch(function (e) { console.error('HARNESS ERROR', e); process.exit(2); });
