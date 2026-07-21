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
// Conservative: a literal containing a backslash is left unchanged (MySQL
// backslash-escape semantics differ from PG standard_conforming_strings) —
// it surfaces as an honest dialect_error instead of a silent wrong value.
function restoreLiteralsPg(sql, store) {
    return sql.replace(/\u0001L(\d+)\u0001/g, function (_, n) {
        var raw = store[parseInt(n, 10)];
        if (raw == null) { return _; }
        if (raw.charAt(0) !== '"') { return raw; }         // sq literal: verbatim
        var inner = raw.slice(1, -1);
        if (inner.indexOf('\\') !== -1) { return raw; }    // backslash: punt
        inner = inner.replace(/""/g, '"');                 // MySQL "" → "
        return "'" + inner.replace(/'/g, "''") + "'";      // escape for PG
    });
}

function translateBackticks(sql) {
    return sql.replace(/`([^`]+)`/g, function (_, ident) {
        var low = ident.toLowerCase();
        if (PG_RESERVED_IDENT[low]) { return '"' + low + '"'; }
        // drop backticks; PG folds unquoted to lowercase (T14)
        return ident;
    });
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
    return raw.replace(/^['"]/, '').replace(/['"]$/, ''); // strip surrounding quotes
}

function translateFunctions(sql, store) {
    var s = sql;
    // MySQL string concat via CONCAT() is identical in PG; the `||` operator
    // is logical-OR in MySQL only under PIPES_AS_CONCAT (not set here) so no
    // rewrite needed. RAND()/NOW() are classifier-forbidden so never arrive.
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
        var ident = raw.replace(/^['"]/, '').replace(/['"]$/, '');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) { return whole; } // not a bare ident
        return kw + ' "' + ident + '"';
    });
}

function translate(mysqlSql) {
    var store = [];
    var s = protectLiterals(mysqlSql, store);
    s = stripIndexHints(s);
    s = fixQuotedAliases(s, store);
    s = translateBackticks(s);
    s = translateLimitOffset(s);
    s = translateFunctions(s, store);
    s = restoreLiteralsPg(s, store);
    return s;
}

// ------------------------------------------------------------- normalizer
// JS port of replay.py canon_value/normalize_result/compare. Turns two raw
// result sets into a comparable canonical form and classifies any diff.

var _ORDER_BY_RE = /\border\s+by\b/i;
function hasOrderBy(sql) { return _ORDER_BY_RE.test(sql); }

function canonValue(v, epsilon) {
    if (v === null || v === undefined) { return 'null'; }
    if (typeof v === 'boolean') { return 'num:' + (v ? 1 : 0); }
    if (typeof v === 'number') {
        if (Number.isInteger(v)) { return 'num:' + v; }
        if (epsilon > 0) {
            if (v === 0) { return 'num:0'; }
            var q = Math.round(v / epsilon) * epsilon;
            if (Number.isInteger(q)) { return 'num:' + q; }
            return 'num:' + q;
        }
        return 'num:' + v;
    }
    if (typeof v === 'bigint') { return 'num:' + v.toString(); }
    if (Buffer.isBuffer(v)) {
        var asStr = v.toString('utf8');
        // if it round-trips as utf8 use str, else hex
        if (Buffer.compare(Buffer.from(asStr, 'utf8'), v) === 0) { return 'str:' + asStr; }
        return 'bytes:' + v.toString('hex');
    }
    if (v instanceof Date) { return 'dt:' + v.toISOString(); }
    if (typeof v === 'object') {
        // arrays (pg text[]), json — canonicalize deterministically
        try { return 'json:' + JSON.stringify(v); } catch (e) { return 'str:' + String(v); }
    }
    // Decimal-as-string (pg numeric) and everything else: bridge numeric strings
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
        var f = parseFloat(v);
        if (Number.isInteger(f)) { return 'num:' + f; }
        return 'num:' + f;
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
        // pgbouncer is transaction-pooled: wrap everything in ONE explicit
        // read-only transaction so the timeout guard + SELECT share a server
        // connection, and ROLLBACK always releases it clean. SET LOCAL scopes
        // the timeout to this transaction only.
        var begin = 'BEGIN READ ONLY; SET LOCAL statement_timeout=' + Math.round(TIMEOUT_MS) + ';';
        client.query(begin, function (gerr) {
            if (gerr) {
                try { client.query('ROLLBACK', function () { release(); }); } catch (e) { release(); }
                finish(); _counters.pg_error++; return;
            }
            client.query(pgSql, function (qerr, pgRes) {
                // Always end the transaction + release the client.
                try { client.query('ROLLBACK', function () { release(); }); } catch (e) { release(); }
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

module.exports = {
    engine: ENGINE,
    enabled: ENABLED,
    isShadow: ENGINE === 'shadow',
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
    normalizeRows: normalizeRows,
    _counters: _counters
};
