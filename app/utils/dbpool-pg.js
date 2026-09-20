'use strict';
/**
 * DBPOOL-PG — the PostgreSQL adapter for arbimon-legacy (mysql2pg,
 * rfcx-local OPEN-ITEMS #40). PostgreSQL is the ONLY engine since P7 step 5
 * (2026-09-20, §320); the migration is complete.
 *
 * What this file is NOW:
 *   - the MySQL->PG SQL translator (translate()) + the allowlist read
 *     classifier (classify()), used to route plain reads and every
 *     conn-scoped statement;
 *   - the routed-read executor (pgReadQuery): one READ ONLY transaction per
 *     read, statement_timeout + jit=off scoped per tx, MySQL-shaped rows
 *     restored (column case);
 *   - the write-path connection adapter (getWriteConnection): a checked-out
 *     node-pg client wrapped to the mysql driver's surface, with the
 *     RETURNING shim for insertId;
 *   - the PG pool (pgConf / getPool).
 *
 * HISTORY (kept because the env names and log prefixes still carry it): this
 * file began life as a `DB_ENGINE=mysql|shadow|pg` triple-mode module whose
 * `shadow` mode replayed MariaDB reads against PG and diffed them
 * (DBPOOL_SHADOW_DIVERGENCE). The comparator, the shadow engine modes, the
 * shadow-only env (DB_SHADOW_SAMPLE / DB_SHADOW_MAX_INFLIGHT /
 * DB_SHADOW_MAX_DIFF_ROWS / DB_SHADOW_EMIT_*), and the normalizer were
 * retired at P7 step 5 — their purpose (validate the translator before the
 * flip) is discharged. The DBPOOL_SHADOW_STAT counter heartbeat is KEPT (it
 * is the route path's only in-process instrument: routed / routed_ok /
 * fallback / pg_error / pg_timeout / dialect_error / write_*).
 *
 * Controls (env):
 *   PG_SHADOW_HOST / PG_SHADOW_PORT / PG_SHADOW_USER / PG_SHADOW_PASSWORD /
 *   PG_SHADOW_DATABASE                 PG target (defaults below). The
 *                                        PG_SHADOW_* names are historical
 *                                        (the flip-era credential); they are
 *                                        the LIVE write identity.
 *   DB_PG_STATEMENT_TIMEOUT_MS=8000    per-statement statement_timeout on
 *                                      every routed read (was
 *                                      DB_SHADOW_TIMEOUT_MS — the old name
 *                                      is honored as a fallback for one
 *                                      release).
 *   DB_PG_POOL_MAX=20                  pool size for the route/write pool.
 *
 * The translator handles the measured hot spots; anything it does not yet
 * cover surfaces as a `dialect_error` stat/divergence line.
 */

var crypto = require('crypto');

// -------------------------------------------------------------- config

// P7 step 5 (2026-09-20): the DB_ENGINE tri-state is gone. This module IS the
// database layer; there is no inert or shadow mode to select. DB_ENGINE is
// still READ (once, here) purely to fail loudly on a value that says the
// process was configured for a shape the code no longer provides:
var DB_ENGINE_ENV = (process.env.DB_ENGINE || 'pg').toLowerCase();
if (DB_ENGINE_ENV !== 'pg') {
    throw new Error(
        'dbpool-pg: DB_ENGINE=' + DB_ENGINE_ENV + ' is not an engine. MariaDB was retired ' +
        '(rfcx-local OPEN-ITEMS §320, P7 step 5); PostgreSQL is the only engine. ' +
        'Unset DB_ENGINE or set DB_ENGINE=pg.'
    );
}

function numEnv(name, def) {
    var v = parseFloat(process.env[name]);
    return isNaN(v) ? def : v;
}

// 6.4 (2026-09-08): the pool serves real user reads, and sizing it off the
// (retired) shadow in-flight cap was found on the 09-07 flip to queue the 7th
// concurrent routed read behind a 5 s connect timeout. Default 20 (pgbouncer
// transaction-pools behind it; arbimon_ro measured 17 conns fleet-wide during
// the 09-08 hold).
var PG_POOL_MAX = numEnv('DB_PG_POOL_MAX', 20);
// P7 step 5: DB_SHADOW_TIMEOUT_MS was NEVER a shadow knob in pg mode — it is
// the statement_timeout on EVERY routed read. Renamed to what it is; the old
// name is honored as a fallback for one release so the rfcx-local env edit
// cannot silently change the live timeout.
var TIMEOUT_MS = numEnv('DB_PG_STATEMENT_TIMEOUT_MS', numEnv('DB_SHADOW_TIMEOUT_MS', 8000));
var DIV_PREFIX = 'DBPOOL_SHADOW_DIVERGENCE ';
var STAT_PREFIX = 'DBPOOL_SHADOW_STAT ';

// 2026-09-16: FAIL LOUDLY instead of silently selecting a read-only role.
//
// WHY. The `|| 'arbimon_ro'` default below would be a trap: this pool serves
// the REQUEST path, which WRITES (the cached_metrics refresh). A deployment
// that forgets PG_SHADOW_USER connects read-only and every write fails
// `42501 permission denied` -- silently, because the refresh is fire-and-
// forget. Measured: 149 such errors in one 6 h bucket on flip day 2026-09-12
// (cached_metrics 124, audio_event_detections_clustering 22, jobs 3), and the
// same window produced a user-visible rename bug when a PG write rolled back
// (card 20260912-phase1-db-cutover-005). Nothing alerted; it was found days
// later by a log census.
//
// SCOPE, deliberately narrow -- this must NOT become a module-load crash:
//   * The check runs at the top of getPool(), LAZILY at first pool use, not at
//     require() time -- and OUTSIDE getPool()'s try/catch, because that catch
//     turns any init failure into a `pool_init_failed` stat + null return,
//     i.e. the same silent degradation we are removing.
//   * WHY THAT MATTERS: jobs/db/pg.js requires this module for translate()
//     ONLY -- and the arbimon-export-consumer runs with PG_SHADOW_USER UNSET
//     and never reaches getPool() (its reads go through jobs/db/pg.js's own
//     pool). A module-level throw would crash a workload that is correctly
//     inert. 12 app/model/* files import this module the same way.
function assertPgUserConfigured() {
    if (process.env.PG_SHADOW_USER) { return; }
    throw new Error(
        'dbpool-pg: the request-path pool requires PG_SHADOW_USER. Refusing to fall back to ' +
        "the read-only 'arbimon_ro' role: this pool serves the request path, " +
        'which writes, and a read-only connection fails 42501 silently on every write ' +
        '(see the 2026-09-12 flip-day window).'
    );
}

function pgConf() {
    return {
        host: process.env.PG_SHADOW_HOST || 'arbimon-pgbouncer.data.svc.cluster.local',
        port: parseInt(process.env.PG_SHADOW_PORT || '6432', 10),
        user: process.env.PG_SHADOW_USER || 'arbimon_ro',
        password: process.env.PG_SHADOW_PASSWORD || '',
        database: process.env.PG_SHADOW_DATABASE || 'arbimon',
        // this IS the request path -- size it from DB_PG_POOL_MAX.
        max: Math.max(2, PG_POOL_MAX),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        // pgbouncer is transaction-pooled; disable pg's own keepalive probes
        // that can trip pooled servers.
        keepAlive: false
    };
}

// ---------------------------------------------------- allowlist classifier
// JS port of data-stores/arbimon-pg/replay/classify.py. A statement is
// REPLAYABLE only if it is provably a single plain read-only SELECT.

var FORBIDDEN_KEYWORDS = (function () {
    var s = {};
    ('insert update delete replace merge upsert create alter drop truncate ' +
     'rename grant revoke set call execute prepare deallocate handler do kill ' +
     'load outfile dumpfile infile lock unlock begin commit rollback savepoint ' +
     'release start xa explain analyze analyse describe show use install ' +
     'uninstall shutdown reset purge change stop slave flush optimize repair ' +
     'checksum check backup restore into for returning').split(/\s+/)
        .forEach(function (w) { s[w] = true; });
    return s;
})();

var FORBIDDEN_FUNCTIONS = (function () {
    var s = {};
    ('get_lock release_lock release_all_locks is_free_lock is_used_lock sleep ' +
     'benchmark master_pos_wait master_gtid_wait last_insert_id row_count ' +
     'found_rows rand random uuid uuid_short sys_guid now curdate curtime ' +
     'sysdate current_timestamp current_date current_time unix_timestamp ' +
     'utc_date utc_time utc_timestamp connection_id current_user session_user ' +
     'system_user user database version').split(/\s+/)
        .forEach(function (w) { s[w] = true; });
    return s;
})();

var _STRING_RE = /'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.|"")*"|`(?:[^`]|``)*`/g;
var _LINE_COMMENT_RE = /--[^\n]*|#[^\n]*/g;
var _BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
var _WORD_RE = /[a-zA-Z_][a-zA-Z0-9_]*/g;

function neutralize(sql) {
    var s = sql.replace(_STRING_RE, ' _LIT_ ');
    s = s.replace(_BLOCK_COMMENT_RE, ' ');
    s = s.replace(_LINE_COMMENT_RE, ' ');
    return s;
}

