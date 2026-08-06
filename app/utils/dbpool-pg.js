'use strict';
/**
 * DBPOOL-PG — PostgreSQL adapter + shadow-read engine for the mysql2pg
 * migration (rfcx-local OPEN-ITEMS #40, migration plan Phase 6).
 *
 * THREE engine modes, selected by env `DB_ENGINE` (default `mysql`):
 *
 *   mysql   (default) — this module is INERT. dbpool.js does not call it.
 *                       Ships safe: zero behavior change, one boolean check.
 *   shadow           — MariaDB stays authoritative and serves EVERY user
 *                       response. Read-only statements are ALSO replayed
 *                       asynchronously on the PG `arbimon` copy, the two
 *                       results normalized+diffed, and mismatches emitted
 *                       as structured `DBPOOL_SHADOW_DIVERGENCE` log lines
 *                       (promtail -> Loki, same lane as the P3 tap).
 *                       Replay is fire-and-forget with a concurrency cap +
 *                       per-statement timeout: a PG error, slowness, or
 *                       outage can NEVER affect the user response.
 *   pg               — (Phase 6.4, operator-gated, NOT this session) route
 *                       SELECTs to PG for the response. Scaffolded here but
 *                       the response-routing path is intentionally left as
 *                       an explicit throw so it cannot be enabled by accident.
 *
 * SAFETY MODEL (mirrors the P3 replay harness, data-stores/arbimon-pg/replay/):
 *   - Only statements the allowlist classifier POSITIVELY identifies as
 *     plain read-only SELECTs are ever sent to PG. Everything else is
 *     skipped (logged-only). This is an allowlist, not a denylist.
 *   - Defense in depth: the PG connection uses the read-only role
 *     (arbimon_ro) inside a `default_transaction_read_only=on` session, so
 *     even a misclassified statement physically cannot mutate PG.
 *   - The shadow path NEVER runs inside the app's request promise chain;
 *     it is scheduled after the MariaDB result is already handed back.
 *
 * Controls (env):
 *   DB_ENGINE=mysql|shadow|pg          engine mode (default mysql)
 *   DB_SHADOW_SAMPLE=1.0               fraction of read stmts to shadow (0..1)
 *   DB_SHADOW_MAX_INFLIGHT=8           concurrency cap for PG replays
 *   DB_SHADOW_TIMEOUT_MS=8000          per-statement PG statement_timeout
 *   DB_SHADOW_MAX_DIFF_ROWS=2000       skip diffing above this row count
 *   PG_SHADOW_HOST / PG_SHADOW_PORT / PG_SHADOW_USER / PG_SHADOW_PASSWORD /
 *   PG_SHADOW_DATABASE                 PG target (defaults below)
 *
 * The translator + classifier + normalizer are deliberately a JS port of
 * the Python P3 harness so shadow findings match the offline baseline. The
 * translator handles the measured hot spots; anything it does not yet cover
 * surfaces as a `dialect_error` divergence — which IS the Phase-6 work queue.
 */

var crypto = require('crypto');

// -------------------------------------------------------------- config

var ENGINE = (process.env.DB_ENGINE || 'mysql').toLowerCase();
var ENABLED = ENGINE === 'shadow' || ENGINE === 'pg';

function numEnv(name, def) {
    var v = parseFloat(process.env[name]);
    return isNaN(v) ? def : v;
}

var SAMPLE = numEnv('DB_SHADOW_SAMPLE', 1.0);
if (SAMPLE < 0) { SAMPLE = 0; }
if (SAMPLE > 1) { SAMPLE = 1; }
var MAX_INFLIGHT = numEnv('DB_SHADOW_MAX_INFLIGHT', 8);
var TIMEOUT_MS = numEnv('DB_SHADOW_TIMEOUT_MS', 8000);
var MAX_DIFF_ROWS = numEnv('DB_SHADOW_MAX_DIFF_ROWS', 2000);
var DIV_PREFIX = 'DBPOOL_SHADOW_DIVERGENCE ';
var STAT_PREFIX = 'DBPOOL_SHADOW_STAT ';

