var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * P7 OPQ-16 (a) — NOT-NULL-no-default columns must be SUPPLIED BY THE APP.
 *
 * THE CLASS (runbooks/FINDING-2026-09-11-p7-mysql-implicit-defaults-vs-pg-notnull.md):
 * MariaDB runs with `@@sql_mode` EMPTY (non-STRICT), so an INSERT that omits a
 * NOT NULL column with no DEFAULT is silently accepted and an implicit default
 * ('' for text, 0 for numeric) is stored. PostgreSQL does not do this: the same
 * statement raises 23502 (not_null_violation) and the write FAILS. At the
 * Phase-7 write flip these three live write paths would therefore start
 * erroring on every call.
 *
 * THE THREE DEFECTS (runbooks/ANALYSIS-2026-09-11-p7-implicit-default-audit.md §2,
 * the 76-column per-path audit; re-derived on the running pod
 * `rfcx-local-prod-4e10830` before this commit):
 *
 *   1. app/model/clustering-jobs.js  — `jobs.remarks`             -> literal ''
 *   2. app/model/pattern_matchings.js — `pattern_matchings.cs_expert` -> constant 0
 *   3. app/model/training_sets.js    — `training_sets.removed`    -> literal 0
 *
 * Each fix has a SIBLING PRECEDENT in this same codebase — these statements were
 * the odd ones out, not a new convention:
 *   - jobs.js:~209, pattern_matchings.js:~1172 and
 *     audio-event-detections-clustering.js:~307 all carry `uri`,`remarks` -> '',''
 *   - training_sets.js:~227 (the combine path) already passes literal 0 for `removed`
 *
 * WHY SHAPE (a) — SUPPLY IN APP — AND NOT A PG-SIDE DEFAULT: the OPQ-16 ruling
 * reserves shape (b) for columns whose caller provably CANNOT supply a value.
 * All three callers can; two of the values are literals the sibling code already
 * writes, and `cs_expert=0` reproduces today's production behaviour exactly
 * (live: cs_expert=0 x122,690 vs 1 x289 — the 1s are set later by the CS flow,
 * never at create). The audit found 0 columns needing (b), so no DDL ships here.
 *
 * WHY THESE TESTS EXIST AT ALL (the #1866 lesson, 2026-09-11): two prod-breaking
 * regressions shipped past 129 passing tests because the contract they broke had
 * NO HARNESS. This class is exactly that shape — invisible to schema-diff,
 * read-shadow and the gate-4a parse test alike, because the statement is
 * perfectly valid SQL that merely omits a column. Each assertion below FAILS on
 * the pre-fix tree (negative control run and recorded in PR rfcx/arbimon-legacy#1864).
 *
 * These are SOURCE-SHAPE guards over the SQL the models actually build, matching
 * the convention of job-creation-atomic-single-engine.test.js and
 * classification-delete-waterfall.test.js: the models need a live pool to
 * execute, so the property is pinned by reconstructing the statement from the
 * shipped string-concatenation rather than by standing up a database.
 */

var ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/**
 * Reconstruct a SQL statement from the shipped source.
 *
 * `start` anchors the first string literal of the concatenation; the expression
 * is taken up to `end` and evaluated with a stubbed `dbpool` so that the
 * escape-concatenation style of training_sets.js (deliberately NOT converted to
 * bound params in this PR — that is a separate refactor with its own risk)
 * reconstructs as faithfully as the bound-param statements.
 */
function buildSql(src, start, end) {
    var i = src.indexOf(start);
    expect(i, 'anchor not found in source: ' + start).to.be.greaterThan(-1);
    var j = src.indexOf(end, i);
    expect(j, 'terminator not found after anchor: ' + start).to.be.greaterThan(-1);
    var expr = src.slice(i, j);
    var stubs = {
        dbpool: { escape: function (v) { return typeof v === 'number' ? String(v) : "'" + v + "'"; } },
        data: { project_id: 1, name: 'ts' },
        typedef: { id: 1 }
    };
    // eslint-disable-next-line no-new-func
    return new Function('dbpool', 'data', 'typedef', 'return (' + expr + ');')(
        stubs.dbpool, stubs.data, stubs.typedef);
}

/** Split on top-level commas only (NOW() / now() must not split). */
function splitTopLevel(s) {
    var out = [], depth = 0, cur = '';
    for (var k = 0; k < s.length; k++) {
        var c = s[k];
        if (c === '(') { depth++; }
        else if (c === ')') { depth--; }
        if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
        else { cur += c; }
    }
    if (cur.trim()) { out.push(cur.trim()); }
    return out;
}

/** Parse an INSERT into its column list and its value list. */
function parseInsert(sql) {
    var open = sql.indexOf('(');
    var depth = 0, close = -1;
    for (var k = open; k < sql.length; k++) {
        if (sql[k] === '(') { depth++; }
        else if (sql[k] === ')') { depth--; if (depth === 0) { close = k; break; } }
    }
    expect(close, 'unterminated column list').to.be.greaterThan(-1);
    var cols = splitTopLevel(sql.slice(open + 1, close))
        .map(function (c) { return c.replace(/`/g, '').trim(); });

    var rest = sql.slice(close + 1);
    var m = rest.match(/\b(VALUES|SELECT)\b/i);
    expect(m, 'no VALUES/SELECT after the column list').to.not.equal(null);
    var vals = rest.slice(m.index + m[0].length).trim();
    if (vals[0] === '(') { vals = vals.slice(1, vals.lastIndexOf(')')); }
    return { cols: cols, vals: splitTopLevel(vals) };
}

/**
 * The shared contract: the column is in the list, the statement's arity is
 * still internally consistent, and the value supplied in that column's position
 * is the intended literal (not, say, a stray `?` with no bound parameter).
 */
function assertSupplies(stmt, column, literal) {
    var parsed = parseInsert(stmt);
    expect(parsed.cols, 'column list must carry `' + column + '`').to.include(column);
    expect(parsed.vals.length,
        'arity: ' + parsed.cols.length + ' columns vs ' + parsed.vals.length + ' values')
        .to.equal(parsed.cols.length);
    expect(parsed.vals[parsed.cols.indexOf(column)],
        '`' + column + '` must be supplied as the literal ' + literal)
        .to.equal(literal);
    return parsed;
}

describe('P7 OPQ-16 (a): NOT-NULL-no-default columns are supplied by the app', function () {

    describe('1. jobs.remarks — clustering-job create (job_type_id=9)', function () {
        // app/model/clustering-jobs.js, NOT the identically-named
        // app/routes/data-api/project/clustering-jobs.js: the INSERT is in the model.
        var sql = buildSql(read('app/model/clustering-jobs.js'),
            '"INSERT INTO jobs (\\n"', ';');

        it('the INSERT column list carries `remarks` with literal \'\'', function () {
            var parsed = assertSupplies(sql, 'remarks', "''");
            // the fix must not have disturbed the bound-parameter arity: the 9
            // placeholders still match the 9-element params array at the call site.
            expect(parsed.vals.filter(function (v) { return v === '?'; }).length).to.equal(9);
        });

        it('is the model file, and the route file still builds no jobs INSERT', function () {
            expect(read('app/routes/data-api/project/clustering-jobs.js'))
                .to.not.match(/INSERT\s+INTO\s+`?jobs`?/i);
        });
    });

    describe('2. pattern_matchings.cs_expert — the only INSERT into pattern_matchings', function () {
        var sql = buildSql(read('app/model/pattern_matchings.js'),
            "'INSERT INTO `pattern_matchings`", ',\n                        [data.name');

        it('the INSERT column list carries `cs_expert` with constant 0', function () {
            var parsed = assertSupplies(sql, 'cs_expert', '0');
            expect(parsed.vals.filter(function (v) { return v === '?'; }).length).to.equal(9);
        });

        it('`citizen_scientist` is still carried separately (they are different columns)', function () {
            expect(parseInsert(sql).cols).to.include('citizen_scientist');
        });
    });

    describe('3. training_sets.removed — trainingSets.insert (POST .../training-sets/add)', function () {
        var src = read('app/model/training_sets.js');
        var sql = buildSql(src, '"INSERT INTO training_sets (project_id', ',\n            cb);');

        it('the INSERT column list carries `removed` with literal 0', function () {
            assertSupplies(sql, 'removed', '0');
        });

        it('matches the combine path, which already supplied literal 0', function () {
            // training_sets.js:~227 — the sibling precedent this fix follows.
            expect(src).to.match(
                /INSERT INTO training_sets \(project_id, name, date_created, training_set_type_id, removed, metadata\)[\s\S]{0,120}VALUES \(\?, \?, NOW\(\), 1, 0, \?\)/);
        });
    });

    describe('cross-statement consistency (IRR "verify on EVERY executor")', function () {
        // `jobs` is written by four distinct INSERTs and the jobs plane has
        // PG-side workers; a fix that made one statement diverge from the other
        // three would be a new defect. All four must supply `remarks`.
        var jobsInserts = [
            ['app/model/jobs.js', /INSERT INTO `jobs`[\s\S]{0,400}?VALUES[^\n]*/],
            ['app/model/pattern_matchings.js', /INSERT INTO `jobs`[\s\S]{0,400}?VALUES[^\n]*/],
            ['app/model/audio-event-detections-clustering.js', /INSERT INTO `jobs`[\s\S]{0,400}?VALUES[^\n]*/],
            ['app/model/clustering-jobs.js', /INSERT INTO jobs \([\s\S]{0,400}?;/]
        ];

        jobsInserts.forEach(function (pair) {
            it(pair[0] + ' supplies `remarks` in its jobs INSERT', function () {
                var m = read(pair[0]).match(pair[1]);
                expect(m, 'jobs INSERT not found in ' + pair[0]).to.not.equal(null);
                expect(m[0]).to.match(/`?remarks`?/);
            });
        });
    });
});