// verdict.replayable === true only for a provably-plain read-only SELECT.
function classify(sql) {
    if (!sql || typeof sql !== 'string') { return { replayable: false, reason: 'empty/non-string' }; }
    if (sql.indexOf('\u0000') !== -1) { return { replayable: false, reason: 'NUL byte' }; }
    var neutral = neutralize(sql);
    if (/['"`]/.test(neutral)) { return { replayable: false, reason: 'unbalanced quote/identifier' }; }
    var body = neutral.trim();
    if (!body) { return { replayable: false, reason: 'empty after neutralize' }; }
    if (body.charAt(body.length - 1) === ';') { body = body.slice(0, -1); }
    if (body.indexOf(';') !== -1) { return { replayable: false, reason: 'multi-statement' }; }
    var words = (body.match(_WORD_RE) || []).map(function (w) { return w.toLowerCase(); });
    if (!words.length) { return { replayable: false, reason: 'no tokens' }; }
    var first = words[0];
    if (first === 'with') {
        if (words.indexOf('select') === -1) { return { replayable: false, reason: 'WITH without SELECT' }; }
    } else if (first !== 'select') {
        return { replayable: false, reason: 'first keyword ' + first };
    }
    for (var i = 0; i < words.length; i++) {
        if (FORBIDDEN_KEYWORDS[words[i]]) { return { replayable: false, reason: 'forbidden keyword ' + words[i] }; }
    }
    var m;
    _WORD_RE.lastIndex = 0;
    while ((m = _WORD_RE.exec(body)) !== null) {
        var w = m[0].toLowerCase();
        if (FORBIDDEN_FUNCTIONS[w]) {
            var rest = body.slice(m.index + m[0].length).replace(/^\s+/, '');
            if (rest.charAt(0) === '(') { return { replayable: false, reason: 'forbidden function ' + w + '()' }; }
        }
    }
    if (body.indexOf('@') !== -1) { return { replayable: false, reason: 'user/system variable' }; }
    return { replayable: true, reason: 'plain SELECT' };
}

// --------------------------------------------------- SQL template + hash
// JS port of sql_template()/template_hash() — buckets divergences so ~400
// call sites collapse to ~100-150 templates (same keying as the P3 report).

function sqlTemplate(sql) {
    var s = sql.replace(_STRING_RE, '?');
    s = s.replace(_BLOCK_COMMENT_RE, ' ');
    s = s.replace(_LINE_COMMENT_RE, ' ');
    s = s.replace(/(^|[^a-zA-Z0-9_.])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, '$1?');
    s = s.replace(/\(\s*\?(?:\s*,\s*\?)*\s*\)/g, '(?)');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

function templateHash(sql) {
    return crypto.createHash('sha1').update(sqlTemplate(sql).toLowerCase()).digest('hex').slice(0, 16);
}

// ------------------------------------------- connection-lifetime SQLSTATEs
// A server-side connection DEATH is not a dialect fault. #1781 established
// the rule and guarded the shape it had measured: an Error with NO SQLSTATE
// ("Connection terminated unexpectedly"). But an ADMINISTRATIVE termination
// DOES carry a SQLSTATE, so it slipped past that guard and was counted as
// `dialect_error` — the O5 gate's hard-zero headline metric.
//
// MEASURED (rfcx-local, 2026-07-29): the 04:04:06Z TL72->73 DCS-blip
// failover produced exactly two `dialect_error` divergence records, both
// pg_code **57P01** ("terminating connection due to administrator command"),
// on two unrelated recordings templates. A third failover the same evening
// (19:11:47Z TL74->75) produced ZERO — the client 'error' handler won that
// race instead. **The mis-classification is therefore NON-DETERMINISTIC:
// whether an infra blip corrupts the gate metric depends on a callback
// race.** That is worse than a reliable bug, because a clean census cannot
// be trusted to mean the guard held.
//
// The class (PG Appendix A, Class 57 - Operator Intervention):
//   57P01 admin_shutdown          - terminate_backend / failover / restart
//   57P02 crash_shutdown          - peer backend crashed, cluster restarting
//   57P03 cannot_connect_now      - server starting up / shutting down
//   08006 connection_failure      - connection broken mid-statement
//   08003 connection_does_not_exist
//   08000 connection_exception
// 57014 (query_canceled) is deliberately NOT here: it is OUR statement_timeout
// firing, already counted separately as pg_timeout (a perf signal).
// 53300 (too_many_connections) is NOT here either: that is a real capacity
// fault we WANT visible rather than silently absorbed as infra noise.
//
// 08P01 protocol_violation (rfcx-local 2026-08-03, 3rd incompleteness of this
// classifier after #1781/#1787): when a backend dies UNDER PGBOUNCER, the
// pooler synthesizes an 08P01 error to the client with the message
// "server conn crashed?" (both the SQLSTATE and the message are pgbouncer
// binary strings; verified against the pooler log at the same second). The
// TL78->79 failover at 06:47:33Z booked exactly 2 such records per pod as
// dialect_error — a pooler-mediated connection death, not a dialect fault.
// #1787 covered the DIRECT-connection death states (57P01/2/3, 08000/3/6)
// but the shadow path rides pgbouncer, so the pooler's synthesized state is
// the one it actually sees. A REAL client protocol bug would be chronic and
// still visible as a pg_error step-change (query_conn_error keeps pg_code).
var CONN_LIFETIME_SQLSTATES = {
    '57P01': 1, '57P02': 1, '57P03': 1,
    '08000': 1, '08003': 1, '08006': 1, '08P01': 1
};

function isConnLifetimeError(err) {
    if (!err) { return false; }
    // No SQLSTATE at all = the #1781 shape (connection died before the server
    // could answer). Kept verbatim so that guard's behaviour is unchanged.
    if (!err.code) { return true; }
    return CONN_LIFETIME_SQLSTATES[String(err.code).toUpperCase()] === 1;
}

// ------------------------------------------------------ MySQL -> PG translator
// First-pass dialect translation for the measured hot spots. Anything not
// covered here surfaces as a `dialect_error` divergence = the Phase-6 queue.
// Runs on the FINAL literal-bearing SQL (mysql.format already applied), so
// string/backtick literals must be protected before rewriting keywords.

// PG-reserved words that, when they appear as a backtick identifier, must be
// double-quoted (dropping backticks would produce a syntax error). Everything
// else drops backticks so PG folds to lowercase (matches the T14 lowercased
// DDL, and lets camelCase columns like `projectId` resolve).
var PG_RESERVED_IDENT = (function () {
    var s = {};
    ('order group user select from where limit offset desc asc default check ' +
     'primary references table column constraint using natural join on and or ' +
     'not null true false case when then else end all any some union except ' +
     'intersect distinct as in is like between').split(/\s+/)
        .forEach(function (w) { s[w] = true; });
    return s;
})();

function protectLiterals(sql, store) {
    // Replace '...' and "..." string literals with placeholders so keyword
    // rewriting cannot touch their contents. Backticks handled separately.
    return sql.replace(/'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.|"")*"/g, function (lit) {
        var key = '\u0001L' + store.length + '\u0001';
        store.push(lit);
        return key;
    });
}

function restoreLiterals(sql, store) {
    return sql.replace(/\u0001L(\d+)\u0001/g, function (_, n) { return store[parseInt(n, 10)]; });
}

// MySQL (without ANSI_QUOTES — our pools never set it) treats "..." as a
// STRING literal; PG treats it as an IDENTIFIER. Live consequence (P6 canary):
// `J.state = "completed"` resolved "completed" to the jobs.completed COLUMN
// (smallint) → 42883 `job_state = smallint`, and in the PM shape where two
// joined tables both have `completed` → 42702 ambiguous-column. Convert every
// REMAINING double-quoted literal (fixQuotedAliases already consumed the
// `AS "x"` cases before this runs) to a PG single-quoted literal.
//
// BACKSLASH ESCAPES (rfcx-local 2026-07-27, stage-3 day-1 finding).
// Previously ANY literal containing a backslash was punted verbatim, which
// produced TWO live failure modes because the mysql driver's SqlString
// escaper emits backslash escapes for `' " \ \0 \b \n \r \t \Z`:
//   (a) LOUD: a value containing a quote — e.g. the real site name
//       `SNR ''Kraljevac''` (site_id 88347, created 2026-07-27T10:18:26Z) —
//       arrives as 'SNR \'\'Kraljevac\'\'' and PG (standard_conforming_strings
//       = on, verified live) raises 42601 `syntax error at or near "\"`.
//       Same shape for any O'Brien-class name.
//   (b) SILENT + WORSE: a value containing a newline/tab arrives as 'a\nb';
//       under standard_conforming_strings=on PG reads that as a LITERAL
//       backslash + 'n' (proven live on the replica: 'a\nb' = E'a\nb' is
//       FALSE, length('a\nb') = 4). No error — just a wrong comparison, and
//       at the 6.4 read flip, wrong RESULTS.
// So we now DECODE MySQL escape semantics and RE-ENCODE as a standard PG
// literal. This is safe to do here and only here: protectLiterals() guarantees
// no other translator pass has seen the literal's contents.
//
// Decoder semantics are MEASURED against the live master (sql_mode='', i.e.
// NO_BACKSLASH_ESCAPES off — verified 2026-07-27), not assumed:
//   \0 \b \n \r \t \Z  -> NUL BS LF CR TAB SUB
//   \' \" \\           -> ' " \
//   \% \_              -> KEEP THE BACKSLASH (MySQL leaves these intact so
//                         LIKE metacharacter escaping survives; live:
//                         LENGTH('a\%b') = 4). Decoding them would silently
//                         change LIKE semantics.
//   \<other>           -> the bare character (live: '[a\qb]' -> [aqb])
// A literal containing NUL is punted honestly: PG text cannot represent \0,
// so there is no correct translation (an honest dialect_error beats a wrong
// value — the same principle the original punt was reaching for).
var MYSQL_ESCAPE_MAP = { '0': '\0', 'b': '\b', 'n': '\n', 'r': '\r',
                         't': '\t', 'Z': '\x1a' };

function decodeMysqlLiteral(inner, quoteChar) {
    // Doubled quote chars (MySQL accepts '' inside '...' and "" inside "...").
    var out = '';
    for (var i = 0; i < inner.length; i++) {
        var ch = inner.charAt(i);
        if (ch === '\\' && i + 1 < inner.length) {
            var nx = inner.charAt(i + 1);
            if (nx === '%' || nx === '_') { out += '\\' + nx; i++; continue; }
            out += Object.prototype.hasOwnProperty.call(MYSQL_ESCAPE_MAP, nx)
                 ? MYSQL_ESCAPE_MAP[nx] : nx;
            i++;
            continue;
        }
        if (ch === quoteChar && inner.charAt(i + 1) === quoteChar) {
            out += quoteChar; i++; continue;
        }
        out += ch;
    }
    return out;
}

function encodePgLiteral(value) {
    if (value.indexOf('\0') !== -1) { return null; }   // unrepresentable in PG text
    return "'" + value.replace(/'/g, "''") + "'";
}

function restoreLiteralsPg(sql, store) {
    return sql.replace(/\u0001L(\d+)\u0001/g, function (_, n) {
        var raw = store[parseInt(n, 10)];
        if (raw == null) { return _; }
        var q = raw.charAt(0);
        if (q !== '"' && q !== "'") { return raw; }
        var decoded = decodeMysqlLiteral(raw.slice(1, -1), q);
        var encoded = encodePgLiteral(decoded);
        // NUL: punt verbatim -> honest dialect_error rather than a wrong value.
        return encoded === null ? raw : encoded;
    });
}

function translateBackticks(sql) {
    return sql.replace(/`([^`]+)`/g, function (_, ident) {
        var low = ident.toLowerCase();
        if (PG_RESERVED_IDENT[low]) { return '"' + low + '"'; }
        // NON-PLAIN identifier (spaces / < > / punctuation — e.g. the export
        // SQLBuilder's escapeId aliases like `val<Genus species/Song>`): bare
        // is INVALID PG syntax, so emit a quoted identifier. Safe for intra-
        // query references: a special-char identifier can only ever be
        // referenced via backticks, so every occurrence converts identically.
        if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(ident)) {
            return '"' + ident.replace(/"/g, '""') + '"';
        }
        // drop backticks; PG folds unquoted to lowercase (T14)
        return ident;
    });
}

// --- schema-qualifier strip (P6, 2026-07-29) -----------------------------
// Two legacy call sites qualify tables with the MySQL SCHEMA name:
//   playlists.js:551  FROM arbimon2.playlist_recordings   (census d2f44837)
//   projects.js:79    from arbimon2.projects p
// On MariaDB that resolves (arbimon2 IS the schema); on PG the database is
// `arbimon` with everything in `public`, so the qualified name is a hard
// 42P01 (`relation "arbimon2.playlist_recordings" does not exist`) — the
// FIRST genuine dialect_error caught by the post-#1787 unconditional gate
// (2026-07-29 21:34Z, organic traffic). Strip the qualifier; the enumeration
// found NO other schema ever referenced (information_schema/mysql/etc. never
// appear in app SQL — verified by repo grep, 2 live sites total).
// Runs AFTER protectLiterals (a literal like
// 'arbimon2.s3.us-east-1.amazonaws.com' is already stashed and untouchable)
// and AFTER translateBackticks (so a hypothetical `arbimon2`.`t` form,
// already reduced to arbimon2.t, is caught too).
function stripSchemaQualifier(sql) {
    return sql.replace(/\barbimon2\s*\.\s*/gi, '');
}

// LIMIT offset, count  ->  LIMIT count OFFSET offset
function translateLimitOffset(sql) {
    return sql.replace(/\blimit\s+(\d+)\s*,\s*(\d+)/gi, function (_, off, cnt) {
        return 'LIMIT ' + cnt + ' OFFSET ' + off;
    });
}

// --- paren-aware function-call rewriter --------------------------------
// Finds NAME( ... ) with balanced parentheses (respecting the \u0001L<n>\u0001
// literal placeholders, which contain no parens/commas), splits the
// top-level comma args, and replaces the whole call with fn(args). Returns
// the original call unchanged when fn returns null (so an unsupported shape
// surfaces as an honest dialect_error rather than a wrong translation).
// Loops to a fixed point so NESTED calls (e.g. IF inside IF) all convert.
function splitTopArgs(argStr) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < argStr.length; i++) {
        var ch = argStr[i];
        if (ch === '(') { depth++; cur += ch; }
        else if (ch === ')') { depth--; cur += ch; }
        else if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
        else { cur += ch; }
    }
    if (cur.length || out.length) { out.push(cur); }
    return out.map(function (a) { return a.trim(); });
}

function rewriteCall(sql, name, fn) {
    var re = new RegExp('(^|[^A-Za-z0-9_.])(' + name + ')\\s*\\(', 'gi');
    var search = 0;
    for (var guard = 0; guard < 500; guard++) {
        re.lastIndex = search;
        var m = re.exec(sql);
        if (!m) { break; }
        var openIdx = m.index + m[0].length - 1;   // index of '('
        var depth = 0, endIdx = -1;
        for (var i = openIdx; i < sql.length; i++) {
            if (sql[i] === '(') { depth++; }
            else if (sql[i] === ')') { depth--; if (depth === 0) { endIdx = i; break; } }
        }
        if (endIdx < 0) { break; }   // unbalanced — give up cleanly
        var inner = sql.slice(openIdx + 1, endIdx);
        var repl = fn(splitTopArgs(inner), inner);
        if (repl === null || repl === undefined) {
            // Not rewritable: advance PAST this whole call and keep scanning
            // (a later same-named call may still be rewritable).
            search = endIdx + 1;
            continue;
        }
        // Resume AT the start of the replacement text: any nested same-named
        // call surfaced into the args (e.g. IF inside IF) gets found next
        // iteration. Idempotent rewrites (ROUND) must self-guard against
        // re-conversion via their fn returning null on already-converted args.
        sql = sql.slice(0, m.index + m[1].length) + repl + sql.slice(endIdx + 1);
        search = m.index + m[1].length;
    }
    return sql;
}

// MySQL DATE_FORMAT strftime-style codes -> PG to_char template tokens.
var DATE_FMT_CODES = { Y: 'YYYY', y: 'YY', m: 'MM', c: 'FMMM', d: 'DD', e: 'FMDD',
    H: 'HH24', k: 'FMHH24', h: 'HH12', I: 'HH12', i: 'MI', s: 'SS', S: 'SS',
    T: 'HH24:MI:SS', p: 'AM', j: 'DDD', W: 'Day', M: 'Month', a: 'Dy', b: 'Mon' };
function mysqlDateFormatToPg(fmt) {
    var out = '', i = 0;
    while (i < fmt.length) {
        var ch = fmt[i];
        if (ch === '%') {
            var code = fmt[i + 1];
            if (code === '%') { out += '%'; i += 2; continue; }
            if (!DATE_FMT_CODES.hasOwnProperty(code)) { return null; } // unknown -> bail
            out += DATE_FMT_CODES[code]; i += 2; continue;
        }
        // literal separators (/ - : space .) pass through; a bare letter would
        // be a to_char token, so quote any non-token literal char defensively.
        if (/[A-Za-z]/.test(ch)) { out += '"' + ch + '"'; }
        else { out += ch; }
        i++;
    }
    return out;
}

// A set of scalar-function / operator rewrites for the measured hot spots.
// `store` lets us read the text of protected string literals when a rewrite
// needs the literal value (DATE_FORMAT format, GROUP_CONCAT separator).
function litText(tok, store) {
    var m = /^\u0001L(\d+)\u0001$/.exec(tok.trim());
    if (!m) { return null; }
    var raw = store[parseInt(m[1], 10)];
    if (raw == null) { return null; }
    var q = raw.charAt(0);
    if (q !== '"' && q !== "'") { return null; }
    // Decode MySQL escape semantics for the same reason restoreLiteralsPg does
    // (2026-07-27): callers here (DATE_FORMAT fmt, GROUP_CONCAT SEPARATOR)
    // re-encode the text into a PG literal, so an undecoded `\'` would be
    // re-emitted wrong. Today's live corpus uses escape-free literals
    // (SEPARATOR ', ', plain date formats) — this keeps it correct if that
    // ever changes, rather than depending on the corpus staying tame.
    return decodeMysqlLiteral(raw.slice(1, -1), q);
}

function translateFunctions(sql, store) {
    var s = sql;
    // CONCAT(a,b,..) -> (a::text || b || ..)
    // MySQL CONCAT returns NULL if ANY argument is NULL; PG's concat()
    // FUNCTION ignores NULLs (measured live: MariaDB
    // CONCAT('https://x/', NULL) IS NULL -> 1; PG -> 'https://x/'). The old
    // comment here claimed CONCAT was identical in PG -- true for the
    // non-NULL case only, and the difference is user-visible: a template
    // with a NULL `uri` rendered `uri:"https://arbimon.org/"` on PG instead
    // of null (census template 257746653328cfc7, the largest unsigned
    // bucket on the 429b167 clock; live exposure 1060/77383 templates.uri
    // NULL across 239 projects, plus 441 training_set_roi_set_data.uri).
    // PG's `||` operator DOES propagate NULL (verified live:
    // ('a' || NULL || 'b') IS NULL -> t), so it is the faithful translation.
    //
    // WHY NOT a CASE guard: `CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE
    // a||b END` duplicates every operand -- which would DOUBLE any `?`
    // placeholder and shift parameter positions. `||` needs each operand
    // exactly once.
    //
    // The leading ::text cast is REQUIRED: PG has no `int || int` operator
    // (anynonarray||text / text||anynonarray only), so an all-numeric CONCAT
    // would raise 42883. Casting only the FIRST operand is sufficient because
    // `||` is left-associative: (int::text || int) -> text -> text || .. .
    // A NULL cast to text stays NULL, so propagation is preserved.
    s = rewriteCall(s, 'CONCAT', function (args) {
        if (!args.length) { return null; }
        // idempotence guard: an already-converted call starts with a cast
        // operand (the resume-at-replacement scan must not re-wrap).
        if (args.length === 1 && /::text\s*$/.test(args[0])) { return null; }
        var parts = args.map(function (a, i) {
            return i === 0 ? '(' + a + ')::text' : '(' + a + ')';
        });
        return '(' + parts.join(' || ') + ')';
    });

    // NOTE: GROUP_CONCAT is NOT affected -- rewriteCall's name boundary is
    // `(^|[^A-Za-z0-9_.])`, and GROUP_CONCAT's `CONCAT` is preceded by `_`,
    // so the CONCAT rule cannot match inside it. (GROUP_CONCAT keeps its own
    // string_agg rewrite below, whose MySQL semantics DO skip NULLs.)
    //
    // `||` is logical-OR in MySQL only under PIPES_AS_CONCAT (not set here).
    // RAND()/NOW() are classifier-forbidden so never arrive.
    // IFNULL(a,b) -> COALESCE(a,b)
    s = s.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
    // UCASE/LCASE are MySQL aliases (first live-canary dialect_error: tags
    // autocomplete uses UCASE) -> UPPER/LOWER
    s = s.replace(/\bUCASE\s*\(/gi, 'UPPER(');
    s = s.replace(/\bLCASE\s*\(/gi, 'LOWER(');

    // UNIX_TIMESTAMP(x) -> EXTRACT(EPOCH FROM x) — deterministic in its
    // argument, so safe to fold (the no-arg form maps to NOW()). PG has no
    // unix_timestamp(); without this, the jobs-list / models-list queries
    // (classifications.js, projects.js:1267/1291, admin-plots.js) 42883 on the
    // P7 write-conn path (measured live 2026-09-12, hash 71a84649, ~50/hour).
    // NOTE: the function stays in FORBIDDEN_FUNCTIONS for the shadow-read
    // replay classifier — that gate is conservative by design and unaffected.
    s = s.replace(/\bUNIX_TIMESTAMP\s*\(\s*\)/gi, 'EXTRACT(EPOCH FROM NOW())');
    s = s.replace(/\bUNIX_TIMESTAMP\s*\(\s*([^()]+?)\s*\)/gi, 'EXTRACT(EPOCH FROM $1)');

    // Bare boolean literals in comparisons: mysql's driver inlines JS booleans
    // as bare true/false, and MySQL accepts tinyint(1) = true — but PG rejects
    // smallint = boolean (42883). The legacy schema is tinyint->smallint
    // throughout (the only REAL boolean columns in the PG arbimon DB are in
    // internal ops tables no app SQL touches — verified 2026-09-12), so
    // mapping to 1/0 is correct. Measured live 2026-09-12:
    // /legacy-api/project/<slug>/classifications 500'd on `J.completed = true`
    // (classifications.js:63, SQLBuilder + mysql.format inline).
    s = s.replace(/(=|<>|!=)\s*true\b/gi, '$1 1');
    s = s.replace(/(=|<>|!=)\s*false\b/gi, '$1 0');

    // Bare boolean literals in LIST positions -- the same class, the other half
    // of the shape space (rfcx-local 2026-09-15, live 42804 on the write path).
    // The fold above is anchored on a COMPARISON OPERATOR, so it cannot see a
    // literal that has no operator in front of it:
    //     INSERT INTO job_params_soundscape(..., `normalize`) VALUES (..., false)
    // (app/model/jobs.js:78-85, soundscape_job.new -- `params.normalize` is a JS
    // boolean straight off req.body.nv, and dbpool.escape() inlines a JS boolean
    // as a BARE SQL `false`; it is NOT in the source, so no grep can find this
    // family). PG then rejects smallint <- boolean with
    //     42804 column "normalize" is of type smallint but expression is of type boolean
    // and because the INSERT sits inside sqlutil.transaction the WHOLE soundscape
    // job rolls back: measured live, no soundscape job created since
    // 2026-09-14 03:07:42Z, user sees {err:"Could not create soundscape job"}.
    //
    // SAFETY, in three parts:
    //  1. STRING CONTENTS CANNOT BE REACHED. translate() calls protectLiterals()
    //     FIRST and restoreLiteralsPg() LAST, so by the time this runs every
    //     '...'/"..." literal is a \u0001L<n>\u0001 placeholder. Proven by
    //     consequence: the comparison fold above already leaves
    //     `note = 'flag = false'` intact.
    //  2. IDENTIFIERS ARE PROTECTED by the delimiter anchor + \b -- a column
    //     named false_positive has no [(,] before it and no [,)] after it.
    //  3. NO REAL BOOLEAN COLUMN IS AT RISK. Re-verified live 2026-09-15 on the
    //     PG leader: public has exactly 3 boolean columns
    //     (mysql2pg_verify_state.matched, requeue_release_plan.passes_floor /
    //     .playlist_exists) -- all internal ops tables, none written by app SQL.
    //     Every app-touched flag column (normalize/completed/disabled/deleted,
    //     9 of 9) is smallint, so 1/0 is the correct rendering.
    //
    // SCOPE CHOICE (deliberate, and wider than VALUES on purpose): the anchor is
    // "element of a parenthesised/comma-delimited list", which covers VALUES
    // lists, IN (...) lists and function arguments alike. Those are exactly the
    // positions escape() can inject a runtime boolean into, and in THIS schema
    // they are all smallint targets. A VALUES-only rule would leave the IN-list
    // and function-arg forms of the identical defect live for the next session.
    //
    // THE ONE PLACE A BARE BOOLEAN IS GENUINELY REQUIRED is a PREDICATE, where
    // PG demands boolean and would reject the integer: `WHERE (true)`,
    // `AND (false)`, `ON (true)`. Those are guarded below and left alone.
    // (Measured in this codebase: 0 source-visible occurrences of any of these
    // shapes -- but source counts bound nothing here, since the literal is
    // injected at runtime, which is the whole reason for folding rather than
    // patching the call site.)
    s = s.replace(/([(,]\s*)(true|false)\b(?=\s*[,)])/gi, function (m, open, val, off, str) {
        if (open.charAt(0) === '(') {
            // Walk back over any run of '(' + whitespace, so a nested predicate
            // like `AND ((true))` is still recognised as a predicate.
            var i = off;
            while (i > 0 && (str.charAt(i - 1) === '(' || /\s/.test(str.charAt(i - 1)))) { i--; }
            if (/\b(?:where|and|or|not|on|having|when)\s*$/i.test(str.slice(Math.max(0, i - 12), i))) {
                return m;   // predicate position -- PG requires a boolean here
            }
        }
        return open + (val.toLowerCase() === 'true' ? '1' : '0');
    });

    // ISNULL(x) -> (x IS NULL)   (PG has no ISNULL function)
    s = rewriteCall(s, 'ISNULL', function (args) {
        if (args.length !== 1) { return null; }
        return '(' + args[0] + ' IS NULL)';
    });

    // IF(cond, a, b) -> CASE WHEN cond THEN a ELSE b END  (nested via fixpoint)
    s = rewriteCall(s, 'IF', function (args) {
        if (args.length !== 3) { return null; }
        return 'CASE WHEN ' + args[0] + ' THEN ' + args[1] + ' ELSE ' + args[2] + ' END';
    });

    // SUBSTRING_INDEX(str, delim, count) -> split_part(str, delim, count)
    // ONLY equivalent for |count| = 1 (for |count|>1 MySQL joins the first
    // N segments whereas split_part returns the Nth). Guard strictly; the
    // whole live corpus uses ±1. Others fall through to an honest divergence.
    s = rewriteCall(s, 'SUBSTRING_INDEX', function (args) {
        if (args.length !== 3) { return null; }
        var cnt = args[2].trim();
        if (cnt !== '1' && cnt !== '-1') { return null; }
        return 'split_part(' + args[0] + ', ' + args[1] + ', ' + cnt + ')';
    });

    // YEAR/MONTH/DAY/HOUR/MINUTE/SECOND(x) -> EXTRACT(field FROM x)::int
    ['YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'].forEach(function (fld) {
        s = rewriteCall(s, fld, function (args) {
            if (args.length !== 1) { return null; }
            return 'EXTRACT(' + fld + ' FROM ' + args[0] + ')::int';
        });
    });

    // ROUND(expr, n): PG has no round(double precision, int) — only
    // round(numeric, int). Cast the value to numeric. 1-arg ROUND is fine
    // in both, leave it.
    s = rewriteCall(s, 'ROUND', function (args) {
        if (args.length !== 2) { return null; }
        // idempotence guard: skip an already-converted ROUND (arg0 cast to
        // numeric) so the resume-at-replacement scan can't re-wrap it.
        if (/::numeric\s*$/.test(args[0])) { return null; }
        return 'round((' + args[0] + ')::numeric, ' + args[1] + ')';
    });

    // TRUNCATE(expr, n): MySQL truncates toward zero to n decimals. PG's
    // trunc(numeric, int) has the SAME toward-zero semantics for both signs
    // (verified live: trunc(-1.23456::numeric,3) = -1.234 = MySQL). PG has no
    // trunc(double precision, int), so cast the value to numeric (mirrors the
    // ROUND rewrite above). 1-arg TRUNCATE is not used by our SQL; leave it.
    // The `_pattern_matching`/table name `truncate` is a keyword, not a call,
    // so rewriteCall (which requires `name(`) won't touch identifiers.
    s = rewriteCall(s, 'TRUNCATE', function (args) {
        if (args.length !== 2) { return null; }
        // idempotence guard: skip an already-converted trunc arg.
        if (/::numeric\s*$/.test(args[0])) { return null; }
        return 'trunc((' + args[0] + ')::numeric, ' + args[1] + ')';
    });

    // DATE_FORMAT(x, '<fmt>') -> to_char(x, '<pgfmt>')
    s = rewriteCall(s, 'DATE_FORMAT', function (args) {
        if (args.length !== 2) { return null; }
        var fmt = litText(args[1], store);
        if (fmt === null) { return null; }
        var pg = mysqlDateFormatToPg(fmt);
        if (pg === null) { return null; }
        return "to_char(" + args[0] + ", '" + pg + "')";
    });

    // GROUP_CONCAT(expr [SEPARATOR sep]) -> string_agg(expr, sep|',')
    s = rewriteCall(s, 'GROUP_CONCAT', function (args, inner) {
        // SEPARATOR is a keyword inside the single arg, not a comma-split arg.
        var sepM = /\bSEPARATOR\b/i.exec(inner);
        var expr, sep;
        if (sepM) {
            expr = inner.slice(0, sepM.index).trim();
            var septok = inner.slice(sepM.index + sepM[0].length).trim();
            var sv = litText(septok, store);
            sep = sv === null ? null : "'" + sv.replace(/'/g, "''") + "'";
            if (sep === null) { return null; }
        } else {
            expr = inner.trim();
            sep = "','"; // MySQL default GROUP_CONCAT separator
        }
        // string_agg needs text; casting keeps numeric ids concatenating.
        return 'string_agg((' + expr + ')::text, ' + sep + ')';
    });

    // ORDER BY FIELD(col, v1..vn) → COALESCE(array_position(ARRAY[v1..vn], col), 0)
    // MySQL FIELD returns the 1-based index, 0 when absent (sorts FIRST asc);
    // COALESCE(array_position(...), 0) reproduces that exactly. The ARRAY
    // constructor also sidesteps PG's 100-argument function limit (54023 — the
    // recordings.js visualizer-order query passes hundreds of ids). Guarded to
    // all-numeric tail args (the only live shape).
    s = rewriteCall(s, 'FIELD', function (args) {
        if (args.length < 2) { return null; }
        var tail = args.slice(1);
        for (var i = 0; i < tail.length; i++) {
            if (!/^-?\d+$/.test(tail[i].trim())) { return null; }
        }
        return 'COALESCE(array_position(ARRAY[' + tail.join(', ') + '], ' +
               args[0] + '), 0)';
    });

    // TIMESTAMPDIFF(unit, a, b) → trunc(EXTRACT(EPOCH FROM (b - a)) / secs)::bigint
    // (PG parses the bare unit as a column → 42703 `column "second" does not
    // exist`, models.js joblength). MySQL truncates toward zero; trunc()
    // matches. Guarded to the time units where epoch math is exact.
    s = rewriteCall(s, 'TIMESTAMPDIFF', function (args) {
        if (args.length !== 3) { return null; }
        var unit = args[0].trim().toUpperCase();
        var secs = { SECOND: 1, MINUTE: 60, HOUR: 3600, DAY: 86400 }[unit];
        if (!secs) { return null; }
        var diff = 'EXTRACT(EPOCH FROM ((' + args[2] + ') - (' + args[1] + ')))';
        return 'trunc(' + (secs === 1 ? diff : diff + ' / ' + secs) + ')::bigint';
    });

    // MySQL `= ` on tinyint boolean is fine (smallint per T2). No rewrite.
    return s;
}

// ------------------------------------------------- collation / case folding
// THE PROBLEM (measured live 2026-07-27, stage-3 clock-week day 1):
// every string column in arbimon2 carries a *_ci collation (99
// utf8mb3_general_ci + 21 latin1_swedish_ci; ZERO *_bin, zero binary/blob),
// so MariaDB compares EVERY string case-insensitively. PG compares
// varchar/text case-SENSITIVELY. schema/096 (T13) gave citext to the 9 UNIQUE
// identity keys only — deliberately (TYPE-POLICY T13 defers the rest to
// "Phase-6 app-audit territory"; SCHEMA-WISHLIST W5). This is that audit.
//
// Live consequence, measured on the real species.search() SQL (uncapped):
//   'bird'    MariaDB 34620  vs  PG 967
//   'ANTBIRD' MariaDB   147  vs  PG   0     <- user search returns NOTHING
// and it fails OPEN (no error), so DB_PG_FALLBACK cannot catch it.
//
// THE TWO COLLATIONS DISAGREE ON ACCENTS — measured on the live master,
// with true single-byte latin1 values (a first attempt that put UTF-8 bytes
// into _latin1 literals compared on LENGTH, not collation, and produced a
// convincing but FALSE result — hence the byte-level test):
//     pair    latin1_swedish_ci   utf8mb3_general_ci
//     é vs e         1                    1
//     ç vs c         1                    1
//     ñ vs n         1                    1
//     å ä ö ü        0 (DISTINCT)         1 (folded)
// Confirmed on real rows: templates.name (swedish) 'Zaunkonig' finds 0 but
// 'Zaunkönig' finds 2, while pattern_matchings.name 'Tocon' == 'Tocón' == 8;
// sites.name (general) 'Marco' == 'Março' == 16.
// So a BLANKET accent-insensitive rule would OVER-match German/Nordic names.
//
// WHY NOT native COLLATE: per-column nondeterministic ICU collations would
// need no translator change at all, but PG rejects them —
// "nondeterministic collations are not supported for LIKE" (tested).
// WHY NOT unaccent(): not installed, and STABLE (not IMMUTABLE) so not
// indexable. translate(lower()) is IMMUTABLE and reproduces both foldings
// exactly — 8/8 parity vs MariaDB on live rows.
// GENERATED - do not hand-edit. Source: live arbimon2
// information_schema.COLUMNS (MariaDB is the truth for collation).
// Regenerate: data-stores/arbimon-pg/tools/gen-collation-map.sh
// 120 string columns: 21 latin1_swedish_ci (sv), 99 utf8mb3_general_ci (gen).
//
// sv  = latin1_swedish_ci   : folds case + acute/cedilla/tilde,
//                             KEEPS a-ring/a-uml/o-uml/u-uml distinct.
// gen = utf8mb3_general_ci  : folds case + ALL accents incl. umlauts.
// Both MEASURED on the live master 2026-07-27; see
// runbooks/mysql2pg-p6-collation-case-sensitivity-2026-07-27.md
//
// Only the SV set is enumerated: it is small (21) and stable, and every
// other string column is general_ci. A column absent from BOTH sets is
// UNRESOLVED and its predicate is left untouched (fail-safe).
var COLLATION_SV = {
    'audio_event_detections_clustering.uri_vector': 1,
    'cached_metrics.key': 1,
    'classification_stats.json_stats': 1,
    'job_params_audio_event_clustering.name': 1,
    'job_params_audio_event_clustering.parameters': 1,
    'job_params_audio_event_detection_clustering.name': 1,
    'job_params_audio_event_detection_clustering.parameters': 1,
    'job_task_types.identifier': 1,
    'job_task_types.name': 1,
    'job_task_types.typedef': 1,
    'job_tasks.args': 1,
    'job_tasks.remark': 1,
    'job_tasks.status': 1,
    'pattern_matchings.name': 1,
    'pattern_matchings.parameters': 1,
    'recordings_export_parameters.error': 1,
    'recordings_export_parameters.filters': 1,
    'recordings_export_parameters.projection_parameters': 1,
    'recordings_export_parameters.user_email': 1,
    'templates.name': 1,
    'templates.uri': 1,
};

// The full known-column set (sv + gen). A qualified operand that
// resolves into this set gets a fold; anything else is left alone.
var COLLATION_KNOWN = {
    'audio_event_detections_clustering.uri_vector': 1,
    'cached_metrics.key': 1,
    'classification_stats.json_stats': 1,
    'job_params_audio_event_clustering.name': 1,
    'job_params_audio_event_clustering.parameters': 1,
    'job_params_audio_event_detection.name': 1,
    'job_params_audio_event_detection.statistics': 1,
    'job_params_audio_event_detection_clustering.name': 1,
    'job_params_audio_event_detection_clustering.parameters': 1,
    'job_params_classification.name': 1,
    'job_params_soundscape.name': 1,
    'job_params_soundscape.threshold_type': 1,
    'job_params_training.name': 1,
    'job_queues.arch': 1,
    'job_queues.host': 1,
    'job_queues.platform': 1,
    'job_queues.run_types': 1,
    'job_task_types.identifier': 1,
    'job_task_types.name': 1,
    'job_task_types.typedef': 1,
    'job_tasks.args': 1,
    'job_tasks.remark': 1,
    'job_tasks.status': 1,
    'job_types.description': 1,
    'job_types.identifier': 1,
    'job_types.name': 1,
    'job_types.run_type': 1,
    'job_types.script': 1,
    'jobs.remarks': 1,
    'jobs.state': 1,
    'jobs.uri': 1,
    'model_stats.json_stats': 1,
    'model_types.description': 1,
    'model_types.name': 1,
    'models.name': 1,
    'models.uri': 1,
    'pattern_matchings.name': 1,
    'pattern_matchings.parameters': 1,
    'permissions.description': 1,
    'permissions.name': 1,
    'playlist_types.name': 1,
    'playlists.metadata': 1,
    'playlists.name': 1,
    'playlists.uri': 1,
    'project_news.data': 1,
    'project_news_types.description': 1,
    'project_news_types.message_format': 1,
    'project_news_types.name': 1,
    'projects.country': 1,
    'projects.external_id': 1,
    'projects.name': 1,
    'projects.state': 1,
    'projects.url': 1,
    'recordings.bit_rate': 1,
    'recordings.filename': 1,
    'recordings.meta': 1,
    'recordings.mic': 1,
    'recordings.recorder': 1,
    'recordings.sample_encoding': 1,
    'recordings.uri': 1,
    'recordings.version': 1,
    'recordings_errors.error': 1,
    'recordings_export_parameters.error': 1,
    'recordings_export_parameters.filters': 1,
    'recordings_export_parameters.projection_parameters': 1,
    'recordings_export_parameters.user_email': 1,
    'roles.description': 1,
    'roles.icon': 1,
    'roles.name': 1,
    'site_types.description': 1,
    'site_types.name': 1,
    'sites.country_code': 1,
    'sites.external_id': 1,
    'sites.name': 1,
    'sites.timezone': 1,
    'songtypes.description': 1,
    'songtypes.songtype': 1,
    'soundscape_aggregation_types.description': 1,
    'soundscape_aggregation_types.identifier': 1,
    'soundscape_aggregation_types.name': 1,
    'soundscape_aggregation_types.scale': 1,
    'soundscape_composition_class_types.type': 1,
    'soundscape_composition_classes.name': 1,
    'soundscape_regions.name': 1,
    'soundscape_regions.threshold_type': 1,
    'soundscape_tags.tag': 1,
    'soundscape_tags.type': 1,
    'soundscapes.name': 1,
    'soundscapes.threshold_type': 1,
    'soundscapes.uri': 1,
    'species.code_name': 1,
    'species.description': 1,
    'species.image': 1,
    'species.scientific_name': 1,
    'species_aliases.alias': 1,
    'species_families.family': 1,
    'species_taxons.image': 1,
    'species_taxons.taxon': 1,
    'tags.tag': 1,
    'templates.name': 1,
    'templates.uri': 1,
    'training_set_roi_set_data.uri': 1,
    'training_set_types.description': 1,
    'training_set_types.identifier': 1,
    'training_set_types.name': 1,
    'training_sets.metadata': 1,
    'training_sets.name': 1,
    'user_account_support_request.hash': 1,
    'user_account_support_request.params': 1,
    'user_account_support_type.description': 1,
    'user_account_support_type.name': 1,
    'users.email': 1,
    'users.firstname': 1,
    'users.lastname': 1,
    'users.login': 1,
    'users.password': 1,
    'users.rfcx_id': 1,
    'validation_set.name': 1,
    'validation_set.params': 1,
    'validation_set.uri': 1,
};

// PG-ENUM EXCLUSION (measured 2026-07-27 — this is a HARD error, not a nicety).
// These columns are native PG enum types in the migrated schema, and
// lower()/translate() have no enum overload:
//   SELECT ... WHERE translate(lower(state), ...) = ...
//   ERROR: No function matches the given name and argument types
// jobs.state is the HOTTEST predicate in the live PG jobs plane (5.5 flip),
// so folding it would break production reads at 6.4. Enum vocabularies are
// machine-written and case-exact anyway ('completed'/'error'/'canceled'),
// so MySQL's ci comparison is never load-bearing for them.
// Source: pg_type.typtype='e' on the live arbimon copy.
var COLLATION_ENUM = {
    'job_params_soundscape.threshold_type': 1,
    'job_tasks.status': 1,
    'job_types.run_type': 1,
    'jobs.state': 1,
    'soundscape_regions.threshold_type': 1,
    'soundscape_tags.type': 1,
    'soundscapes.threshold_type': 1,
};

// ---- EXACT-MATCH EXEMPTIONS (2026-09-10, P7 debt #9 gate 1) ----------------
// Columns that are MACHINE-KEYED (the app writes them, the app reads them back
// verbatim) AND indexed by a plain btree on a giant table. Folding one turns an
// indexed point lookup into a whole-table scan:
//
//   recordings.uri  306 M rows, `uri` btree. The 6.4 read flip routed
//   recordingInfoGivenUri (recordings.js) — one `WHERE r.uri = ?` per CSV line of
//   GET /models/:id/validation-list — and the fold rewrote it to
//   `translate(lower(r.uri),..) = translate(lower(?),..)` => Parallel Seq Scan,
//   cost 19.9 M, cancelled by the 8 s statement_timeout on EVERY call: 340 of
//   the 480 pg_route_timeout events in 48 h (09-08..09-10), each page 10 x 8 s
//   = 80 s before failing open to MariaDB. Unfolded: Index Scan, 0.16 ms.
//   The literal comes from the DB itself (the PM training job copies r.uri into
//   the validation CSV), so exact match is the correct semantics; a literal-only
//   fold was REJECTED because 2020-era stream ids carry uppercase
//   (`2020/11/18/co8K2020066/...`, thousands per 100k ids) and would be missed.
//   Accepted divergence: MariaDB (utf8mb3_general_ci) would match a case-
//   VARIANT literal; PG will not. No app path constructs one (the three SQL
//   sites on `uri` are recordingInfoGivenUri, exists() [site-bounded, 0 calls
//   in 14 d], archiveBySiteAndUris [UPDATE, site-bounded]).
//   Alternative that preserves ci semantics: an expression index on the fold
//   (~28 GB, hours of CIC WAL on the leader) — deliberately not taken.
//
// The 2026-07-27 collation finding foresaw this: "if a high-volume `=`
// predicate is ever routed, re-check the plan" (runbooks/mysql2pg-p6-
// collation-case-sensitivity-2026-07-27.md, Index note). Every fold pass
// (qualified, bare, IN-list, ORDER BY) consults this set via collationClass /
// resolveBareColumn, so an exempt column is never folded anywhere.
//   cached_metrics.key  41,889 rows, varchar PK (`key` / `unique_key`). Machine-keyed
//   (`recording-count`, `project-<id>-rec`, ... written by cached-metrics.js and
//   read back by the same literal); measured 2026-09-10 on the MariaDB master:
//   0 keys with uppercase, 0 non-ASCII. The fold's plan is a Seq Scan removing
//   41,888 rows (12.5 s cold on the replica) on EVERY getCachedMetrics read —
//   at P7 that is the cold path arriving through a different door. Unfolded:
//   the PK. Per-call census (2026-09-10, same session): the other folded
//   indexed columns (projects.url, users.login/email, tags.tag, sites.name,
//   species.*, playlists.name, training_sets.name) are NOT exempted —
//   projects.url has 3 non-ASCII urls and users.login 750 case-variant /
//   10,750 `auth0|...` values on the master, so exact match would change
//   which rows a folded lookup finds; those are their own item. recordings.
//   filename is bounded only while every shape leads with site_id.
var COLLATION_EXACT = {
    'recordings.uri': 1,
    'cached_metrics.key': 1,
};

// ---- ORDER-BY-ONLY EXEMPTIONS (2026-09-12, P7 pre-flip read-timeout sweep) --
// `recordings.filename`: folding an ORDER BY key defeats the
// (site_id, filename) composite that serves the per-site top-N arms of the
// union-per-site list sort (app/utils/persite-sort.js, emitted by
// findProjectRecordings). A folded arm must heap-fetch and re-sort EVERY row of
// the site instead of walking the index to LIMIT k — measured on the live giant
// (950 sites / 11.2 M rows): the folded single-query shape cancels at the 8 s
// statement_timeout deterministically (pg_route_timeout hashes
// f44b4c1fdbb60431 / 16670983c3ff6008); the unfolded union runs 1.38 s on the
// leader. The COLLATION_EXACT comment above foresaw the boundary:
// "recordings.filename is bounded only while every shape leads with site_id" —
// the multi-site sort is exactly the shape that does not.
// ORDER-BY ONLY: `=`/IN/LIKE predicates on filename keep their fold (exists()
// is site-bounded and the fold is harmless there; changing match semantics for
// upload dedup is not this PR's business).
// Accepted divergence, named: on PG the filename sort now follows the column's
// collation (byte order); MariaDB's utf8mb3_general_ci folds case and accents.
// Order differs only within case/accent-variant filename sets — the dominant
// filename shapes (timestamp-leading, e.g. 20220202_043000.WAV) order
// identically on both engines.
var COLLATION_ORDER_EXACT = {
    'recordings.filename': 1,
};

// The two folds. Applied to BOTH sides of a predicate.
var FOLD_GEN = "translate(lower(%s),'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ','aaaaaaeeeeiiiiooooouuuucny.')";
var FOLD_SV  = "translate(lower(%s),'áàâãéèêëíìîïóòôõúùûçñýÿ','aaaaeeeeiiiioooouuucny.')";

function foldExpr(expr, cls) {
    return (cls === 'sv' ? FOLD_SV : FOLD_GEN).replace('%s', expr);
}

// Resolve FROM/JOIN aliases so `T.name` can be mapped to a real table.
// REQUIRED, not optional: the same alias means different tables in different
// queries (T = templates/sv in the template search, T = tags/gen in the tag
// autocomplete), and 5 bare column names are ambiguous across the two
// collation classes — `name` alone spans 27 columns (4 sv / 23 gen).
var _ALIAS_RE = /\b(?:FROM|JOIN)\s+`?([A-Za-z_]\w*)`?(?:\s+(?:AS\s+)?`?([A-Za-z_]\w*)`?)?/gi;
var _ALIAS_KW = /^(SELECT|WHERE|ON|GROUP|ORDER|BY|LEFT|RIGHT|INNER|OUTER|CROSS|JOIN|LIMIT|OFFSET|UNION|SET|USING|AND|OR|AS|HAVING|WHEN|THEN|ELSE|END)$/i;

function aliasMap(sql) {
    var map = {};
    var m;
    _ALIAS_RE.lastIndex = 0;
    while ((m = _ALIAS_RE.exec(sql)) !== null) {
        var table = m[1].toLowerCase();
        var alias = m[2];
        map[table] = table;
        if (alias && !_ALIAS_KW.test(alias)) { map[alias.toLowerCase()] = table; }
    }
    return map;
}

// Resolve a qualified operand to its collation class, or null when unknown.
// NULL IS THE FAIL-SAFE: an unfolded predicate reproduces today's KNOWN and
// census-reported behaviour, whereas guessing 'gen' would silently apply the
// wrong semantics to the 21 latin1_swedish_ci columns. Never guess.
function collationClass(operand, amap) {
    var parts = String(operand).split('.');
    if (parts.length !== 2) { return null; }   // bare column -> ambiguous -> skip
    var tbl = amap[parts[0].toLowerCase()];
    if (!tbl) { return null; }
    var key = tbl + '.' + parts[1].toLowerCase();
    if (!COLLATION_KNOWN[key]) { return null; }
    // PG native enum: folding is a hard type error (measured). Skip.
    if (COLLATION_ENUM[key]) { return null; }
    // Machine-keyed + btree-indexed on a giant table: exact match (see
    // COLLATION_EXACT). Skip.
    if (COLLATION_EXACT[key]) { return null; }
    return COLLATION_SV[key] ? 'sv' : 'gen';
}

// Rewrite string predicates so PG reproduces MySQL's ci (and per-collation
// accent) semantics. Runs on literal-PROTECTED sql, so a placeholder operand
// is a literal and is folded as a literal.
//   <col> [NOT] LIKE <rhs>   -> fold(col) [NOT] LIKE fold(rhs)
//   <col> = | <> | != <rhs>  -> fold(col) = | <> | != fold(rhs)
// Only fires when the LEFT operand resolves to a known column.
var _PRED_RE = /([A-Za-z_]\w*\.[A-Za-z_]\w*)\s*(NOT\s+LIKE|LIKE|<=>|<>|!=|=)\s*(\u0001L\d+\u0001|\?|[A-Za-z_]\w*\.[A-Za-z_]\w*)/gi;

function translateCollation(sql) {
    var amap = aliasMap(sql);
    return sql.replace(_PRED_RE, function (whole, lhs, op, rhs) {
        var cls = collationClass(lhs, amap);
        if (!cls) { return whole; }             // UNRESOLVED -> untouched
        // Only fold the RHS when it is a literal/placeholder or another known
        // string column; a mismatched-class column pair is left alone rather
        // than silently coerced to one side's semantics.
        var rhsIsCol = /^[A-Za-z_]\w*\.[A-Za-z_]\w*$/.test(rhs);
        if (rhsIsCol) {
            var rcls = collationClass(rhs, amap);
            if (rcls !== cls) { return whole; }
        }
        var o = op.toUpperCase().replace(/\s+/g, ' ');
        // <=> is MySQL null-safe equality; folding it would change NULL
        // semantics, so leave it entirely.
        if (o === '<=>') { return whole; }
        return foldExpr(lhs, cls) + ' ' + o + ' ' + foldExpr(rhs, cls);
    });
}

// ---- ORDER BY per-collation fold (P6, 2026-07-28) -------------------------
// PR #1783 folded string PREDICATES (WHERE) but left ORDER BY alone. MariaDB
// SORTS case-insensitively too; the `arbimon` PG copy is C.UTF-8, so it sorts
// by byte value ('#Birds' before '#bird'; MariaDB puts it after).
//
// This is NOT cosmetic when the query is paginated: the ordering decides WHICH
// rows land on the page. MEASURED on the exact post-#1783 translated shape vs
// the MariaDB master, tags.search at the app's real LIMIT 20:
//     term '%owl%' -> 6 of 20 rows LOST (and 6 wrong rows shown)
//     term '%ird%' / '%ana%' -> 1 of 20
// With this fold: 0 differences on every term tested (12 random terms x 40-row
// sequences, DESC, mixed string+numeric keys, and both collation classes).
// It fails OPEN (a full-looking page of wrong rows), so DB_PG_FALLBACK cannot
// catch it -- same signature as the collation class itself.
//
// SCOPE, deliberately narrow (fail-safe mirrors translateCollation):
//   - only a sort key that is EXACTLY a qualified `alias.column` (with an
//     optional ASC/DESC) is folded. Bare columns are UNRESOLVED (5 bare names
//     are ambiguous across the two collation classes) and expressions are left
//     alone -- both reproduce today's behaviour, which the census reports
//     honestly.
//   - the column must resolve via the SAME generated table.column map and be
//     non-enum (a fold on a PG enum is a hard type error).
//
// COST: negligible on real shapes. An unfiltered whole-table sort would lose
// its index (sites: index-scan cost 5.05 -> sort cost 4794), but every live
// query filters first (project_id), where the plan is IDENTICAL apart from
// ~0.4% (6.88 -> 6.93, same Index Scan on sites__project_id). Both folds are
// translate(lower()) and both functions are IMMUTABLE, so an expression index
// is available if a hot unfiltered sort ever appears.
//
// NOT FIXED HERE (documented, needs an app change): where the sort key has
// TIES and the query is paginated, page boundaries stay underdetermined on
// both engines -- measured, 2 of 8 common tag terms straddle a tie at row
// 20/21. A tiebreak column in the app's ORDER BY is the only remedy and it
// would change MariaDB's output too.
//
// NULL PLACEMENT (armed 2026-08-06 — the §6 latent trap went LIVE): MySQL
// sorts NULLs first ASC / last DESC; PG is the OPPOSITE. The W9/D4 zero-date
// conversion minted ~665K recordings.datetime NULLs on PG (MariaDB holds
// '0000-00-00' zero-dates, which sort as the SMALLEST value — i.e. LAST in
// DESC — while PG's NULLs sort FIRST in DESC): measured live on site 35416,
// the zero-date row leads page 1 on PG and trails the list on MariaDB
// (census hash 3fde2630, ordering_only n=9 and climbing). datetime_utc
// carries 16.4M NULLs — same mechanism, wider surface. THE RULE: for a
// qualified sort key that resolves (via aliasMap) to a column in
// NULLABLE_COLS, emit the MySQL placement explicitly — ASC -> NULLS FIRST,
// DESC -> NULLS LAST. NOT-NULL keys get NO clause (plan-preserving: the
// default ASC index remains usable; measured 3ms -> 185ms worst-case when a
// clause forces a sort on a 154K-recording site — acceptable only because it
// applies ONLY where NULLs can actually appear). Zero-date == NULL ordering
// equivalence: both are the extreme "smallest/absent" value, so MySQL's
// zero-date-last-in-DESC == PG's NULLS LAST placement — verified live on
// 35416 (byte-identical page after the clause). G1 (DISTINCT: ORDER BY
// expression must be in the select list — a bare column with NULLS
// FIRST/LAST is still the selected expression, so the clause is legal;
// verified live) and G2 (set-op scope) are inherited: this rule runs inside
// the same clause walk, after the same guards.
// NULLABLE_COLS is GENERATED — do not hand-edit. Source: live arbimon (PG)
// information_schema.columns is_nullable='YES' (PG is the truth for 6.4
// read semantics). Regenerate: data-stores/arbimon-pg/tools/gen-nullable-map.sh
// (rfcx-local). A schema migration adding a NULLABLE column must regenerate
// this map in the SAME change (mirror of the collation-map rule).
var NULLABLE_COLS = {
    'audio_event_detections_clustering.aed_number': 1,
    'audio_event_detections_clustering.songtype_id': 1,
    'audio_event_detections_clustering.species_id': 1,
    'audio_event_detections_clustering.uri_param': 1,
    'audio_event_detections_clustering.validated': 1,
    'batch_insert_state.updated_at': 1,
    'cached_metrics.expires_at': 1,
    'classification_results.max_vector_value': 1,
    'classification_results.min_vector_value': 1,
    'job_params_audio_event_clustering.date_created': 1,
    'job_params_audio_event_detection_clustering.aeds_detected': 1,
    'job_params_audio_event_detection_clustering.date_created': 1,
    'job_params_classification.playlist_id': 1,
    'job_params_soundscape.playlist_id': 1,
    'job_params_training.trained_model_id': 1,
    'job_params_training.training_set_id': 1,
    'job_params_training.validation_set_id': 1,
    'job_tasks.args': 1,
    'job_tasks.remark': 1,
    'jobs.date_created': 1,
    'models.threshold': 1,
    'mysql2pg_delta_state.watermark': 1,
    'mysql2pg_load_state.watermark': 1,
    'mysql2pg_reverse_state.last_rows': 1,
    'mysql2pg_reverse_state.last_run': 1,
    'mysql2pg_reverse_state.watermark': 1,
    'pattern_matching_rois.consensus_validated': 1,
    'pattern_matching_rois.denorm_recording_date': 1,
    'pattern_matching_rois.denorm_recording_datetime': 1,
    'pattern_matching_rois.denorm_site_id': 1,
    'pattern_matching_rois.expert_validated': 1,
    'pattern_matching_rois.expert_validation_user_id': 1,
    'pattern_matching_rois.score': 1,
    'pattern_matching_rois.uri_param2': 1,
    'pattern_matching_rois.validated': 1,
    'pattern_matching_validations.validated': 1,
    'pattern_matchings.job_id': 1,
    'pattern_matchings.playlist_id': 1,
    'pattern_matchings.template_id': 1,
    'playlists.metadata': 1,
    'playlists.total_recordings': 1,
    'playlists.uri': 1,
    'projects.country': 1,
    'projects.created_at': 1,
    'projects.deleted_at': 1,
    'projects.deleted_by': 1,
    'projects.external_id': 1,
    'projects.state': 1,
    'projects.updated_at': 1,
    'recording_tags.datetime': 1,
    'recording_tags.f0': 1,
    'recording_tags.f1': 1,
    'recording_tags.site_id': 1,
    'recording_tags.t0': 1,
    'recording_tags.t1': 1,
    'recording_validations.created_at': 1,
    'recording_validations.present': 1,
    'recording_validations.updated_at': 1,
    'recordings.archived_at': 1,
    'recordings.archived_by': 1,
    'recordings.bit_rate': 1,
    'recordings.datetime': 1,
    'recordings.datetime_utc': 1,
    'recordings.duration': 1,
    'recordings.file_size': 1,
    'recordings.filename': 1,
    'recordings.meta': 1,
    'recordings.precision': 1,
    'recordings.sample_encoding': 1,
    'recordings.sample_rate': 1,
    'recordings.samples': 1,
    'recordings.upload_time': 1,
    'recordings_deleted.duration': 1,
    'recordings_errors.error': 1,
    'recordings_export_parameters.created_at': 1,
    'recordings_export_parameters.error': 1,
    'recordings_export_parameters.processed_at': 1,
    'requeue_release_plan.analysis_name': 1,
    'requeue_release_plan.date_created': 1,
    'requeue_release_plan.job_id': 1,
    'requeue_release_plan.job_type_id': 1,
    'requeue_release_plan.passes_floor': 1,
    'requeue_release_plan.playlist_exists': 1,
    'requeue_release_plan.playlist_id': 1,
    'requeue_release_plan.project_id': 1,
    'requeue_release_plan.recs': 1,
    'requeue_release_plan.user_id': 1,
    'sites.alt': 1,
    'sites.country_code': 1,
    'sites.created_at': 1,
    'sites.deleted_at': 1,
    'sites.external_id': 1,
    'sites.first_recording_at': 1,
    'sites.last_recording_at': 1,
    'sites.lat': 1,
    'sites.lon': 1,
    'sites.rec_count_updated_at': 1,
    'sites.token_created_on': 1,
    'sites.updated_at': 1,
    'soundscape_regions.sample_playlist_id': 1,
    'soundscape_regions.threshold': 1,
    'soundscape_regions.threshold_type': 1,
    'soundscapes.date_created': 1,
    'soundscapes.frequency': 1,
    'soundscapes.threshold': 1,
    'soundscapes.uri': 1,
    'soundscapes.visual_max_value': 1,
    'species.biotab_id': 1,
    'species.code_name': 1,
    'species.created_at': 1,
    'species.defined_by': 1,
    'species.description': 1,
    'species.family_id': 1,
    'species.image': 1,
    'species.updated_at': 1,
    'support_aedc_dedupe2_backup_20260806.aed_id': 1,
    'support_aedc_dedupe2_backup_20260806.aed_number': 1,
    'support_aedc_dedupe2_backup_20260806.frequency_max': 1,
    'support_aedc_dedupe2_backup_20260806.frequency_min': 1,
    'support_aedc_dedupe2_backup_20260806.job_id': 1,
    'support_aedc_dedupe2_backup_20260806.recording_id': 1,
    'support_aedc_dedupe2_backup_20260806.songtype_id': 1,
    'support_aedc_dedupe2_backup_20260806.species_id': 1,
    'support_aedc_dedupe2_backup_20260806.time_max': 1,
    'support_aedc_dedupe2_backup_20260806.time_min': 1,
    'support_aedc_dedupe2_backup_20260806.uri_param': 1,
    'support_aedc_dedupe2_backup_20260806.uri_vector': 1,
    'support_aedc_dedupe2_backup_20260806.validated': 1,
    'support_aedc_dedupe_backup_20260806.aed_id': 1,
    'support_aedc_dedupe_backup_20260806.aed_number': 1,
    'support_aedc_dedupe_backup_20260806.frequency_max': 1,
    'support_aedc_dedupe_backup_20260806.frequency_min': 1,
    'support_aedc_dedupe_backup_20260806.job_id': 1,
    'support_aedc_dedupe_backup_20260806.recording_id': 1,
    'support_aedc_dedupe_backup_20260806.songtype_id': 1,
    'support_aedc_dedupe_backup_20260806.species_id': 1,
    'support_aedc_dedupe_backup_20260806.time_max': 1,
    'support_aedc_dedupe_backup_20260806.time_min': 1,
    'support_aedc_dedupe_backup_20260806.uri_param': 1,
    'support_aedc_dedupe_backup_20260806.uri_vector': 1,
    'support_aedc_dedupe_backup_20260806.validated': 1,
    'support_aedc_rerun_stale_backup_20260806.aed_id': 1,
    'support_aedc_rerun_stale_backup_20260806.aed_number': 1,
    'support_aedc_rerun_stale_backup_20260806.frequency_max': 1,
    'support_aedc_rerun_stale_backup_20260806.frequency_min': 1,
    'support_aedc_rerun_stale_backup_20260806.job_id': 1,
    'support_aedc_rerun_stale_backup_20260806.recording_id': 1,
    'support_aedc_rerun_stale_backup_20260806.songtype_id': 1,
    'support_aedc_rerun_stale_backup_20260806.species_id': 1,
    'support_aedc_rerun_stale_backup_20260806.time_max': 1,
    'support_aedc_rerun_stale_backup_20260806.time_min': 1,
    'support_aedc_rerun_stale_backup_20260806.uri_param': 1,
    'support_aedc_rerun_stale_backup_20260806.uri_vector': 1,
    'support_aedc_rerun_stale_backup_20260806.validated': 1,
    'support_ts_repair_8799_backup.captured_at': 1,
    'support_ts_repair_8799_backup.old_datetime': 1,
    'support_ts_repair_8799_backup.old_datetime_utc': 1,
    'support_ts_repair_8799_backup.recording_id': 1,
    'templates.date_created': 1,
    'templates.deleted': 1,
    'templates.source_project_id': 1,
    'templates.uri': 1,
    'templates.user_id': 1,
    'tmp_c166120.aed_id': 1,
    'tmp_cl_out.aed_id': 1,
    'tmp_cl_out.job_id': 1,
    'tmp_shard_ctl.aed_id': 1,
    'tmp_shard_ctl.job_id': 1,
    'tmp_shard_ids_20260806.aed_id': 1,
    'tmp_shard_ids_20260806.job_id': 1,
    'training_set_roi_set_data.uri': 1,
    'training_sets.date_created': 1,
    'training_sets.metadata': 1,
    'training_sets.source_project_id': 1,
    'user_account_support_request.expires': 1,
    'user_account_support_request.params': 1,
    'user_account_support_request.user_id': 1,
    'user_account_support_type.max_lifetime': 1,
    'users.created_on': 1,
    'users.disabled_until': 1,
    'users.last_login': 1,
    'users.rfcx_id': 1,
};

// MySQL null placement for a sort key: ASC (implicit or explicit) -> NULLS
// FIRST; DESC -> NULLS LAST. `dir` is the raw direction suffix ('' = ASC).
function mysqlNullPlacement(dir) {
    return /\bDESC\b/i.test(dir || '') ? ' NULLS LAST' : ' NULLS FIRST';
}
var _ORDERBY_CLAUSE_RE = /\border\s+by\b/gi;
var _SORTKEY_RE = /^([A-Za-z_]\w*\.[A-Za-z_]\w*)(\s+(?:ASC|DESC))?$/i;
// Clause terminators at the ORDER BY's own paren depth.
var _ORDERBY_END_RE = /^(LIMIT|OFFSET|UNION|INTERSECT|EXCEPT|FOR|INTO|FETCH|WINDOW|HAVING)$/i;

// Find the extent of an ORDER BY clause starting at `from` (index just past
// the keyword). Ends at a depth-0 terminator keyword, an unbalanced ')'
// (i.e. the enclosing subquery closing), a ';', or end of string.
function orderByExtent(sql, from) {
    var depth = 0, i = from, word = '', wordStart = -1;
    for (; i < sql.length; i++) {
        var ch = sql[i];
        if (ch === '(') { depth++; word = ''; wordStart = -1; continue; }
        if (ch === ')') {
            if (depth === 0) { return i; }   // closes the enclosing subquery
            depth--; word = ''; wordStart = -1; continue;
        }
        if (ch === ';') { return i; }
        if (/[A-Za-z_]/.test(ch)) {
            if (wordStart < 0) { wordStart = i; word = ''; }
            word += ch;
            continue;
        }
        if (word && depth === 0 && _ORDERBY_END_RE.test(word)) { return wordStart; }
        word = ''; wordStart = -1;
    }
    if (word && depth === 0 && _ORDERBY_END_RE.test(word)) { return wordStart; }
    return sql.length;
}

// SELF-REVIEW GUARDS (found by running the fix against live PG before merge --
// the fix contained the exact defect class it exists to prevent, cf. #1780).
// Two PG rules make a FOLDED sort key a HARD ERROR where the bare column works:
//
//  (G1) SELECT DISTINCT: "for SELECT DISTINCT, ORDER BY expressions must
//       appear in select list" (42P10, reproduced live). `ORDER BY t.tag` is
//       legal because the column is selected; the translate() wrapper is a new
//       expression and is not.
//  (G2) UNION/INTERSECT/EXCEPT: a trailing ORDER BY binds to the SET-OPERATION
//       output, where only output column names/ordinals are in scope. A
//       qualified operand raises "missing FROM-clause entry for table t"
//       (42P01, reproduced live).
//
// Both shapes are live in this app (6 SELECT DISTINCT sites; UNION builders in
// jobs.js/projects.js/recordings.js incl. the W5 jobs-progress template), so
// both guards are load-bearing, not theoretical. In both cases we leave the
// ORDER BY untouched -- today's behaviour, which the census reports honestly.
//
// G2 is applied per-clause (a set-operation keyword ANYWHERE at depth 0 before
// the clause disables it) rather than whole-query, so an ORDER BY inside a
// parenthesised UNION BRANCH -- which is scoped to that branch and is safe --
// still folds.
var _SETOP_RE = /\b(UNION|INTERSECT|EXCEPT)\b/i;
var _DISTINCT_RE = /\bSELECT\s+DISTINCT\b/i;

// Is there a set-operation keyword at paren-depth 0 in sql[0..end)?
function hasTopLevelSetOp(sql, end) {
    var depth = 0, word = '', i;
    for (i = 0; i < end; i++) {
        var ch = sql[i];
        if (ch === '(') { depth++; word = ''; continue; }
        if (ch === ')') { depth--; word = ''; continue; }
        if (/[A-Za-z]/.test(ch)) { word += ch; continue; }
        if (word && depth === 0 && _SETOP_RE.test(word)) { return true; }
        word = '';
    }
    return !!(word && depth === 0 && _SETOP_RE.test(word));
}

function translateOrderByCollation(sql) {
    // G1: whole-query -- a DISTINCT anywhere makes folding unsafe for the
    // clause that belongs to it, and correlating which SELECT owns which
    // ORDER BY is not worth the risk. Skip the query entirely (fail-safe).
    if (_DISTINCT_RE.test(sql)) { return sql; }
    var amap = aliasMap(sql);
    var out = '', cursor = 0;
    _ORDERBY_CLAUSE_RE.lastIndex = 0;
    var m;
    while ((m = _ORDERBY_CLAUSE_RE.exec(sql)) !== null) {
        var clauseStart = m.index + m[0].length;
        var clauseEnd = orderByExtent(sql, clauseStart);
        // G2: a set-operation at depth 0 before this clause means the clause
        // binds to the set-operation output -> qualified names are out of
        // scope. Leave it untouched.
        if (hasTopLevelSetOp(sql, m.index)) {
            _ORDERBY_CLAUSE_RE.lastIndex = clauseEnd;
            continue;
        }
        var clause = sql.slice(clauseStart, clauseEnd);
        var keys = splitTopArgs(clause);
        var rebuilt = keys.map(function (k) {
            var km = _SORTKEY_RE.exec(k.trim());
            if (!km) { return k.trim(); }                 // expression -> untouched
            // NULL-placement leg (2026-08-06): a qualified key resolving to a
            // NULLABLE column gets MySQL's explicit placement. Independent of
            // the collation fold — a nullable key may need placement without
            // being a string, and vice versa. UNRESOLVED alias -> untouched
            // (fail-safe, same posture as the fold).
            var nulls = '';
            var parts = km[1].split('.');
            var tbl = amap[parts[0].toLowerCase()];
            var colKey = tbl ? (tbl + '.' + parts[1].toLowerCase()) : null;
            if (colKey && NULLABLE_COLS[colKey]) {
                nulls = mysqlNullPlacement(km[2]);
            }
            // ORDER-BY-only exemptions (COLLATION_ORDER_EXACT): skip the fold
            // (it defeats the per-site index walk) but KEEP the NULL placement.
            var cls = (colKey && COLLATION_ORDER_EXACT[colKey]) ? null : collationClass(km[1], amap);
            if (!cls) {
                // no collation fold; still emit placement when needed
                return nulls ? (km[1] + (km[2] || '') + nulls) : k.trim();
            }
            return foldExpr(km[1], cls) + (km[2] || '') + nulls;
        }).join(', ');
        // Preserve the original leading/trailing whitespace shape.
        var lead = /^\s*/.exec(clause)[0];
        var trail = /\s*$/.exec(clause)[0];
        out += sql.slice(cursor, clauseStart) + lead + rebuilt + trail;
        cursor = clauseEnd;
        _ORDERBY_CLAUSE_RE.lastIndex = clauseEnd;
    }
    return out + sql.slice(cursor);
}

// ---- bare-`=` + IN-list collation fold (P6 =-surface, 2026-07-28) ----------
// The =-surface enumeration (runbooks/mysql2pg-p6-eq-surface-enumeration-
// 2026-07-28.md) found ~9 live read shapes comparing string columns WITHOUT an
// alias qualifier (create-time dup-checks: sites.js:214, tags.js:192,
// templates.js:266, training_sets.js:97, models.js:239, soundscapes.js:471)
// plus 2 alias-qualified IN-list filters (recordings.js:1865, jobs.js:570).
// The deployed qualified fold cannot see bare operands (5 bare names are
// ambiguous across collation classes), so at 6.4 these compare case-
// sensitively: a dup-check misses a case-variant existing row -> duplicate
// creation / tag fragmentation (1918 live case-variant tag groups measured).
//
// RESOLUTION RULE for a bare column: FROM-NARROWING. Collect the query's
// FROM/JOIN tables (the aliasMap's table set); find which carry this column
// in the generated map; if EXACTLY ONE COLLATION CLASS results (and no enum
// membership), fold — else leave untouched. `FROM sites WHERE name = ?` is
// unambiguous (only sites.name is in scope) even though `name` spans 27
// columns schema-wide. Never guess.
//
// STATEMENT GATE (load-bearing, not paranoia): translate() has one caller
// that is NOT SELECT-gated — the EXPORTS_DB_ENGINE path (dbpool.js). In an
// UPDATE, a bare `col = ?` inside SET is an ASSIGNMENT; folding it would
// corrupt a write. The bare/IN passes therefore run ONLY when the statement
// is a SELECT/WITH. (The qualified pass keeps its deployed behaviour: an
// alias-qualified operand cannot appear in a SET clause of our SQL corpus,
// and changing its gating would alter shipped behaviour.)
var _SELECT_STMT_RE = /^\s*\(*\s*(SELECT|WITH)\b/i;

// Which collation class does a BARE column resolve to under this query's
// FROM set? null = ambiguous/unknown/enum -> untouched.
function resolveBareColumn(col, amap) {
    var name = String(col).toLowerCase();
    var tables = {};
    for (var k in amap) { tables[amap[k]] = true; }
    var cls = null, hits = 0;
    for (var t in tables) {
        var key = t + '.' + name;
        if (!COLLATION_KNOWN[key]) { continue; }
        if (COLLATION_ENUM[key]) { return null; }   // enum in scope -> never fold
        if (COLLATION_EXACT[key]) { return null; }  // exact-match column in scope -> never fold
        var c = COLLATION_SV[key] ? 'sv' : 'gen';
        hits++;
        if (cls === null) { cls = c; }
        else if (cls !== c) { return null; }        // two classes in scope -> ambiguous
    }
    return hits > 0 ? cls : null;
}

// bare `col <op> <literal|placeholder>` — the RHS is restricted to literals/
// placeholders (bare col-to-col equality is not in the measured surface and
// resolving BOTH sides bare doubles the ambiguity risk). The leading guard
// excludes `.` (qualified operands already handled), `\u0001` (literal
// tokens), quotes, and word chars.
var _BARE_PRED_RE = /(^|[^\w.\u0001'"`])([A-Za-z_]\w*)\s*(NOT\s+LIKE|LIKE|<>|!=|=)\s*(\u0001L\d+\u0001|\?)/gi;
// SQL keywords that can precede `=`-looking text but are never columns.
var _BARE_STOP = /^(SELECT|WHERE|AND|OR|NOT|ON|BY|AS|IN|IS|NULL|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END|LIMIT|OFFSET|SET|VALUES|FROM|JOIN|HAVING|GROUP|ORDER|UNION|ALL|DISTINCT|EXISTS|IF|COALESCE|CONCAT|COUNT|SUM|MIN|MAX|AVG|LEFT|RIGHT|INNER|OUTER|CROSS|USING|INTERVAL|TRUE|FALSE|DIV|MOD)$/i;

function translateBareCollation(sql) {
    if (!_SELECT_STMT_RE.test(sql)) { return sql; }
    var amap = aliasMap(sql);
    return sql.replace(_BARE_PRED_RE, function (whole, lead, col, op, rhs) {
        if (_BARE_STOP.test(col)) { return whole; }
        var cls = resolveBareColumn(col, amap);
        if (!cls) { return whole; }                 // UNRESOLVED -> untouched
        var o = op.toUpperCase().replace(/\s+/g, ' ');
        return lead + foldExpr(col, cls) + ' ' + o + ' ' + foldExpr(rhs, cls);
    });
}

// `col [NOT] IN (member, member, ...)` — qualified OR bare LHS, every member a
// literal/placeholder. A subquery RHS (contains SELECT) is left untouched.
// mysql.format expands array placeholders BEFORE translate, so live IN-lists
// arrive as literal lists here.
var _IN_LHS_RE = /([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)(\s+NOT)?\s+IN\s*\(/gi;

function translateInCollation(sql) {
    if (!_SELECT_STMT_RE.test(sql)) { return sql; }
    var amap = aliasMap(sql);
    var search = 0;
    for (var guard = 0; guard < 200; guard++) {
        _IN_LHS_RE.lastIndex = search;
        var m = _IN_LHS_RE.exec(sql);
        if (!m) { break; }
        var lhs = m[1], neg = m[2] || '';
        var openIdx = m.index + m[0].length - 1;
        var depth = 0, endIdx = -1;
        for (var i = openIdx; i < sql.length; i++) {
            if (sql[i] === '(') { depth++; }
            else if (sql[i] === ')') { depth--; if (depth === 0) { endIdx = i; break; } }
        }
        if (endIdx < 0) { break; }
        var inner = sql.slice(openIdx + 1, endIdx);
        search = endIdx + 1;
        if (/\bSELECT\b/i.test(inner)) { continue; }         // subquery -> untouched
        var cls;
        if (lhs.indexOf('.') >= 0) { cls = collationClass(lhs, amap); }
        else {
            if (_BARE_STOP.test(lhs)) { continue; }
            cls = resolveBareColumn(lhs, amap);
        }
        if (!cls) { continue; }                              // UNRESOLVED -> untouched
        var members = splitTopArgs(inner);
        var ok = members.length > 0 && members.every(function (a) {
            return /^(\u0001L\d+\u0001|\?)$/.test(a.trim());
        });
        if (!ok) { continue; }                               // non-literal member -> untouched
        var folded = members.map(function (a) { return foldExpr(a.trim(), cls); }).join(', ');
        var repl = foldExpr(lhs, cls) + neg + ' IN (' + folded + ')';
        sql = sql.slice(0, m.index) + repl + sql.slice(endIdx + 1);
        search = m.index + repl.length;
    }
    return sql;
}

// FORCE INDEX (idx) — MySQL optimizer hint, no PG equivalent; strip it.
function stripIndexHints(sql) {
    return sql.replace(/\s+(FORCE|USE|IGNORE)\s+INDEX\s*\([^)]*\)/gi, '');
}

// `expr AS 'alias'`  ->  `expr AS "alias"`  (MySQL string-quoted column alias;
// PG requires a double-quoted identifier). Keyed on AS + a protected literal
// that is a plain identifier; anything else is left untouched.
function fixQuotedAliases(sql, store) {
    return sql.replace(/\b(AS)\s+\u0001L(\d+)\u0001/gi, function (whole, kw, n) {
        var raw = store[parseInt(n, 10)];
        if (raw == null) { return whole; }
        var ident = raw.slice(1, -1);
        // MySQL permits string-literal aliases, including spaces. PG requires
        // identifier aliases. Convert `AS 'Playlist Name'` / `AS "Playlist Name"`
        // to a quoted identifier; remaining non-alias double-quoted literals are
        // converted later by restoreLiteralsPg into PG string literals.
        ident = ident.replace(/""/g, '"');
        return kw + ' "' + ident.replace(/"/g, '""') + '"';
    });
}

function translate(mysqlSql) {
    var store = [];
    var s = protectLiterals(mysqlSql, store);
    s = stripIndexHints(s);
    s = fixQuotedAliases(s, store);
    s = translateBackticks(s);
    s = stripSchemaQualifier(s);
    s = translateLimitOffset(s);
    s = translateFunctions(s, store);
    s = translateCollation(s);
    s = translateBareCollation(s);
    s = translateInCollation(s);
    s = translateOrderByCollation(s);
    s = translateExtremeSubqueryNulls(s);
    s = restoreLiteralsPg(s, store);
    return s;
}

// ---- NULL-placement on a LIMIT-1 extreme subquery (P7 debt #9, 2026-09-10) --
// THE PROBLEM, measured on the PG leader under the 09-10 PM wave: the
// sites-list per-site first/last subqueries (projects.js getProjectSites
// compute.rec_count; the recordings.js date_range fast path is the same
// shape) are
//     (SELECT r.datetime FROM recordings r WHERE r.site_id = s.site_id
//        AND r.archived_at IS NULL ORDER BY r.datetime ASC LIMIT 1)
// which the app wrote as ONE index dive on (site_id, datetime) -- 221.7 s ->
// 0.5 s on MariaDB (projects.js:257). The NULL-placement leg above then
// appends `NULLS FIRST` (recordings.datetime is nullable on PG: 598,970 W9
// zero-date rows across 245 sites), and PG cannot serve `ORDER BY datetime
// NULLS FIRST LIMIT 1` from a btree whose order is NULLS LAST: it reads every
// row of the site through recordings__site_id and top-N-heapsorts them.
// Measured back to back on the leader, one 8-site project: 346 ms / 89 ms
// with the clause, 4.2 ms without (4,484 buffer reads per site vs 34). It
// scales with the site's row count, so the 950-site / 350k-recording
// projects cancel at the 8 s route timeout -- hash ae28794138b7d016, 71
// cancels in 3 days, 14 across the 09-10 wave, and at P7 a user-facing
// error with no fail-open.
//
// THE FIX keeps MySQL's semantics EXACTLY and gives PG two index dives.
// For `ORDER BY k ASC NULLS FIRST LIMIT 1` selecting k itself, the MySQL
// answer is: a NULL if any qualifying row has k IS NULL, else MIN(k). For
// `DESC NULLS LAST LIMIT 1`: MAX(k) over non-NULL rows, else NULL. Both are
//   CASE WHEN EXISTS(<same WHERE> AND k IS NULL) THEN NULL
//        ELSE (<same subquery> AND k IS NOT NULL ORDER BY k ASC LIMIT 1) END
// (the DESC form needs no EXISTS: a NULL is only the answer when NO non-NULL
// row exists, which the second dive returns as NULL by itself). The added
// `k IS NULL` / `k IS NOT NULL` predicates are btree-indexable on
// (site_id, datetime) -- planned live: InitPlan 1 index dive cost 28,
// InitPlan 2 cost 1.22.
//
// SCOPE, deliberately narrow (fail-safe like every other pass here): only a
// PARENTHESISED scalar subquery of exactly the shape
//     (SELECT <a>.<col> FROM <tbl> <a> WHERE <preds> ORDER BY <a>.<col>
//        [ASC|DESC] NULLS FIRST|LAST LIMIT 1)
// with a single selected expression equal to the sort key, no GROUP BY /
// DISTINCT / JOIN / nested parentheses inside the WHERE, and a bare LIMIT 1.
// Anything else is left exactly as the placement leg emitted it.
var _EXTREME_SUBQ_RE = new RegExp(
    '\\(\\s*SELECT\\s+([A-Za-z_]\\w*\\.[A-Za-z_]\\w*)\\s+FROM\\s+([A-Za-z_]\\w*)\\s+(?:AS\\s+)?([A-Za-z_]\\w*)\\s+' +
    'WHERE\\s+([^()]+?)\\s+ORDER\\s+BY\\s+([A-Za-z_]\\w*\\.[A-Za-z_]\\w*)(\\s+(?:ASC|DESC))?\\s+NULLS\\s+(FIRST|LAST)\\s+LIMIT\\s+1\\s*\\)',
    'gi');

function translateExtremeSubqueryNulls(sql) {
    return sql.replace(_EXTREME_SUBQ_RE, function (whole, selCol, tbl, alias, preds, sortKey, dir, placement) {
        if (selCol.toLowerCase() !== sortKey.toLowerCase()) { return whole; }
        if (sortKey.split('.')[0].toLowerCase() !== alias.toLowerCase()) { return whole; }
        if (/\b(GROUP|DISTINCT|JOIN|UNION|HAVING)\b/i.test(preds)) { return whole; }
        var isDesc = /\bDESC\b/i.test(dir || '');
        var pl = placement.toUpperCase();
        // Only the MySQL-shaped pairs the placement leg emits: ASC+FIRST, DESC+LAST.
        if ((isDesc && pl !== 'LAST') || (!isDesc && pl !== 'FIRST')) { return whole; }
        var from = 'FROM ' + tbl + ' ' + alias + ' WHERE ' + preds;
        var nonNull = '(SELECT ' + selCol + ' ' + from + ' AND ' + sortKey + ' IS NOT NULL ORDER BY ' +
                      sortKey + (isDesc ? ' DESC' : ' ASC') + ' LIMIT 1)';
        if (isDesc) { return nonNull; }
        return '(CASE WHEN EXISTS (SELECT 1 ' + from + ' AND ' + sortKey + ' IS NULL) THEN NULL ELSE ' +
               nonNull + ' END)';
    });
}

// ------------------------------------------------------------ emit helpers

function emit(prefix, obj) {
    try { process.stdout.write(prefix + JSON.stringify(obj) + '\n'); } catch (e) { /* never break app */ }
}
function emitDivergence(obj) { emit(DIV_PREFIX, obj); }
function emitStat(obj) { emit(STAT_PREFIX, obj); }

// ------------------------------------------------------------ pg pool (lazy)

var _pool = null;
var _poolFailed = false;

function getPool() {
    // OUTSIDE the try/catch ON PURPOSE. The catch below swallows any init
    // failure into a `pool_init_failed` stat and returns null -- which is
    // exactly the silent-degradation shape this guard exists to prevent. A
    // misconfigured PG_SHADOW_USER must propagate, not become a stat line.
    assertPgUserConfigured();
    if (_poolFailed) { return null; }
    if (_pool) { return _pool; }
    try {
        var pglib = require('pg'); // lazy: never required in mysql (inert) mode
        // CRITICAL dialect parity: the app's mysql driver runs timezone:'Z',
        // so MariaDB `datetime` (naive) parses as UTC. node-postgres parses
        // `timestamp without time zone` (OID 1114) in PROCESS-LOCAL time,
        // which skews every datetime by the host UTC offset (measured +4h on
        // EDT — the first live e2e finding). Parse 1114 as UTC to match.
        pglib.types.setTypeParser(1114, function (str) {
            return str === null ? null : new Date(str.replace(' ', 'T') + 'Z');
        });
        // CRITICAL type parity #2 (the 2026-09-07 6.4 flip rollback): node-pg
        // returns int8 (OID 20) as a JS STRING (it refuses to lose precision
        // silently), while the mysql driver returns BIGINT as a JS NUMBER
        // (supportBigNumbers is off). 190 arbimon columns are bigint on PG —
        // every *_id PK/FK (projects, sites, recordings, jobs, users...) — so
        // under DB_ENGINE=pg `req.project.project_id` arrived as "5358" and
        // every `typeof x !== 'number'` guard (projects.js:215/939/1318) and
        // strict `===` on ids failed: 8 user-facing 500s in 110 s, rolled back.
        // The shadow could NOT catch this: normVal() deliberately bridges
        // numeric strings to numbers before comparing (same blind spot as the
        // column-case trap). Parse int8 as Number. Safe: the largest bigint in
        // arbimon2 is pattern_matching_rois.pattern_matching_roi_id ~1.14e9
        // (measured 2026-09-07), 6 orders of magnitude below 2^53; the
        // MariaDB source columns are the same width so the app already
        // assumed Number-safe ids. Values beyond 2^53 are impossible for this
        // schema's generated keys and would already be broken on the mysql
        // side. Registered on the shared type map, so the SHADOW comparator
        // now sees the same shape the route path serves.
        pglib.types.setTypeParser(20, function (str) {
            return str === null ? null : Number(str);
        });
        // Sibling class, found by the 09-08 pre-flip driver-type enumeration:
        // SUM(bigint) yields `numeric` (OID 1700), which node-postgres also
        // returns as a STRING; the mysql driver returns SUM as a Number.
        // Schema has ZERO numeric columns (measured), so 1700 only ever
        // arrives from aggregates over integer columns -- Number() is
        // lossless there for the same 2^53 argument as int8 above. Known
        // sites: playlists.total_recordings SUM (jobs.countAnalysesExecuted,
        // AED getTotalRecInLast24Hours).
        pglib.types.setTypeParser(1700, function (str) {
            return str === null ? null : Number(str);
        });
        var Pool = pglib.Pool;
        _pool = new Pool(pgConf());
        _pool.on('error', function (err) {
            // Background idle-client errors must never crash the app.
            emitStat({ ev: 'pool_error', err: String(err && err.message || err).slice(0, 200) });
        });
        return _pool;
    } catch (e) {
        _poolFailed = true;
        emitStat({ ev: 'pool_init_failed', err: String(e && e.message || e).slice(0, 200) });
        return null;
    }
}

// ------------------------------------------------------------ counters
// Route-path counters (2026-09-08): routed = reads that entered pgReadQuery;
// routed_ok = served; fallback = a pgRouteFallback-tagged error handed back
// (surfaced to the caller since step 5). write_routed / write_ok / write_error
// for the conn adapter (a dialect-shaped one ALSO increments dialect_error so
// the gate metric sees it).
var _counters = { routed: 0, routed_ok: 0, fallback: 0,
                  dialect_error: 0, ok: 0, pg_error: 0, pg_timeout: 0,
                  write_routed: 0, write_ok: 0, write_error: 0 };

// Per-template divergence emit cap (kept: the write path's write_unmapped_insert
// line is the one remaining unbounded emitter).
var EMIT_CAP_PER_TEMPLATE = numEnv('DB_SHADOW_EMIT_CAP', 5);
var EMIT_CAP_WINDOW_MS = numEnv('DB_SHADOW_EMIT_WINDOW_MS', 600000); // 10 min
var _emitCounts = {};   // hash -> count in current window
var _emitWindowStart = Date.now();

function divergenceEmitAllowed(hash) {
    var now = Date.now();
    if (now - _emitWindowStart > EMIT_CAP_WINDOW_MS) {
        _emitCounts = {};
        _emitWindowStart = now;
    }
    var c = (_emitCounts[hash] || 0) + 1;
    _emitCounts[hash] = c;
    if (c > EMIT_CAP_PER_TEMPLATE) { return false; }
    return true;
}

function sqlText(sql) {
    if (typeof sql === 'string') { return sql; }
    if (sql && typeof sql.sql === 'string') { return sql.sql; }
    return String(sql);
}

// periodic stats heartbeat — the route path's only in-process instrument
// (2026-09-08: the pg pods went SILENT for the whole 6.4 hold when this was
// shadow-only). Carries routed / routed_ok / fallback / pg_error / pg_timeout
// / dialect_error / write_*.
var _statTimer = null;
function startStatHeartbeat() {
    if (_statTimer) { return; }
    _statTimer = setInterval(function () {
        emitStat({ ev: 'counters', c: _counters });
    }, 60000);
    if (_statTimer.unref) { _statTimer.unref(); }
}
startStatHeartbeat();

// ==================================================================
// PHASE 6.4 — `DB_ENGINE=pg` RESPONSE ROUTING (ships INERT)
// ==================================================================
// Everything below is unreachable unless DB_ENGINE=pg, which NOTHING sets
// today (stage-0 pattern: land the code dark, flip the env later under an
// operator-gated milestone). In `shadow` and `mysql` modes this section is
// dead weight of one boolean.
//
// WHY THIS IS NOT "just run the translated SQL":
//
// **THE COLUMN-CASE TRAP (measured 2026-07-27, would have broken flip day).**
// PG folds unquoted identifiers to lowercase, and the migrated arbimon schema
// is all-lowercase (`information_schema`: `typeid`, `issystemclass`). MariaDB
// returns the column's DECLARED case. So `SELECT SCC.typeId, SCC.isSystemClass`
// yields keys {typeId, isSystemClass} on MariaDB but {typeid, issystemclass}
// on PG. Any consumer reading `row.isSystemClass` silently gets `undefined`.
// Live example: app/model/soundscape-composition.js:104 branches on
// `scClass.isSystemClass` — under naive pg routing that branch inverts and the
// project-class INSERT fires for system classes.
//
// The SHADOW COULD NOT HAVE CAUGHT THIS: rowMaps() lowercases every key before
// comparing (by design, so casing noise never masks value diffs), so the
// divergence stream is structurally blind to it. Zero divergences across the
// whole clock says nothing about column casing — which is exactly why this
// needed a code read + schema measurement, not more soak time.
//
// Affected surface, MEASURED not guessed (live information_schema): 8 camelCase
// columns across 4 tables (model_types.usesSsim/usesRansac,
// project_soundscape_composition_classes.projectId/scclassId,
// recording_soundscape_composition_annotations.recordingId/scclassId,
// soundscape_composition_classes.typeId/isSystemClass) plus ~20 camelCase SQL
// aliases across 9 app/model files (`as recUri`, `as maxSiteId`, …).
//
// FIX: rebuild MySQL-shaped keys from the ORIGINAL SQL. Any identifier/alias
// carrying uppercase is mapped lower->original and re-applied to PG rows, so
// consumers see byte-identical key casing on both engines.

// DB_PG_FALLBACK (the MariaDB read-retry, OPQ-5: disarmed by default at the
// 2026-09-12 flip) was RETIRED at P7 step 5 (2026-09-20): there is no other
// engine. pgReadQuery still hands back a `pgRouteFallback`-tagged error on
// route-path failures; dbpool.js now surfaces it to the caller unchanged.

// Build lowercase -> original-case map for the MIXED-CASE identifiers in the
// source SQL. Only ever restores casing MySQL itself would have returned.
//
// SELF-REVIEW DEFECT, CAUGHT + FIXED BEFORE MERGE (2026-07-27) — keep this,
// it is the #1780 lesson repeating: the first version scanned every word in
// the raw SQL, so STRING-LITERAL CONTENTS and SQL KEYWORDS became map
// entries. Reproduced concretely:
//   SELECT j.job_id, j.completed FROM jobs j WHERE j.state = 'Completed'
// mapped completed -> 'Completed' and RENAMED the real jobs.completed result
// key to `Completed` — i.e. the exact silent key-shape corruption this
// function exists to PREVENT, introduced by the fix itself.
// Three guards now:
//   1. literals are stripped first, reusing the translator's own
//      protectLiterals() so literal text can never be scanned;
//   2. an all-UPPERCASE token is never treated as an identifier (SQL keywords
//      are written uppercase throughout this codebase; arbimon2 has ZERO
//      all-uppercase column names — verified live against
//      information_schema, count = 0). Genuine camelCase (`typeId`,
//      `isSystemClass`, `recUri`) always contains a lowercase char, so this
//      excludes keywords without excluding any real column;
//   3. only the trailing component of a qualified name is used (`SCC.typeId`
//      -> `typeId`), since that is what appears as the result key.
var _CASE_TOKEN_RE = /[A-Za-z_][A-Za-z0-9_$]*/g;
function columnCaseMap(mysqlSql) {
    var litStore = [];
    var stripped = protectLiterals(String(mysqlSql), litStore)
        .replace(/\u0001L\d+\u0001/g, ' ');   // drop literal placeholders entirely
    var map = null;
    var m;
    _CASE_TOKEN_RE.lastIndex = 0;
    while ((m = _CASE_TOKEN_RE.exec(stripped)) !== null) {
        var tok = m[0];
        var low = tok.toLowerCase();
        if (low === tok) { continue; }              // already lowercase
        if (tok === tok.toUpperCase()) { continue; } // SQL keyword, not a column
        if (!map) { map = {}; }
        if (!Object.prototype.hasOwnProperty.call(map, low)) { map[low] = tok; }
    }
    return map;
}

function restoreRowCase(rows, caseMap) {
    if (!caseMap || !rows || !rows.length) { return rows; }
    return rows.map(function (r) {
        var out = {};
        Object.keys(r).forEach(function (k) {
            var want = Object.prototype.hasOwnProperty.call(caseMap, k) ? caseMap[k] : k;
            out[want] = r[k];
        });
        return out;
    });
}

// Only statements the SAME allowlist classifier accepts may be served from PG.
// Everything else (writes, transactions, anything non-plain) stays on MariaDB.
function pgRouteEligible(sql) {
    return classify(sqlText(sql)).replayable;
}

/**
 * Execute a read on PG and return MySQL-shaped rows (6.4 response routing).
 * cb(err, rows). On any PG-side failure cb receives an error tagged
 * `pgRouteFallback: true` (kept for the `fallback` counter and for log
 * triage; since P7 step 5 dbpool.js surfaces it to the caller — there is no
 * other engine to retry on).
 */
function pgReadQuery(finalSql, cb0) {
    var text = sqlText(finalSql);
    _counters.routed++;
    // Wrap the callback once so every exit path books its outcome: a
    // pgRouteFallback sentinel = `fallback`, a served result = `routed_ok`.
    var cb = function (err, rows) {
        if (err && err.pgRouteFallback) { _counters.fallback++; }
        else if (!err) { _counters.routed_ok++; }
        return cb0(err, rows);
    };
    var pool = getPool();
    if (!pool) { return cb({ pgRouteFallback: true, message: 'pg pool unavailable' }); }
    var pgSql;
    try { pgSql = translate(text); } catch (e) {
        _counters.dialect_error++;
        emitDivergence({ v: 1, ts: new Date().toISOString(), klass: 'dialect_error',
            phase: 'translate-pg', hash: templateHash(text),
            tmpl: sqlTemplate(text).slice(0, 400),
            detail: String(e && e.message || e).slice(0, 200) });
        return cb({ pgRouteFallback: true, message: 'translate failed' });
    }
    var caseMap = columnCaseMap(text);
    pool.connect(function (err, client, release) {
        if (err) {
            _counters.pg_error++;
            emitStat({ ev: 'pg_route_connect_error',
                err: String(err && err.message || err).slice(0, 200) });
            return cb({ pgRouteFallback: true, message: 'connect failed' });
        }
        var released = false;
        var releaseOnce = function (e) {
            if (released) { return; } released = true;
            try { release(e); } catch (x) { /* pool already reclaimed it */ }
        };
        var settled = false;
        var settle = function (e, rows) {
            if (settled) { return; } settled = true;
            cb(e, rows);
        };
        // Same #1781 discipline as the shadow path: a checked-out client that
        // dies mid-query emits 'error' on ITSELF; unlistened, Node rethrows and
        // the PROCESS EXITS. Under DB_ENGINE=pg that would be a user-facing
        // outage, so the guard is mandatory here too.
        client.on('error', function (cerr) {
            _counters.pg_error++;
            emitStat({ ev: 'pg_route_client_error',
                err: String(cerr && cerr.message || cerr).slice(0, 200) });
            releaseOnce(cerr);
            settle({ pgRouteFallback: true, message: 'client error' });
        });
        // One explicit read-only tx per routed read (pgbouncer is
        // transaction-pooled); SET LOCAL scopes the timeout — and jit=off —
        // to this transaction only. jit=off rationale: see the shadow path's
        // begin string (live-only server config could revert to stock jit=on;
        // subplan-heavy routed reads would pay JIT compile inside the 8 s
        // budget).
        client.query('BEGIN READ ONLY; SET LOCAL statement_timeout=' +
                     Math.round(TIMEOUT_MS) + '; SET LOCAL jit=off;', function (gerr) {
            if (gerr) {
                try { client.query('ROLLBACK', function () { releaseOnce(); }); }
                catch (e) { releaseOnce(); }
                _counters.pg_error++;
                return settle({ pgRouteFallback: true, message: 'begin failed' });
            }
            client.query(pgSql, function (qerr, pgRes) {
                try { client.query('ROLLBACK', function () { releaseOnce(); }); }
                catch (e) { releaseOnce(); }
                if (qerr) {
                    // Connection-lifetime faults are EITHER SQLSTATE-less (the
                    // #1781 shape) or carry a Class-57/08 admin/connection code
                    // (see isConnLifetimeError + the shadow path's matching
                    // guard) — never a dialect error. This matters MORE here
                    // than on the shadow path: at 6.4 this path serves real
                    // users, so a mis-booked infra blip would both corrupt the
                    // gate metric AND look like a translator defect while the
                    // request silently falls back to MariaDB.
                    if (isConnLifetimeError(qerr)) {
                        _counters.pg_error++;
                        emitStat({ ev: 'pg_route_conn_error',
                            err: String(qerr && qerr.message || qerr).slice(0, 200),
                            pg_code: qerr && qerr.code });
                    } else if (qerr.code === '57014') {
                        _counters.pg_timeout++;
                        emitStat({ ev: 'pg_route_timeout', hash: templateHash(text) });
                    } else {
                        _counters.dialect_error++;
                        emitDivergence({ v: 1, ts: new Date().toISOString(),
                            klass: 'dialect_error', phase: 'execute-pg',
                            hash: templateHash(text), tmpl: sqlTemplate(text).slice(0, 400),
                            detail: String(qerr && qerr.message || qerr).slice(0, 240),
                            pg_code: qerr.code });
                    }
                    return settle({ pgRouteFallback: true, message: 'query failed' });
                }
                _counters.ok++;
                settle(null, restoreRowCase((pgRes && pgRes.rows) || [], caseMap));
            });
        });
    });
}

// ==================================================================
// PHASE 7 — `DB_ENGINE=pg` WRITE ROUTING: the connection adapter + shim
// ==================================================================
// Gate 4c / OPQ-4 (a) HYBRID (ruled 2026-09-11; design:
// rfcx-local runbooks/DESIGN-2026-09-11-p7-write-rehearsal.md).
//
// Until this block, PG served only the classified plain-READ fast path
// (pgReadQuery). Everything else — every write, every transaction, every
// conn-scoped query — went to MariaDB because `dbpool.getConnection()` only
// ever produced mysql connections. In `DB_ENGINE=pg` mode
// `dbpool.getConnection()` now returns the adapter below: a checked-out
// node-pg client wrapped to expose the mysql driver's surface
// (`query`/`promisedQuery`/`beginTransaction`/`commit`/`rollback`/`release`)
// so the 14 driver-API transaction sites, the 5 sqlutil.transaction/
// performTransaction sites, the START TRANSACTION site, and the 30
// direct-conn + 19 queryWithConn call sites route to PG with translation —
// the conn adapter, not `insertId`, is the rehearsal's primary subject.
//
// THE RETURNING SHIM (the other half of OPQ-4): the mysql driver answers an
// INSERT with an OkPacket carrying `insertId`; PG answers with no row at all
// unless asked. For the audited id-consuming tables (gate 4a §3: 18/18 are
// single-column GENERATED BY DEFAULT AS IDENTITY) the shim appends
// `RETURNING <pk>` and maps `rows[0].<pk>` → `result.insertId` and
// `rowCount` → `affectedRows`. An INSERT that produces NO row where one was
// expected THROWS (`PG_INSERT_NO_ROW`) — MySQL yields insertId:0 there and PG
// yields zero rows, and silently yielding `undefined` is how you write
// `templates/undefined.png` (gate 4a §3b #21). The 7 idioms a shim provably
// cannot express (`SET ?`, `FROM DUAL`, `INSERT IGNORE`, `ON DUPLICATE KEY
// ... LAST_INSERT_ID`, …) are explicit ports at the call sites — the shim
// deliberately does not attempt them; a PG parser rejects them loudly
// (42601/42P01, measured in the gate-4a re-attack), which is the correct
// failure until the port lands.
//
// INERT unless DB_ENGINE=pg: in mysql/shadow mode nothing below is reachable
// (dbpool.js gates on pgshadow.isPg before calling getWriteConnection).
// There is NO write fallback by design — the (now retired) DB_PG_FALLBACK was a READ path
// (pgReadQuery only); a failed write must surface, never silently retry on
// the other engine and fork the data.

// Tables whose INSERT sites read the driver-generated id. PK names verified
// against the replica's information_schema (gate 4a §3). An INSERT into an
// UNMAPPED table runs without RETURNING and gets {affectedRows} only — and
// emits a capped `write_unmapped_insert` divergence line, so a missed map
// entry is loud in the logs rather than a silent `undefined` insertId.
var WRITE_IDENTITY_PK = {
    jobs: 'job_id',
    pattern_matchings: 'pattern_matching_id',
    playlists: 'playlist_id',
    project_classes: 'project_class_id',
    project_news: 'news_feed_id',
    projects: 'project_id',
    recording_tags: 'recording_tag_id',
    sites: 'site_id',
    soundscape_composition_classes: 'id',
    soundscape_region_tags: 'soundscape_region_tag_id',
    soundscape_regions: 'soundscape_region_id',
    soundscape_tags: 'soundscape_tag_id',
    tags: 'tag_id',
    templates: 'template_id',
    training_set_roi_set_data: 'roi_set_data_id',
    training_sets: 'training_set_id',
    users: 'user_id',
    // --- identity tables reachable from worker / fixture / adjacent paths ---
    // Added 2026-09-11 after the gate-4c rehearsal caught a REAL GAP: an
    // INSERT into an UNMAPPED identity table gets no RETURNING and therefore
    // returns insertId 0, which reads exactly like a successful write. It bit
    // on `models` and `validation_set` (fixture chain), and the same shape
    // would bite any worker/admin path writing these tables under P7.
    // Every entry verified `GENERATED BY DEFAULT AS IDENTITY` on the live
    // schema; recipe to re-derive the full list:
    //   SELECT c.relname, a.attname FROM pg_attribute a
    //     JOIN pg_class c ON c.oid=a.attrelid
    //     JOIN pg_namespace n ON n.oid=c.relnamespace
    //    WHERE c.relkind='r' AND a.attidentity<>'' AND n.nspname='public';
    models: 'model_id',
    validation_set: 'validation_set_id',
    recordings: 'recording_id',
    recording_validations: 'recording_validation_id',
    audio_event_detections_clustering: 'aed_id',
    classification_results: 'classification_result_id',
    pattern_matching_rois: 'pattern_matching_roi_id',
    pattern_matching_validations: 'validation_id',
    pattern_matching_user_statistics: 'user_statistics_id',
    job_queues: 'job_queue_id',
    job_queue_enqueued_jobs: 'enqueued_job_id',
    job_tasks: 'task_id',
    recanalizer_stats: 'id',
    species_families: 'family_id',
    species_aliases: 'alias_id',
    user_account_support_request: 'support_request_id'
};

// Tables with a NATURAL (non-identity) primary key whose INSERT sites never
// read a driver-generated id. For these, running without RETURNING is the
// CORRECT shape, so the write_unmapped_insert divergence line is suppressed --
// leaving it loud would bake a permanent noise class into the P7 divergence
// stream that every post-flip session then has to re-baseline against.
// cached_metrics (PK = varchar `key`): its only INSERT site
// (model/projects.js insertCachedMetrics) discards the result packet, so
// insertId 0 has no consumer -- measured post-flip 2026-09-12 (the 4
// write_unmapped_insert events were all the cold-key insert path, each
// immediately followed by the real defect: 22001 on the over-long key).
var WRITE_NO_IDENTITY_PK = {
    cached_metrics: true
};

var _W_INSERT_RE = /^\s*INSERT\s+INTO\s+"?([A-Za-z_]\w*)"?\b/i;
var _W_RETURNING_RE = /\bRETURNING\b/i;
var _W_TX_BEGIN_RE = /^\s*(BEGIN\b|START\s+TRANSACTION\b)/i;
var _W_TX_END_RE = /^\s*(COMMIT\b|ROLLBACK\b|END\b)/i;

// Execute one already-interpolated (final, literal-bearing) MySQL-dialect
// statement on a checked-out PG client; shape the result as the mysql driver
// would have. cb(err, rowsOrPacket, fields).
function pgWriteExec(client, finalSql, connState, cb) {
    _counters.write_routed++;
    var pgSql;
    try { pgSql = translate(finalSql); } catch (e) {
        _counters.dialect_error++; _counters.write_error++;
        emitDivergence({ v: 1, ts: new Date().toISOString(), klass: 'dialect_error',
            phase: 'translate-pg-write', hash: templateHash(finalSql),
            tmpl: sqlTemplate(finalSql).slice(0, 400),
            detail: String(e && e.message || e).slice(0, 200) });
        return cb(e);
    }
    var ins = _W_INSERT_RE.exec(pgSql);
    var shimPk = null;
    if (ins && !_W_RETURNING_RE.test(pgSql)) {
        var pk = WRITE_IDENTITY_PK[ins[1]];
        if (pk) {
            pgSql = pgSql.replace(/;+\s*$/, '') + ' RETURNING ' + pk;
            shimPk = pk;
        } else if (!WRITE_NO_IDENTITY_PK[ins[1]] && divergenceEmitAllowed(templateHash(finalSql))) {
            emitDivergence({ v: 1, ts: new Date().toISOString(),
                klass: 'write_unmapped_insert', phase: 'shim-pg-write',
                hash: templateHash(finalSql), tmpl: sqlTemplate(finalSql).slice(0, 400),
                detail: 'no WRITE_IDENTITY_PK entry for ' + ins[1] + '; no RETURNING appended' });
        }
    }
    client.query(pgSql, function (err, res) {
        if (err) {
            if (isConnLifetimeError(err)) {
                _counters.pg_error++;
                emitStat({ ev: 'pg_write_conn_error',
                    err: String(err && err.message || err).slice(0, 200),
                    pg_code: err && err.code });
            } else {
                // A dialect-shaped failure on the WRITE path is booked into
                // the SAME `dialect_error` gate metric as read-path failures
                // (gate 4c §5.6 counts it), plus a write-specific counter.
                _counters.dialect_error++; _counters.write_error++;
                emitDivergence({ v: 1, ts: new Date().toISOString(), klass: 'dialect_error',
                    phase: 'execute-pg-write', hash: templateHash(finalSql),
                    tmpl: sqlTemplate(finalSql).slice(0, 400),
                    detail: String(err && err.message || err).slice(0, 240),
                    pg_code: err && err.code });
            }
            return cb(err);
        }
        _counters.write_ok++;
        var cmd = res && res.command;
        if (cmd === 'SELECT' || cmd === 'SHOW') {
            return cb(null, (res && res.rows) || [], res && res.fields);
        }
        // Everything else answers as the mysql driver's OkPacket.
        var packet = { fieldCount: 0,
            affectedRows: (res && typeof res.rowCount === 'number') ? res.rowCount : 0,
            insertId: 0, serverStatus: 2, warningCount: 0, message: '',
            protocol41: true, changedRows: 0 };
        if (cmd === 'UPDATE' || cmd === 'DELETE') { packet.changedRows = packet.affectedRows; }
        if (cmd === 'INSERT') {
            // insertId mapping applies whenever a RETURNING clause is in play —
            // appended by the shim above OR written explicitly by one of the 7
            // ported sites (which carry their own RETURNING).
            var hasReturning = shimPk !== null || _W_RETURNING_RE.test(pgSql);
            if (hasReturning) {
                var rows = (res && res.rows) || [];
                if (rows.length === 0) {
                    var ne = new Error('P7 write shim: INSERT INTO ' + (ins ? ins[1] : '?') +
                        ' produced no row (RETURNING expected one)');
                    ne.code = 'PG_INSERT_NO_ROW';
                    _counters.write_error++;
                    return cb(ne);
                }
                // mysql's insertId is the FIRST generated id; for a multi-row
                // INSERT..SELECT that is the first returned row. Prefer the
                // mapped pk; fall back to the single returned field.
                var pkName = shimPk || WRITE_IDENTITY_PK[ins ? ins[1] : ''];
                if (!pkName || !(pkName in rows[0])) {
                    pkName = (res.fields && res.fields.length === 1) ? res.fields[0].name : null;
                }
                packet.insertId = pkName ? rows[0][pkName] : 0;
            }
        }
        cb(null, packet, undefined);
    });
}

// Minimal evented/stream shape for the no-callback form of
// `connection.query(sql)` (used by queryWithConnHandler's options.stream
// branch and dbpool.streamQuery). REHEARSAL-GRADE: the result is BUFFERED
// and then streamed from memory — fine at one-project scratch-DB scale, a
// named P7 gap for the two known big-read callers (training-set CSV export,
// citizen-scientist stats). P7 must decide between pg-query-stream and
// keeping these reads on the buffered path.
function makeStreamQuery(conn, sql, values) {
    var stub = {
        stream: function (/* streamArgs */) {
            var Readable = require('stream').Readable;
            var out = new Readable({ objectMode: true, read: function () {} });
            conn.query(sql, values, function (err, rows, fields) {
                if (err) { out.emit('error', err); return; }
                out.emit('fields', fields, 0);
                (rows || []).forEach(function (r) { out.push(r); });
                out.push(null);
            });
            return out;
        }
    };
    // §300 item E HARDENING (2026-09-14). The lazy stub above is CORRECT for
    // the deliberate stream consumers (sites.js:445/516, dbpool.js:159/285,
    // plotdata.js:59 -- all of which call .stream() immediately). It is a
    // SILENT DATA-LOSS TRAP for anyone who `await`s it instead: `await` on a
    // non-thenable resolves to the object itself, so the statement is never
    // sent, the surrounding transaction commits without it, and every
    // instrument reports success. That cost us project renames + soft-deletes
    // (#1875) and then every post-flip site's external_id/country_code.
    //
    // A `then` here is what makes the difference visible: `await stub` now
    // THROWS instead of quietly yielding a useless object, while .stream()
    // is untouched. Promise-detection (`typeof x.then === 'function'`) is the
    // one behaviour this adds, so the throw fires exactly when someone treats
    // the stub as a promise -- which is always a bug.
    Object.defineProperty(stub, 'then', {
        enumerable: false,
        configurable: true,
        value: function () {
            var e = new Error(
                'callback-less conn.query() returns a lazy stream stub and ' +
                'executes NOTHING when awaited: use conn.promisedQuery(sql, values) ' +
                '(or pass a callback, or call .stream()). SQL: ' +
                String(sqlText(sql)).slice(0, 200));
            e.code = 'ERR_LAZY_QUERY_AWAITED';
            _counters.dialect_error++;
            emitDivergence({ v: 1, ts: new Date().toISOString(),
                klass: 'lazy_query_awaited', phase: 'execute-pg-write',
                hash: templateHash(String(sqlText(sql))),
                tmpl: sqlTemplate(String(sqlText(sql))).slice(0, 400),
                detail: 'callback-less conn.query awaited; statement never sent' });
            throw e;
        }
    });
    return stub;
}

// The adapter itself: wrap a checked-out node-pg client in the mysql driver
// connection's API surface.
function makeWriteConnAdapter(client, done) {
    var q = require('q');         // lazy: inert-mode processes never load this
    var connState = {};
    var released = false;
    var inflightCb = null;
    var conn = {};
    conn.$_lastQuery_$ = '';
    // Ops parity with enable_query_debugging's 25 s not-freed ALERT.
    conn.$_timeout_$ = setTimeout(function () {
        console.log('ALERT: pg connection taken for query ' + conn.$_lastQuery_$ + ' is not freed after 25000');
        conn.$_lastQuery_$ = '';
    }, QUERY_TIMEOUT_MS);
    if (conn.$_timeout_$.unref) { conn.$_timeout_$.unref(); }

    // The #1781 guard, mandatory on the request path: a checked-out client
    // that dies mid-query emits 'error' on ITSELF; unlistened, Node rethrows
    // and the process exits. Settle any in-flight statement and destroy the
    // client rather than returning it to the pool.
    var onClientError = function (cerr) {
        _counters.pg_error++;
        emitStat({ ev: 'pg_write_client_error',
            err: String(cerr && cerr.message || cerr).slice(0, 200) });
        if (conn.$_timeout_$) { clearTimeout(conn.$_timeout_$); conn.$_timeout_$ = null; }
        var cb = inflightCb; inflightCb = null;
        if (!released) {
            released = true;
            try { done(cerr); } catch (x) { /* pool already reclaimed it */ }
        }
        if (cb) { try { cb(cerr); } catch (x2) { /* caller gone */ } }
    };
    client.on('error', onClientError);

    conn.query = function (sql, values, cb) {
        if (values instanceof Function) { cb = values; values = undefined; }
        var raw = sqlText(sql);
        conn.$_lastQuery_$ = raw;
        if (!cb) { return makeStreamQuery(conn, sql, values); }
        var vals = values;
        if (vals === undefined && sql && typeof sql === 'object' && sql.values !== undefined) {
            vals = sql.values;
        }
        var finalSql;
        try {
            // Interpolate with the SAME formatter and timezone the MariaDB
            // path uses, so the text the translator sees is identical to
            // what the shadow validated for months.
            finalSql = _mysqlFormat()(raw, vals, false, _dbTimezone());
        } catch (e) { return cb(e); }
        if (_W_TX_BEGIN_RE.test(finalSql)) { connState.txOpen = true; }
        else if (_W_TX_END_RE.test(finalSql)) { connState.txOpen = false; }
        inflightCb = cb;
        pgWriteExec(client, finalSql, connState, function (err, rows, fields) {
            inflightCb = null;
            cb(err, rows, fields);
        });
    };
    conn.promisedQuery = function (sql, values) {
        return q.ninvoke(conn, 'query', sql, values).get(0);
    };
    // mysql driver transaction verbs (mysql@2.18 lib/Connection.js:141/154/167
    // issue START TRANSACTION/COMMIT/ROLLBACK). PG parses all three verbatim;
    // issued through conn.query so txOpen bookkeeping stays accurate.
    conn.beginTransaction = function (cb) { conn.query('BEGIN', function (e) { if (cb) { cb(e); } }); };
    conn.commit = function (cb) { conn.query('COMMIT', function (e) { if (cb) { cb(e); } }); };
    conn.rollback = function (cb) { conn.query('ROLLBACK', function (e) { if (cb) { cb(e); } }); };
    conn.release = function () {
        if (released) { return; }
        released = true;
        client.removeListener('error', onClientError);
        if (conn.$_timeout_$) { clearTimeout(conn.$_timeout_$); conn.$_timeout_$ = null; }
        conn.$_lastQuery_$ = '';
        if (connState.txOpen) {
            // node-pg returns a client to the pool WITHOUT rolling back an
            // open transaction — the next borrower would silently inherit it.
            // Roll back loudly and DESTROY the client instead.
            emitStat({ ev: 'pg_write_tx_leak', note: 'released with open transaction; rolled back + destroyed' });
            try {
                client.query('ROLLBACK', function () {
                    done(new Error('pg conn released with open transaction'));
                });
            } catch (e) { done(new Error('pg conn released with open transaction')); }
            return;
        }
        done();
    };
    return conn;
}

var QUERY_TIMEOUT_MS = 25000;

function _mysqlFormat() {
    return require('mysql').format; // lazy: same module the MariaDB path uses
}
function _dbTimezone() {
    return require('../config')('db').timezone || 'Z';
}

// Checkout a write-capable PG connection (the dbpool.getConnection flip).
// Callback-style to mirror the mysql pool: cb(err, conn) / promise.
function getWriteConnection(callback) {
    var q = require('q');
    var d = q.defer();
    var pool = getPool();
    if (!pool) {
        var e0 = new Error('pg pool unavailable');
        d.reject(e0);
        return d.promise.nodeify(callback);
    }
    pool.connect(function (err, client, done) {
        if (err) {
            _counters.pg_error++;
            emitStat({ ev: 'pg_write_connect_error',
                err: String(err && err.message || err).slice(0, 200) });
            d.reject(err);
            return;
        }
        d.resolve(makeWriteConnAdapter(client, done));
    });
    return d.promise.nodeify(callback);
}

module.exports = {
    // `isPg` is kept as a constant while the 26 model-file branches collapse
    // file-by-file (PR-3); it now always reads true.
    isPg: true,
    pgRouteEligible: pgRouteEligible,
    pgReadQuery: pgReadQuery,
    translateExtremeSubqueryNulls: translateExtremeSubqueryNulls,
    // exported for the self-test:
    classify: classify,
    translate: translate,
    // P7 write routing:
    getWriteConnection: getWriteConnection,
    WRITE_IDENTITY_PK: WRITE_IDENTITY_PK,
    WRITE_NO_IDENTITY_PK: WRITE_NO_IDENTITY_PK,
    sqlTemplate: sqlTemplate,
    templateHash: templateHash,
    isConnLifetimeError: isConnLifetimeError,
    CONN_LIFETIME_SQLSTATES: CONN_LIFETIME_SQLSTATES,
    columnCaseMap: columnCaseMap,
    translateCollation: translateCollation,
    translateOrderByCollation: translateOrderByCollation,
    translateBareCollation: translateBareCollation,
    translateInCollation: translateInCollation,
    resolveBareColumn: resolveBareColumn,
    aliasMap: aliasMap,
    collationClass: collationClass,
    COLLATION_ORDER_EXACT: COLLATION_ORDER_EXACT,
    restoreRowCase: restoreRowCase,
    _counters: _counters
};
