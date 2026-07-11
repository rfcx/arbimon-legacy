'use strict';
/**
 * DBPOOL TAP — recording tap for the mysql2pg parity/replay harness
 * (rfcx-local OPEN-ITEMS #40, migration plan Phase 3).
 *
 * Emits one structured JSON line per SAMPLED query to stdout with the
 * distinctive prefix "DBPOOL_TAP " so it can be harvested from the pod
 * log stream (promtail -> Loki, 14d retention).
 *
 * OFF BY DEFAULT. Controls (env):
 *   DBPOOL_TAP=1                   enable (anything else = disabled)
 *   DBPOOL_TAP_SAMPLE=0.1          sampling rate 0..1 (default 0.1)
 *   DBPOOL_TAP_MAX_HASH_ROWS=5000  skip result-hashing above this row count
 *   DBPOOL_TAP_MAX_SQL=65536       truncate captured sql beyond this length
 *
 * Design rules (from the Phase 3 plan):
 *  - The tap is DUMB AND CHEAP: it hashes the RAW result exactly as the
 *    driver returned it. All normalization (ordering, float tolerance,
 *    collation) lives in the replayer, not here.
 *  - Writes are captured too (sql + params only, marked write:true) —
 *    the Phase 7 write-replay rehearsal needs them. The replayer never
 *    executes them.
 *  - When disabled, the only cost is one boolean check per query.
 *    When enabled but unsampled, the only cost is one Math.random().
 *
 * Record shape:
 *   { v:1, ts, sql, sql_truncated?, params?, write, stream?, err?,
 *     row_count, result_sha1?, duration_ms, caller }
 */

var crypto = require('crypto');

var ENABLED = process.env.DBPOOL_TAP === '1';
var SAMPLE = parseFloat(process.env.DBPOOL_TAP_SAMPLE || '0.1');
if (isNaN(SAMPLE) || SAMPLE < 0) { SAMPLE = 0; }
if (SAMPLE > 1) { SAMPLE = 1; }
var MAX_HASH_ROWS = parseInt(process.env.DBPOOL_TAP_MAX_HASH_ROWS || '5000', 10);
var MAX_SQL = parseInt(process.env.DBPOOL_TAP_MAX_SQL || '65536', 10);
var PREFIX = 'DBPOOL_TAP ';

// First keyword deciding write-vs-read. Advisory only — the replayer's
// allowlist parser is the safety authority, this flag just helps triage.
var WRITE_RE = /^[\s(]*(insert|update|delete|replace|create|alter|drop|truncate|set|lock|unlock|call|load|grant|revoke|rename|begin|commit|rollback|start|savepoint|release|handler|do|kill|analyze|optimize|flush)\b/i;

function sqlText(sql) {
    if (typeof sql === 'string') { return sql; }
    if (sql && typeof sql.sql === 'string') { return sql.sql; } // mysql options-object form
    return String(sql);
}

function callerHint() {
    // First stack frame outside this file / dbpool.js / sqlutil.js / node internals.
    var holder = {};
    Error.captureStackTrace(holder, callerHint);
    var lines = (holder.stack || '').split('\n');
    for (var i = 1; i < lines.length; i++) {
        var l = lines[i];
        if (l.indexOf('dbpool-tap.js') !== -1) { continue; }
        if (l.indexOf('dbpool.js') !== -1) { continue; }
        if (l.indexOf('sqlutil.js') !== -1) { continue; }
        if (l.indexOf('node_modules') !== -1) { continue; }
        if (l.indexOf('internal/') !== -1) { continue; }
        if (l.indexOf('node:') !== -1) { continue; }
        var m = l.match(/\(?([^()\s]+:\d+):\d+\)?\s*$/);
        if (m) {
            // trim the path to app-relative for compactness
            return m[1].replace(/^.*\/(app|lib|jobs|bin)\//, '$1/');
        }
    }
    return null;
}

function emit(rec) {
    try {
        process.stdout.write(PREFIX + JSON.stringify(rec) + '\n');
    } catch (e) { /* never let the tap break the app */ }
}

/**
 * Called when a query is issued. Returns null when the tap is off or the
 * query is not sampled — the caller then does nothing else.
 */
function begin(sql, values) {
    if (!ENABLED) { return null; }
    if (Math.random() >= SAMPLE) { return null; }
    var text = sqlText(sql);
    var rec = {
        v: 1,
        ts: new Date().toISOString(),
        sql: text.length > MAX_SQL ? text.slice(0, MAX_SQL) : text,
        write: WRITE_RE.test(text)
    };
    if (text.length > MAX_SQL) { rec.sql_truncated = true; }
    if (values !== undefined && values !== null) {
        try {
            var p = JSON.stringify(values);
            rec.params = p.length > MAX_SQL ? undefined : values;
            if (rec.params === undefined) { rec.params_truncated = true; }
        } catch (e) { rec.params_unserializable = true; }
    }
    var c = callerHint();
    if (c) { rec.caller = c; }
    rec.$t0 = process.hrtime.bigint();
    return rec;
}

/** Called from the query completion callback. */
function finish(rec, err, rows) {
    if (!rec) { return; }
    rec.duration_ms = Number(process.hrtime.bigint() - rec.$t0) / 1e6;
    delete rec.$t0;
    if (err) {
        rec.err = String(err.code || err.message || err).slice(0, 200);
        emit(rec);
        return;
    }
    if (Array.isArray(rows)) {
        rec.row_count = rows.length;
        if (!rec.write && rows.length <= MAX_HASH_ROWS) {
            try {
                rec.result_sha1 = crypto.createHash('sha1')
                    .update(JSON.stringify(rows))
                    .digest('hex');
            } catch (e) { rec.hash_failed = true; }
        }
    } else if (rows && typeof rows === 'object') {
        // OkPacket (writes): capture affectedRows/insertId for Phase 7.
        if (typeof rows.affectedRows === 'number') { rec.affected_rows = rows.affectedRows; }
        if (rows.insertId) { rec.insert_id = rows.insertId; }
    }
    emit(rec);
}

/** Streamed query: sql/params only, no result capture (kept cheap). */
function finishStream(rec) {
    if (!rec) { return; }
    delete rec.$t0;
    rec.stream = true;
    emit(rec);
}

module.exports = {
    enabled: ENABLED,
    begin: begin,
    finish: finish,
    finishStream: finishStream
};
