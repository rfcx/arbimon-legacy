/**
 * REGRESSION GUARD — the cached_metrics write class, two of three post-flip
 * sub-defects (2026-09-12; the third is the `value` int4 -> bigint DDL, which
 * is schema-side and not app-testable here).
 *
 * (2) 22001 `value too long for type character varying(20)` — the cache key is
 *     constructed as `project-<id>-<suffix>` and three suffixes make it 21
 *     chars on 5-digit project ids (`-aed-job`, `-cl-job`, `-soundsc`).
 *     MariaDB silently truncated these on INSERT for years (sql_mode empty),
 *     so the SELECT by the full key never matched and every request was a
 *     cold refresh; PostgreSQL rejects the INSERT and the cold path 500s.
 *     Fix: bound the key to the column width (20) at the single choke point
 *     in getCachedMetrics, which ALSO matches the maria-truncated rows that
 *     already exist, so caching resumes for those keys.
 *
 * (3) `write_unmapped_insert` — the RETURNING shim has no identity-PK entry
 *     for cached_metrics (its PK is a natural varchar key) and logged a
 *     divergence line per insert; no consumer reads insertId from this path
 *     (recalculateMetrics discards the packet), so the line was pure noise
 *     in the P7 divergence stream. Fix: an explicit WRITE_NO_IDENTITY_PK
 *     allowlist suppresses the line for tables whose no-RETURNING shape is
 *     CORRECT; unmapped identity-table inserts stay loud.
 *
 * Two layers, deliberately (same style as cached-metrics-cold-bound.test.js):
 *   (1) source-shape guards — fail on the pre-fix file;
 *   (2) behavioural harnesses with stubbed model / stubbed `pg`.
 *
 * Run standalone: node test/cached-metrics-key-bound.test.js
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
var cmSrc = stripComments(fs.readFileSync(path.join(ROOT, 'app/utils/cached-metrics.js'), 'utf8'));
ok('shape: a CACHE_KEY_MAX_LEN bound exists', /CACHE_KEY_MAX_LEN\s*=\s*20/.test(cmSrc));
ok('shape: getCachedMetrics bounds the constructed key before any DB use',
   /const v = boundCacheKey\(Object\.values\(key\)\[0\]\)/.test(cmSrc));

var shimSrc = stripComments(fs.readFileSync(path.join(ROOT, 'app/utils/dbpool-pg.js'), 'utf8'));
ok('shape: a WRITE_NO_IDENTITY_PK allowlist exists and covers cached_metrics',
   /var WRITE_NO_IDENTITY_PK = \{[\s\S]{0,200}cached_metrics: true/.test(shimSrc));
ok('shape: the write_unmapped_insert emit is gated on the allowlist',
   /!WRITE_NO_IDENTITY_PK\[ins\[1\]\] && divergenceEmitAllowed/.test(shimSrc));

// ------------------------------------------------- (2a) behaviour: key bound
function loadWithStubs(stubs) {
    var origLoad = Module._load;
    Module._load = function (request, parent) {
        if (stubs.hasOwnProperty(request)) { return stubs[request]; }
        return origLoad.apply(this, arguments);
    };
    try {
        var p = path.join(ROOT, 'app/utils/cached-metrics.js');
        delete require.cache[require.resolve(p)];
        return require(p);
    } finally { Module._load = origLoad; }
}
function fakeRes() {
    var out = { sent: undefined };
    out.type = function () { return out; };
    out.json = function (v) { out.sent = v; out.resolve && out.resolve(v); return out; };
    out.done = new Promise(function (r) { out.resolve = r; });
    return out;
}

async function runKeyBound() {
    var seen = { select: [], insert: [], update: [], expiry: [] };
    var model = {
        projects: {
            getCachedMetrics: async function (k) { seen.select.push(k); return []; },
            insertCachedMetrics: async function (o) { seen.insert.push(o); return null; },
            updateCachedMetrics: async function (o) { seen.update.push(o); return null; },
            updateExpirationDate: async function (o) { seen.expiry.push(o); return null; },
            totalRecordings: async function () { return 4364; },
        },
        AudioEventDetectionsClustering: { totalAedJobs: async function () { return 0; } },
    };
    var cm = loadWithStubs({ '../model': model, './dbpool': { query: async function () { return []; } },
                             './dbpool-pg': { isPg: true } });

    // The exact shape that 500'd post-flip: 21-char key, cold row.
    var res = fakeRes();
    cm.getCachedMetrics({}, res, { 'project-aed-job-count': 'project-10005-aed-job' }, 10005,
        function (e) { throw e; });
    await res.done;
    eq('21-char key: SELECT used the 20-char bounded form', seen.select[0], 'project-10005-aed-jo');
    eq('21-char key: INSERT used the 20-char bounded form', seen.insert.length === 1 && seen.insert[0].key,
       'project-10005-aed-jo');
    eq('21-char key: every DB-bound key fits the column', seen.select.concat(seen.insert.map(function (o) { return o.key; }))
        .every(function (k) { return k.length <= 20; }), true);
    eq('21-char key: response served the computed value', res.sent, 0);

    // A short key passes through untouched (no behaviour change for the common case).
    seen = { select: [], insert: [], update: [], expiry: [] };
    res = fakeRes();
    cm.getCachedMetrics({}, res, { 'project-recording-count': 'project-10005-rec' }, 10005,
        function (e) { throw e; });
    await res.done;
    eq('short key: untouched', seen.select[0], 'project-10005-rec');
}

// ------------------------------------------- (2b) behaviour: shim allowlist
var lastQueries = [];
var responder = null;
var fakeClient = {
    query: function (sql, cb) {
        lastQueries.push(sql);
        var r = responder ? responder(sql) : { command: 'INSERT', rowCount: 1, rows: [], fields: [] };
        process.nextTick(function () { cb(r.err || null, r.err ? undefined : r); });
    },
    on: function () {},
    removeListener: function () {}
};
function FakePool() {}
FakePool.prototype.on = function () {};
FakePool.prototype.connect = function (cb) {
    process.nextTick(function () { cb(null, fakeClient, function () {}); });
};
var fakePg = {
    Pool: FakePool,
    types: { setTypeParser: function () {}, getTypeParser: function () { return function (v) { return v; }; } }
};

async function runShim() {
    var origLoad = Module._load;
    Module._load = function (request, parent) {
        if (request === 'pg') { return fakePg; }
        return origLoad.apply(this, arguments);
    };
    process.env.DB_ENGINE = 'pg';
    var shimPath = path.join(ROOT, 'app/utils/dbpool-pg.js');
    delete require.cache[require.resolve(shimPath)];
    var pgshadow = require(shimPath);

    var stdoutLines = [];
    var origWrite = process.stdout.write;
    process.stdout.write = function (s) { stdoutLines.push(String(s)); return true; };

    function runQuery(conn, sql, values) {
        return new Promise(function (resolve, reject) {
            conn.query(sql, values, function (err, rows) { err ? reject(err) : resolve(rows); });
        });
    }
    try {
        var conn = await pgshadow.getWriteConnection();

        // cached_metrics: allowlisted -> no RETURNING, no divergence line.
        lastQueries = []; stdoutLines = [];
        responder = function () { return { command: 'INSERT', rowCount: 1, rows: [], fields: [] }; };
        var packet = await runQuery(conn,
            'INSERT INTO cached_metrics(`key`, value, expires_at) VALUES (?,?,?)',
            ['project-10005-rec', 4364, '2026-09-12 23:00:00']);
        eq('shim cached_metrics: no RETURNING appended', /RETURNING/.test(lastQueries[0]), false);
        eq('shim cached_metrics: insertId 0, affectedRows 1 (discarded by the caller anyway)',
           packet.insertId === 0 && packet.affectedRows === 1, true);
        eq('shim cached_metrics: NO write_unmapped_insert divergence line',
           stdoutLines.some(function (l) { return /write_unmapped_insert/.test(l); }), false);

        // Control 1: a genuinely unmapped table stays LOUD.
        lastQueries = []; stdoutLines = [];
        await runQuery(conn, 'INSERT INTO playlist_recordings(playlist_id, recording_id) VALUES (?, ?)', [9, 1]);
        eq('shim control (playlist_recordings): divergence line still emitted',
           stdoutLines.some(function (l) { return /write_unmapped_insert/.test(l) && /playlist_recordings/.test(l); }), true);

        // Control 2: a mapped identity table still gets RETURNING + insertId.
        lastQueries = []; stdoutLines = [];
        responder = function () {
            return { command: 'INSERT', rowCount: 1, rows: [{ job_id: 424242 }], fields: [{ name: 'job_id' }] };
        };
        packet = await runQuery(conn, 'INSERT INTO `jobs` (`job_type_id`, `project_id`) VALUES (?, ?)', [6, 10005]);
        eq('shim control (jobs): RETURNING still appended', /RETURNING job_id$/.test(lastQueries[0]), true);
        eq('shim control (jobs): insertId still mapped', packet.insertId, 424242);
    } finally {
        process.stdout.write = origWrite;
        Module._load = origLoad;
    }
}

async function run() {
    await runKeyBound();
    await runShim();
    console.log('\n' + (fails ? ('FAILED ' + fails + '/' + n) : ('ALL ' + n + ' PASS')));
    process.exit(fails ? 1 : 0);
}
run().catch(function (e) { console.log('HARNESS ERROR', e); process.exit(2); });