function pgConf() {
    return {
        host: process.env.PG_SHADOW_HOST || 'arbimon-pgbouncer.data.svc.cluster.local',
        port: parseInt(process.env.PG_SHADOW_PORT || '6432', 10),
        user: process.env.PG_SHADOW_USER || 'arbimon_ro',
        password: process.env.PG_SHADOW_PASSWORD || '',
        database: process.env.PG_SHADOW_DATABASE || 'arbimon',
        // Keep the shadow pool small: it is a background verifier, not the
        // request path. max<=MAX_INFLIGHT so we never queue behind the cap.
        max: Math.max(2, Math.min(MAX_INFLIGHT, 10)),
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
    'sites.lat': 1,
    'sites.lon': 1,
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
            if (tbl && NULLABLE_COLS[tbl + '.' + parts[1].toLowerCase()]) {
                nulls = mysqlNullPlacement(km[2]);
            }
            var cls = collationClass(km[1], amap);
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
    s = restoreLiteralsPg(s, store);
    return s;
}

// ------------------------------------------------------------- normalizer
// JS port of replay.py canon_value/normalize_result/compare. Turns two raw
// result sets into a comparable canonical form and classifies any diff.

var _ORDER_BY_RE = /\border\s+by\b/i;
function hasOrderBy(sql) { return _ORDER_BY_RE.test(sql); }

// --- float canonicalization (rfcx-local 2026-07-28, clock-week finding) ---
// MariaDB renders float/double to client text with C printf %.6g semantics
// (6 significant digits, HALF-EVEN rounding); PG renders shortest-roundtrip.
// Same stored float32 bits therefore arrive as DIFFERENT JS numbers
// (measured inside a live pod, same row: mysql driver 7.92533 vs pg driver
// 7.9253335; bit-level proof on the master: time_min = CAST(7.9253335 AS
// FLOAT) -> 1). The old epsilon quantization (1e-9, absolute-scale) cannot
// bridge a ~3.5e-6 RELATIVE gap, so identical data emitted as
// result_mismatch — measured at ~20% of the day-1 clock census across 6
// templates (recording_tags t0/f0/t1/f1, pattern_matching_rois x1/x2/score,
// audio_event_detections_clustering time/frequency).
//
// FIX: canonicalize non-integer numbers at 6 significant digits with
// HALF-EVEN rounding — the SAME convention the delta-sync fingerprint
// compare has always used (delta_sync.py::_fp_norm, '%.6g' % float(v), the
// P2-checksums normalizer). Fidelity proven against C printf %.6g on a
// 20,000-value random-float32 fuzz (0 mismatches).
//
// Rejected shapes (tested, see the p6 collation runbook §7g):
//   - Math.fround: a 6-digit truncation loses MORE than a float32 ulp, so
//     fround cannot re-converge the two renderings.
//   - bare toPrecision(6): JS rounds half-AWAY; fails on the live value
//     21281.25 (maria %.6g half-even -> 21281.2, toPrecision -> 21281.3).
//   - raising epsilon: it is an absolute-scale quantum; no single value
//     works across magnitudes (22171.9 needs ~1e-1, 0.691209 needs ~1e-6).
function g6HalfEven(x) {
    if (!isFinite(x)) { return String(x); }
    if (x === 0) { return '0'; }
    var neg = x < 0;
    var ax = Math.abs(x);
    var exp = Math.floor(Math.log10(ax));
    var scale = Math.pow(10, 5 - exp);       // 6 significant digits
    var scaled = ax * scale;
    var fl = Math.floor(scaled);
    var frac = scaled - fl;
    var r;
    // half-even at the rounding boundary (C printf semantics; MariaDB's
    // renderer). 1e-7 tolerance identifies an exact-half within float64 noise.
    if (Math.abs(frac - 0.5) < 1e-7) { r = (fl % 2 === 0) ? fl : fl + 1; }
    else { r = Math.round(scaled); }
    var out = r / scale;
    var s = out.toPrecision(6);
    // strip trailing zeros ONLY when a decimal point exists — a bare
    // /\.?0+$/ eats integer zeros ('28000.0' is safe, '28000' would become
    // '28'; that exact bug appeared in this fix's own first fuzz harness).
    if (s.indexOf('e') < 0 && s.indexOf('.') >= 0) {
        s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return neg ? '-' + s : s;
}

function canonValue(v, epsilon) {
    if (v === null || v === undefined) { return 'null'; }
    if (typeof v === 'boolean') { return 'num:' + (v ? 1 : 0); }
    if (typeof v === 'number') {
        if (Number.isInteger(v)) { return 'num:' + v; }
        // Non-integer: 6-sig-digit half-even canonicalization (see g6HalfEven
        // above). Subsumes the old epsilon quantization — %.6g is coarser than
        // 1e-9 at every magnitude and is scale-free, which epsilon is not.
        return 'num:' + g6HalfEven(v);
    }
    if (typeof v === 'bigint') { return 'num:' + v.toString(); }
    if (Buffer.isBuffer(v)) {
        var asStr = v.toString('utf8');
        // if it round-trips as utf8 use str, else hex
        if (Buffer.compare(Buffer.from(asStr, 'utf8'), v) === 0) { return 'str:' + asStr; }
        return 'bytes:' + v.toString('hex');
    }
    if (v instanceof Date) {
        // WHOLE-SECOND canonicalization (2026-08-04, the b0cc625e class).
        // Temporal parity is defined at whole-second precision CLUSTER-WIDE:
        // every datetime column in the arbimon2 reference schema is fsp 0
        // (information_schema datetime_precision > 0 count = 0, verified
        // live 2026-08-04), the forward-sync fingerprint already truncates
        // (delta_sync.py::_fp_norm s[:19]), and the reverse-sync write path
        // measurably FLOORS PG micros into MariaDB DATETIME (all 556
        // post-flip rows with micros >= .5s: Maria == PG floor, never
        // floor+1). Post-flip PG-owned writes carry real sub-second
        // precision (jobs.last_update 501/564, soundscapes.date_created
        // 33/80) that is UNREPRESENTABLE on the MariaDB side by schema —
        // comparing it manufactures permanent divergence on identical
        // stored facts (same class as the g6HalfEven float4 fold above).
        // slice(0,19) truncates the ISO string at seconds ('YYYY-MM-DDTHH:
        // MM:SS'), matching _fp_norm's convention exactly. A real drift of
        // >= 1s still differs. NOTE: V8 Date already truncated pg micros
        // to ms at parse time (OID-1114 parser), so this folds ms -> s.
        return 'dt:' + v.toISOString().slice(0, 19) + 'Z';
    }
    if (typeof v === 'object') {
        // arrays (pg text[]), json — canonicalize deterministically
        try { return 'json:' + JSON.stringify(v); } catch (e) { return 'str:' + String(v); }
    }
    // Decimal-as-string (pg numeric) and everything else: bridge numeric strings
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
        var f = parseFloat(v);
        if (Number.isInteger(f)) { return 'num:' + f; }
        return 'num:' + g6HalfEven(f);
    }
    return 'str:' + String(v);
}

// Per-row canonical column map: { colLower: canonString }. Built SYNCHRONOUSLY
// at snapshot time so it is immune to the app mutating the row objects later.
function rowMaps(rows, epsilon) {
    return rows.map(function (r) {
        var mp = {};
        Object.keys(r).forEach(function (k) { mp[k.toLowerCase()] = canonValue(r[k], epsilon); });
        return mp;
    });
}

// Join per-row maps into comparable canonical strings over a fixed column
// list (sorted). Missing column in a row canonicalizes as absent -> 'null'.
function joinMaps(maps, colList, sortRows) {
    var cols = colList.slice().sort();
    var out = maps.map(function (mp) {
        return cols.map(function (k) {
            return k + '=' + (mp.hasOwnProperty(k) ? mp[k] : canonValue(null, 0));
        }).join('\u0002');
    });
    if (sortRows) { out.sort(); }
    return out;
}

function normalizeRows(rows, epsilon, sortRows) {
    // Back-compat: canonical strings over each row's own columns (union not
    // needed here — callers that mix column sets use joinMaps + a fixed list).
    var maps = rowMaps(rows, epsilon);
    var colUnion = {};
    maps.forEach(function (mp) { Object.keys(mp).forEach(function (k) { colUnion[k] = true; }); });
    return joinMaps(maps, Object.keys(colUnion), sortRows);
}

function colSet(rows) {
    if (!rows.length) { return []; }
    return Object.keys(rows[0]).map(function (k) { return k.toLowerCase(); }).sort();
}

// --- two-phase compare ---
// snapshot(): canonicalize the authoritative rows SYNCHRONOUSLY at hook time.
// The app MUTATES returned row objects after the query callback (measured
// live: login.js attaches `picture` to the users row), so holding references
// across the async PG replay poisons the diff. Canonical strings are
// immutable — snapshot once, compare later.
function snapshot(sql, rows, epsilon) {
    var ordered = hasOrderBy(sql);
    return {
        ordered: ordered,
        underdetermined: !ordered && /\blimit\b/i.test(neutralize(sql)),
        cols: colSet(rows),
        n: rows.length,
        epsilon: epsilon,
        maps: rowMaps(rows, epsilon)   // per-column, projectable, mutation-safe
    };
}

// compareSnap(): diff a prior snapshot against freshly-returned PG rows.
function compareSnap(snap, sql, rowsB, epsilon) {
    var ordered = snap.ordered;
    var ca = snap.cols, cb = colSet(rowsB);
    var pgMaps = rowMaps(rowsB, epsilon);
    // Column-set difference handling. The SAME SQL runs on both engines, so a
    // column set difference is NOT query-derived. The mutation is
    // ONE-DIRECTIONAL: the app mutates ONLY MariaDB's authoritative row
    // objects after the callback (measured live: login.js attaches `picture`,
    // a column in NEITHER schema, onto users rows). PG rows are diffed then
    // discarded — the app never touches them. Therefore:
    //   - MariaDB-only extra columns (ca − cb)  = app mutations → suppress.
    //   - PG-only extra columns     (cb − ca)  = CANNOT be a mutation; they
    //     signal a real translation/aliasing artifact → REPORT (never mask).
    var colList = ca;
    if (snap.n && rowsB.length && ca.join(',') !== cb.join(',')) {
        var caSet = {}; ca.forEach(function (k) { caSet[k] = true; });
        var cbSet = {}; cb.forEach(function (k) { cbSet[k] = true; });
        var pgOnly = cb.filter(function (k) { return !caSet[k]; });
        if (pgOnly.length) {
            // PG produced a column MariaDB did not — not an app mutation.
            return { klass: 'result_mismatch',
                detail: 'pg-only column(s) [' + pgOnly + ']: maria=[' + ca + '] pg=[' + cb + ']' };
        }
        // Only MariaDB-side extras remain: compare over the shared set (= cb).
        colList = ca.filter(function (k) { return cbSet[k]; });
        if (!colList.length) {
            return { klass: 'result_mismatch', detail: 'no shared columns: [' + ca + '] vs [' + cb + ']' };
        }
    }
    var na = joinMaps(snap.maps, colList, !ordered);
    var nb = joinMaps(pgMaps, colList, !ordered);
    if (na.length !== nb.length) {
        return { klass: 'result_mismatch', detail: 'row counts differ: ' + na.length + ' vs ' + nb.length };
    }
    var equal = true;
    for (var i = 0; i < na.length; i++) { if (na[i] !== nb[i]) { equal = false; break; } }
    if (equal) { return null; }
    if (ordered) {
        var sa = na.slice().sort(), sb = nb.slice().sort();
        var multisetEqual = true;
        for (var j = 0; j < sa.length; j++) { if (sa[j] !== sb[j]) { multisetEqual = false; break; } }
        if (multisetEqual) {
            // Same multiset, order differs. Second chance: if the two results
            // are IN-ORDER equal after casefolding, the only difference is a
            // ci-collation vs byte ORDER BY (equal). Otherwise it is a genuine
            // ordering divergence. (Compare original order, NOT sorted.)
            if (casefoldEqual(na, nb)) { return null; }
            return { klass: 'ordering_only', detail: 'same rows, different ORDER BY order' };
        }
    }
    if (casefoldEqual(na.slice().sort(), nb.slice().sort())) {
        return { klass: 'result_mismatch', detail: 'differs only by string case (ci-collation)' };
    }
    // LIMIT without ORDER BY: the SQL contract does not determine WHICH rows
    // are returned — each engine may legitimately pick different rows. Tag
    // distinctly so triage/waivers can separate this class from real drift.
    if (snap.underdetermined) {
        return { klass: 'underdetermined_limit', detail: 'LIMIT without ORDER BY: engines returned different (individually valid) row sets' };
    }
    return { klass: 'result_mismatch', detail: 'row sets differ' };
}

// back-compat single-shot compare (selftests + e2e harness use this)
function compare(sql, rowsA, rowsB, epsilon) {
    return compareSnap(snapshot(sql, rowsA, epsilon), sql, rowsB, epsilon);
}

function casefoldEqual(a, b) {
    if (a.length !== b.length) { return false; }
    for (var i = 0; i < a.length; i++) {
        if (a[i].toLowerCase() !== b[i].toLowerCase()) { return false; }
    }
    return true;
}

// ------------------------------------------------------------ pg pool (lazy)

var _pool = null;
var _poolFailed = false;

function getPool() {
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

// ------------------------------------------------------------ emit helpers

function emit(prefix, obj) {
    try { process.stdout.write(prefix + JSON.stringify(obj) + '\n'); } catch (e) { /* never break app */ }
}
function emitDivergence(obj) { emit(DIV_PREFIX, obj); }
function emitStat(obj) { emit(STAT_PREFIX, obj); }

// ------------------------------------------------------------ shadow engine

var _inflight = 0;
var _counters = { seen: 0, sampled: 0, replayed: 0, skipped_class: 0, dropped_cap: 0,
                  diff: 0, dialect_error: 0, ok: 0, pg_error: 0, pg_timeout: 0,
                  emit_capped: 0 };

// Per-template divergence emit cap: full detail for the first N occurrences
// of a template per window, then counters only (the heartbeat still carries
// totals, so recurrence is never hidden — only the log volume is bounded).
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
    if (c > EMIT_CAP_PER_TEMPLATE) { _counters.emit_capped++; return false; }
    return true;
}

function sqlText(sql) {
    if (typeof sql === 'string') { return sql; }
    if (sql && typeof sql.sql === 'string') { return sql.sql; }
    return String(sql);
}

/**
 * Called by dbpool.js after a MariaDB read query completes (callback form).
 * FIRE-AND-FORGET: this function returns immediately; all PG work happens on
 * later ticks and its result only ever produces a log line.
 *
 * @param finalSql  the FINAL literal-bearing MySQL SQL (mysql.format applied)
 * @param mariaRows the rows MariaDB returned (array) — the authoritative side
 * @param meta      { caller } optional
 */
function shadowAfterRead(finalSql, mariaRows, meta) {
    if (ENGINE !== 'shadow') { return; }
    if (!Array.isArray(mariaRows)) { return; } // OkPacket (write) or stream — skip
    _counters.seen++;
    if (SAMPLE < 1 && Math.random() >= SAMPLE) { return; }
    _counters.sampled++;
    var text = sqlText(finalSql);
    var verdict = classify(text);
    if (!verdict.replayable) { _counters.skipped_class++; return; }
    if (_inflight >= MAX_INFLIGHT) { _counters.dropped_cap++; return; }
    var pool = getPool();
    if (!pool) { return; }
    // Cap the diff work for pathologically large results.
    if (mariaRows.length > MAX_DIFF_ROWS) { return; }
    // SNAPSHOT NOW, synchronously: the app mutates returned row objects after
    // the callback (e.g. login.js attaches `picture` to a users row), so the
    // canonical form must be captured before yielding to the event loop.
    var snap;
    try { snap = snapshot(text, mariaRows, 1e-9); } catch (e) { return; }

    _inflight++;
    _counters.replayed++;
    var pgSql;
    try { pgSql = translate(text); } catch (e) {
        _inflight--; _counters.dialect_error++;
        emitDivergence({ v: 1, ts: new Date().toISOString(), klass: 'dialect_error',
            phase: 'translate', hash: templateHash(text), tmpl: sqlTemplate(text).slice(0, 400),
            detail: String(e && e.message || e).slice(0, 200), caller: meta && meta.caller });
        return;
    }

    var done = false;
    var finish = function () { if (!done) { done = true; _inflight--; } };

    pool.connect(function (err, client, release) {
        if (err) {
            finish(); _counters.pg_error++;
            emitStat({ ev: 'connect_error', err: String(err && err.message || err).slice(0, 200) });
            return;
        }
        // CHECKED-OUT CLIENT ERROR GUARD (rfcx-local 2026-07-26).
        // The pool-level `_pool.on('error')` in getPool() only covers clients
        // sitting IDLE in the pool. A client that is CHECKED OUT and mid-query
        // when its server connection dies emits 'error' on ITSELF; with no
        // listener, Node rethrows it as an uncaught exception and the PROCESS
        // EXITS. A PG failover (or a pgbouncer restart) kills exactly these
        // in-flight connections.
        //
        // Observed in production 2026-07-25: Patroni failed over TL 61->62 at
        // 23:36:17Z and the shadow pod died 6s later at 23:36:23Z with
        // "Error: Connection terminated unexpectedly / Emitted 'error' event on
        // Client instance" — 4 restarts in ~3.5h across repeated failovers
        // (5 failovers in 6 days on this cluster). The shadow is meant to be
        // strictly fire-and-forget: it must NEVER be able to kill the app.
        // This matters most at the Phase-6 stage-3 rollout, where DB_ENGINE=
        // shadow moves onto the MAIN user-facing replicas.
        //
        // Counted as pg_error (a connection fault), never as a divergence.
        var clientDead = false;
        // release() is reachable from SEVERAL paths (the client 'error'
        // handler, the BEGIN callback, the query callback, and the ROLLBACK
        // callback nested inside those). pg-pool THROWS on a double release
        // ("Release called on client which has already been released to the
        // pool") and that throw is itself uncaught -> process exit. So funnel
        // every path through one idempotent wrapper.
        // PROVEN NECESSARY: the first version of this fix guarded only the
        // outer callbacks with `clientDead`, but an in-flight ROLLBACK callback
        // still fired release() after the error handler had already released,
        // and the pod died with the double-release throw during a live Patroni
        // switchover acceptance test (2026-07-26).
        var released = false;
        var releaseOnce = function (relErr) {
            if (released) { return; }
            released = true;
            try { release(relErr); } catch (e) { /* pool already reclaimed it */ }
        };
        client.on('error', function (cerr) {
            if (clientDead) { return; }
            clientDead = true;
            _counters.pg_error++;
            emitStat({ ev: 'client_error',
                err: String(cerr && cerr.message || cerr).slice(0, 200) });
            // Release WITH the error so pg DESTROYS this client instead of
            // returning a broken connection to the pool.
            releaseOnce(cerr);
            finish();
        });

        // pgbouncer is transaction-pooled: wrap everything in ONE explicit
        // read-only transaction so the timeout guard + SELECT share a server
        // connection, and ROLLBACK always releases it clean. SET LOCAL scopes
        // the timeout to this transaction only.
        var begin = 'BEGIN READ ONLY; SET LOCAL statement_timeout=' + Math.round(TIMEOUT_MS) + ';';
        client.query(begin, function (gerr) {
            if (clientDead) { return; }   // client already failed + released
            if (gerr) {
                try { client.query('ROLLBACK', function () { releaseOnce(); }); } catch (e) { releaseOnce(); }
                finish(); _counters.pg_error++; return;
            }
            client.query(pgSql, function (qerr, pgRes) {
                if (clientDead) { return; }   // client already failed + released
                // Always end the transaction + release the client.
                try { client.query('ROLLBACK', function () { releaseOnce(); }); } catch (e) { releaseOnce(); }
                finish();
                if (qerr) {
                    // 57014 = query_canceled (our statement_timeout): a slow
                    // PG query is a PERFORMANCE observation, not a dialect
                    // divergence — do not pollute the divergence report.
                    if (qerr.code === '57014') {
                        _counters.pg_timeout++;
                        emitStat({ ev: 'pg_timeout', hash: templateHash(text),
                            tmpl: sqlTemplate(text).slice(0, 200) });
                        return;
                    }
                    // CONNECTION-LIFETIME error, not a SQL error (rfcx-local
                    // 2026-07-27). A server-side connection death (failover,
                    // pgbouncer restart, admin terminate) surfaces here as an
                    // Error with NO SQLSTATE `.code` — e.g. "Connection
                    // terminated unexpectedly" / "server conn crashed?" — OR,
                    // for an ADMINISTRATIVE termination, WITH one (57P01 &c;
                    // see CONN_LIFETIME_SQLSTATES). The client 'error' handler
                    // above catches these when it wins the race, but the QUERY
                    // callback frequently fires first (that ordering is exactly
                    // what #1781 established), so the same fault also lands here.
                    // Counting it as dialect_error corrupted the O5 gate's
                    // headline metric: MEASURED on 2026-07-27, the ~07:03Z
                    // TL68->69 organic failover pushed pod r4h9l's
                    // dialect_error counter 0->1 with NO divergence record
                    // (the emission was swallowed by the per-template emit cap),
                    // making a clean day look dirty and costing a triage cycle
                    // to reconcile counters against Loki. A dialect_error must
                    // mean "PG rejected or mis-executed our SQL", nothing else.
                    // 2026-07-29: #1781's `!qerr.code` test was INCOMPLETE for
                    // exactly that reason — the 04:04Z failover booked two
                    // 57P01s as dialect_error (the 19:11Z one booked zero: the
                    // race, not the fault, decides). Now SQLSTATE-aware.
                    if (isConnLifetimeError(qerr)) {
                        _counters.pg_error++;
                        emitStat({ ev: 'query_conn_error',
                            err: String(qerr && qerr.message || qerr).slice(0, 200),
                            pg_code: qerr && qerr.code,
                            hash: templateHash(text) });
                        return;
                    }
                    _counters.dialect_error++;
                    var dhash = templateHash(text);
                    if (divergenceEmitAllowed(dhash)) {
                        emitDivergence({ v: 1, ts: new Date().toISOString(), klass: 'dialect_error',
                            phase: 'execute', hash: dhash, tmpl: sqlTemplate(text).slice(0, 400),
                            detail: String(qerr && qerr.message || qerr).slice(0, 240),
                            pg_code: qerr && qerr.code, caller: meta && meta.caller });
                    }
                    return;
                }
                var pgRows = (pgRes && pgRes.rows) || [];
                var cmp;
                try { cmp = compareSnap(snap, text, pgRows, 1e-9); } catch (e) { cmp = null; }
                if (cmp) {
                    _counters.diff++;
                    var chash = templateHash(text);
                    if (divergenceEmitAllowed(chash)) {
                        emitDivergence({ v: 1, ts: new Date().toISOString(), klass: cmp.klass,
                            phase: 'compare', hash: chash, tmpl: sqlTemplate(text).slice(0, 400),
                            detail: cmp.detail, rows_maria: mariaRows.length, rows_pg: pgRows.length,
                            caller: meta && meta.caller });
                    }
                } else {
                    _counters.ok++;
                }
            });
        });
    });
}

// periodic stats heartbeat so a silent shadow (0 divergences) is observable
var _statTimer = null;
function startStatHeartbeat() {
    if (_statTimer || ENGINE !== 'shadow') { return; }
    _statTimer = setInterval(function () {
        emitStat({ ev: 'counters', inflight: _inflight, engine: ENGINE, c: _counters });
    }, 60000);
    if (_statTimer.unref) { _statTimer.unref(); }
}
if (ENGINE === 'shadow') { startStatHeartbeat(); }

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

var PG_ROUTE_FALLBACK = (process.env.DB_PG_FALLBACK || '1') !== '0';

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
 * cb(err, rows). On any PG-side failure with DB_PG_FALLBACK enabled (default),
 * cb is called with a sentinel so dbpool.js can retry on MariaDB — a read flip
 * must degrade to the old engine, never to an error page.
 */
function pgReadQuery(finalSql, cb) {
    var text = sqlText(finalSql);
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
        client.query('BEGIN READ ONLY; SET LOCAL statement_timeout=' +
                     Math.round(TIMEOUT_MS) + ';', function (gerr) {
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

module.exports = {
    engine: ENGINE,
    enabled: ENABLED,
    isShadow: ENGINE === 'shadow',
    // Phase 6.4 response routing (INERT unless DB_ENGINE=pg):
    isPg: ENGINE === 'pg',
    pgFallbackEnabled: PG_ROUTE_FALLBACK,
    pgRouteEligible: pgRouteEligible,
    pgReadQuery: pgReadQuery,
    // dbpool.js hook (shadow):
    shadowAfterRead: shadowAfterRead,
    // exported for the self-test + potential Phase-6.4 pg mode:
    classify: classify,
    translate: translate,
    compare: compare,
    snapshot: snapshot,
    compareSnap: compareSnap,
    sqlTemplate: sqlTemplate,
    templateHash: templateHash,
    isConnLifetimeError: isConnLifetimeError,
    CONN_LIFETIME_SQLSTATES: CONN_LIFETIME_SQLSTATES,
    normalizeRows: normalizeRows,
    columnCaseMap: columnCaseMap,
    g6HalfEven: g6HalfEven,
    translateCollation: translateCollation,
    translateOrderByCollation: translateOrderByCollation,
    translateBareCollation: translateBareCollation,
    translateInCollation: translateInCollation,
    resolveBareColumn: resolveBareColumn,
    aliasMap: aliasMap,
    collationClass: collationClass,
    restoreRowCase: restoreRowCase,
    _counters: _counters
};
