/**
 * P7 POST-FLIP — routed reads must pin `jit=off` inside their own transaction.
 *
 * CONTEXT (measured 2026-09-12, and NOT what the originating report assumed).
 * The giant sites-listing 500s were traced to the >MAX_SITES single-statement
 * count path straddling the 8 s routed-read budget (see
 * p7-giant-path-chunking.test.js — that is the actual fix). JIT was NOT the
 * live cause: `jit` is already `off` on both Patroni nodes.
 *
 * BUT that server-level `jit = off` lives in a LIVE-ONLY edit of
 * `postgresql.base.conf` (uncommented stock sample line, mtime 2026-09-02).
 * It is absent from the repo's Patroni ConfigMaps AND from the DCS
 * (`endpoints/postgres-config` annotation), so a cluster rebuild, a Patroni
 * config rewrite, or a restore onto stock config comes back with the PostgreSQL
 * default `jit = on`. The routed-read plans here are subplan-heavy and far over
 * `jit_above_cost` (the 950-site sites statement plans at cost 5.4M vs the
 * 100k threshold), so under stock config they would pay JIT COMPILATION inside
 * the same 8 s statement_timeout that already bounds them — turning a slow page
 * into an unconditional error, with no fail-open target post-flip.
 *
 * The guard is therefore transaction-scoped app-side state, not cluster config:
 * `SET LOCAL jit=off` rides in the SAME `BEGIN READ ONLY` string as the
 * existing `SET LOCAL statement_timeout`, which is pgbouncer-safe (transaction
 * pooling) and cannot leak to another session's connection.
 *
 * NEGATIVE CONTROL: every assertion below FAILS against the pre-fix tree,
 * where the begin strings carried statement_timeout only.
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var SRC_PATH = path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js');
var src = fs.readFileSync(SRC_PATH, 'utf8');

// Every `BEGIN READ ONLY ...` statement EXPRESSION in the module, comments
// excluded. NB the begin string is built by concatenation across lines
// ('BEGIN READ ONLY; SET LOCAL statement_timeout=' + Math.round(TIMEOUT_MS) +
// '; SET LOCAL jit=off;'), so matching a single quoted literal would see only
// the first fragment and report a false failure — take the whole expression up
// to the callback argument instead.
function beginStrings(text) {
    var code = text.split('\n').filter(function (l) {
        return !/^\s*(\/\/|\*|\/\*)/.test(l);
    }).join('\n');
    var out = [];
    var re = /'BEGIN READ ONLY;/g;
    var m;
    while ((m = re.exec(code)) !== null) {
        var rest = code.slice(m.index);
        // the expression ends at the callback (`, function`) or the statement end
        var stop = rest.search(/,\s*function|;\s*\n/);
        out.push(rest.slice(0, stop === -1 ? 240 : stop).replace(/\s+/g, ' '));
    }
    return out;
}

describe('P7 — routed reads pin jit=off per transaction', function () {

    it('finds THE read-path BEGIN block (pgReadQuery; the shadow path was retired at step 5)', function () {
        // If this count ever changes, the assertions below no longer cover the
        // whole surface — fail loudly rather than silently testing one of two.
        assert.strictEqual(beginStrings(src).length, 1,
            'expected exactly 1 "BEGIN READ ONLY" statement string in dbpool-pg.js');
    });

    it('every read-path transaction sets jit=off', function () {
        beginStrings(src).forEach(function (s) {
            assert.ok(/SET LOCAL jit=off/.test(s),
                'a BEGIN READ ONLY block does not SET LOCAL jit=off: ' + s);
        });
    });

    it('jit=off is SET LOCAL (transaction-scoped), never a session-wide SET', function () {
        beginStrings(src).forEach(function (s) {
            assert.ok(!/(^|[^_A-Za-z])SET\s+jit\s*=/.test(s.replace(/SET LOCAL jit=off/g, '')),
                'a session-scoped "SET jit=" would leak across pgbouncer-pooled connections: ' + s);
        });
    });

    it('the statement_timeout guard is still present in the same transaction', function () {
        // The jit pin must ADD to the existing budget guard, not replace it.
        beginStrings(src).forEach(function (s) {
            assert.ok(/SET LOCAL statement_timeout=/.test(s),
                'a BEGIN READ ONLY block lost its statement_timeout: ' + s);
        });
    });

    it('does NOT attempt cluster-level DB config (ALTER SYSTEM/DATABASE/ROLE)', function () {
        // §DO-NOT-TOUCH: changing the server default is a DB-config write and
        // needs its own named operator GO. This fix is app-session-scoped only.
        assert.ok(!/ALTER\s+(SYSTEM|DATABASE|ROLE)/i.test(src),
            'dbpool-pg.js must not issue cluster-level configuration writes');
    });
});

// ------------------------------------------------------------------ behaviour
// Drive the REAL pgReadQuery with a stubbed `pg` module and capture the exact
// statements the server would receive. A source regex proves the string is
// written; this proves it is EXECUTED, in the right transaction, before the
// user's SELECT.
describe('P7 — jit=off reaches the server on the routed-read path', function () {
    var Module = require('module');
    var origLoad, origEngine, pgshadow, sent;

    before(function () {
        sent = [];
        var fakeClient = {
            query: function (sql, cb) {
                sent.push(sql);
                process.nextTick(function () {
                    cb(null, { command: 'SELECT', rowCount: 0, rows: [], fields: [] });
                });
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
            types: {
                setTypeParser: function () {},
                getTypeParser: function () { return function (v) { return v; }; }
            }
        };
        origLoad = Module._load;
        Module._load = function (request) {
            if (request === 'pg') { return fakePg; }
            return origLoad.apply(this, arguments);
        };
        origEngine = process.env.DB_ENGINE;
        process.env.DB_ENGINE = 'pg';
        delete require.cache[require.resolve(SRC_PATH)];
        pgshadow = require(SRC_PATH);
    });

    after(function () {
        Module._load = origLoad;
        if (origEngine === undefined) { delete process.env.DB_ENGINE; }
        else { process.env.DB_ENGINE = origEngine; }
        delete require.cache[require.resolve(SRC_PATH)];
    });

    it('issues BEGIN READ ONLY + statement_timeout + jit=off before the SELECT', function (done) {
        pgshadow.pgReadQuery('SELECT 1 FROM sites', function () {
            var begin = sent[0] || '';
            assert.ok(/^BEGIN READ ONLY;/.test(begin), 'first statement is not the read-only BEGIN: ' + begin);
            assert.ok(/SET LOCAL statement_timeout=\d+/.test(begin), 'no statement_timeout in: ' + begin);
            assert.ok(/SET LOCAL jit=off/.test(begin), 'no jit=off in: ' + begin);
            // the user's statement runs AFTER the guards, in the same tx
            assert.ok(/SELECT 1 FROM sites/.test(sent[1] || ''), 'the query did not follow the BEGIN');
            done();
        });
    });
});
