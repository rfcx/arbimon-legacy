// Two PG-strictness fixes, both measured live on 2026-09-12 as 500s on
// /legacy-api/project/<slug>/classifications and /models:
//
// 1. Bare boolean literals in comparisons. mysql's driver inlines JS booleans
//    as bare true/false; MySQL accepts tinyint(1) = true; PG rejects
//    smallint = boolean (42883, 'operator does not exist'). The translator now
//    folds =/!=/<> true|false to 1|0 — safe because the only real boolean
//    columns in the PG arbimon DB are in internal ops tables no app SQL
//    touches (verified on the replica 2026-09-12).
//
// 2. The modelList UNION's second branch had m.project_id and m.uri SWAPPED
//    relative to the first branch. MySQL matches UNION columns loosely (and
//    the app reads rows by name), so it was invisible; PG matches positionally
//    and strictly — 'UNION types character varying and bigint cannot be
//    matched'. The branches are now column-order aligned.
//
// NEGATIVE CONTROL: the fold assertions FAIL against the unfixed translator;
// the UNION alignment assertion FAILS against the swapped branch.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pgshadow = require(path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js'));
const translate = pgshadow.translate;
const projectsSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'projects.js'), 'utf8');

describe('translate() — boolean-literal fold (smallint = boolean 42883 fix)', function () {
    it('folds `= true` to `= 1`', function () {
        const out = translate('SELECT 1 FROM jobs J WHERE J.completed = true');
        assert.ok(/J\.completed = 1\b/.test(out), 'got: ' + out);
        assert.ok(!/= true\b/i.test(out), 'bare true survived: ' + out);
    });

    it('folds `= false` to `= 0`', function () {
        const out = translate('SELECT 1 FROM jobs J WHERE J.hidden = false');
        assert.ok(/J\.hidden = 0\b/.test(out), 'got: ' + out);
        assert.ok(!/= false\b/i.test(out), 'bare false survived: ' + out);
    });

    it('folds `!= true` and `<> false`', function () {
        assert.ok(/!= 1\b/.test(translate('SELECT 1 FROM jobs J WHERE J.completed != true')));
        assert.ok(/<> 0\b/.test(translate('SELECT 1 FROM jobs J WHERE J.completed <> false')));
    });

    it('folds the exact live failing shape (classifications getFor, completed)', function () {
        const out = translate('SELECT UNIX_TIMESTAMP( J.`date_created` )*1000 as `date`, J.`job_id` FROM `jobs` AS J WHERE (J.`completed` = true) AND (J.`project_id` = ?)');
        assert.ok(!/= true\b/i.test(out), 'bare true survived: ' + out);
        assert.ok(/completed(?:`)? = 1\b/.test(out), 'got: ' + out);
        assert.ok(!/unix_timestamp/i.test(out), 'unix_timestamp survived (fold ordering): ' + out);
    });

    it('does NOT touch "true" inside a string literal (protectLiterals)', function () {
        const out = translate("SELECT * FROM sites WHERE name = 'true'");
        assert.ok(!/= 1\b/.test(out), 'the string literal got folded to a number: ' + out);
        assert.ok(/'true'/.test(out), 'the string literal was not preserved: ' + out);
    });

    it('does NOT touch column identifiers merely CONTAINING true/false', function () {
        const q = 'SELECT J.is_true north FROM jobs J';
        assert.strictEqual(translate(q), q);
    });
});

describe('modelList UNION — branch column order aligned (UNION type-mismatch fix)', function () {
    it('both UNION branches select m.uri BEFORE m.project_id', function () {
        // Extract the two SELECT branches of the modelList UNION from the source.
        const unionIdx = projectsSrc.indexOf(') UNION(');
        assert.ok(unionIdx > 0, 'modelList UNION not found');
        const branch1 = projectsSrc.slice(0, unionIdx);
        const branch2 = projectsSrc.slice(unionIdx);
        const b1uri = branch1.lastIndexOf('m.uri');
        const b1pid = branch1.lastIndexOf('m.project_id');
        const b2uri = branch2.indexOf('m.uri');
        const b2pid = branch2.indexOf('m.project_id');
        assert.ok(b1uri > 0 && b1pid > 0 && b2uri > 0 && b2pid > 0, 'could not locate uri/project_id in both branches');
        assert.ok(b1uri < b1pid, 'branch 1 should select uri before project_id (reference order)');
        assert.ok(b2uri < b2pid,
            'branch 2 selects project_id before uri — the swap PG rejects ' +
            '("UNION types character varying and bigint cannot be matched")');
    });
});

// ---------------------------------------------------------------------------
// 3. Bare boolean literals in LIST positions (rfcx-local 2026-09-15).
//
// The fold in section 1 is anchored on a COMPARISON OPERATOR. A literal in a
// VALUES list has no operator in front of it, so neither regex could match it:
//
//   INSERT INTO `job_params_soundscape`(..., `normalize`) VALUES (..., false)
//
// app/model/jobs.js:78-85 builds exactly that -- `params.normalize` is a JS
// boolean off req.body.nv (routes/data-api/models.js:512) and dbpool.escape()
// inlines a JS boolean as a bare SQL `false`. PG:
//   42804 column "normalize" is of type smallint but expression is of type boolean
// The INSERT is inside sqlutil.transaction, so the whole soundscape job rolled
// back and the user got {err:"Could not create soundscape job"}. Measured live:
// no soundscape job created between 2026-09-14 03:07:42Z and the fix.
//
// NEGATIVE CONTROL: every assertion in 3a FAILS against the unfixed translator
// (verified by stashing the fold and re-running -- 5 failing, 0 passing).
//
// The class is NOT statically greppable: the literal `false` does not appear in
// the source at all, it is injected by escape() at runtime. So these tests --
// and live dialect_error telemetry -- are the only instruments that can see it.
// ---------------------------------------------------------------------------

const mysql = require('mysql');

describe('translate() — bare boolean literal in a VALUES/list position (42804 fix)', function () {

    // ---- 3a. MUST CHANGE -------------------------------------------------
    it('folds a bare `false` in a VALUES list to 0', function () {
        const out = translate('INSERT INTO t(a, n) VALUES ( 1, false )');
        assert.ok(/VALUES\s*\(\s*1,\s*0\s*\)/.test(out), 'got: ' + out);
        assert.ok(!/\bfalse\b/i.test(out), 'bare false survived: ' + out);
    });

    it('folds a bare `true` in a VALUES list to 1', function () {
        const out = translate('INSERT INTO t(a, n) VALUES ( 1, true )');
        assert.ok(/VALUES\s*\(\s*1,\s*1\s*\)/.test(out), 'got: ' + out);
        assert.ok(!/\btrue\b/i.test(out), 'bare true survived: ' + out);
    });

    it('folds a bool in the FIRST list slot and multiple bools in one list', function () {
        const out = translate('INSERT INTO t(a,b,c) VALUES (true, 2, false)');
        assert.ok(/VALUES\s*\(1,\s*2,\s*0\)/.test(out), 'got: ' + out);
    });

    it('folds bare booleans in an IN list and in a function argument', function () {
        assert.ok(/IN \(1, 0\)/.test(translate('SELECT * FROM t WHERE flag IN (true, false)')));
        assert.ok(/COALESCE\(a, 0\)/.test(translate('SELECT COALESCE(a, false) FROM t')));
    });

    // The whole point: the statement the APP emits, rendered by the REAL driver,
    // end to end -- not a hand-written approximation. (PR #1885 reached prod as a
    // regression because its author validated a hand-written query.)
    it('folds the REAL soundscape_job.new statement, escape()-rendered end to end', function () {
        const p = { job_id: 169996, playlist: 12, maxhertz: 24000, bin: 1,
                    aggregation: 'time_of_day', name: 'soundscape fold probe',
                    threshold: 0.5, threshold_type: 'fixed', frequency: 1,
                    normalize: false };
        const sql =
            'INSERT INTO `job_params_soundscape`( \n' +
            '   `job_id`, `playlist_id`, `max_hertz`, `bin_size`, ' +
            '`soundscape_aggregation_type_id`, `name`, `threshold` , `threshold_type` , ' +
            '`frequency` , `normalize` \n' +
            ') VALUES ( \n' +
            '    ' + mysql.escape([p.job_id, p.playlist, p.maxhertz, p.bin]) + ', \n' +
            '    (SELECT `soundscape_aggregation_type_id` FROM `soundscape_aggregation_types` ' +
            'WHERE `identifier` = ' + mysql.escape(p.aggregation) + '), \n' +
            '    ' + mysql.escape([p.name, p.threshold, p.threshold_type, p.frequency, p.normalize]) +
            ' \n)';

        // The driver really does inline a JS boolean as a BARE SQL boolean --
        // if this stops being true the defect is gone and so is this test's point.
        assert.strictEqual(mysql.escape(false), 'false', 'driver no longer inlines a bare false');
        assert.ok(/,\s*false\s*\n?\s*\)/i.test(sql), 'fixture lost its bare false: ' + sql);

        const out = translate(sql);
        assert.ok(!/(^|[\s,(])false(\s*[,)])/i.test(out),
            'bare boolean survived translate() -> 42804 on a smallint column: ' + out);
        assert.ok(/'fixed', 1, 0/.test(out.replace(/\s+/g, ' ')), 'got: ' + out);
    });

    // ---- 3b. MUST NOT CHANGE --------------------------------------------
    it('does NOT fold a bare boolean in a PREDICATE position (PG requires boolean there)', function () {
        assert.ok(/WHERE \(true\)/.test(translate('SELECT * FROM t WHERE (true)')),
            'WHERE (true) must stay boolean: ' + translate('SELECT * FROM t WHERE (true)'));
        assert.ok(/AND \(false\)/.test(translate('SELECT * FROM t WHERE x = 1 AND (false)')));
        assert.ok(/ON \(true\)/.test(translate('SELECT * FROM a JOIN b ON (true)')));
    });

    it('does NOT touch string CONTENTS containing true/false (protectLiterals)', function () {
        assert.ok(/= 'false'/.test(translate("SELECT * FROM t WHERE name = 'false'")));
        assert.ok(/'a false positive'/.test(translate("SELECT * FROM t WHERE note = 'a false positive'")));
        assert.ok(/'maybe \(false\)'/.test(translate("SELECT * FROM t WHERE note = 'maybe (false)'")));
        assert.ok(/'a, false, b'/.test(translate("SELECT * FROM t WHERE note = 'a, false, b'")));
    });

    it('does NOT touch an identifier named false_positive / is_true', function () {
        const q = 'SELECT false_positive, is_true FROM t WHERE false_positive = 1';
        assert.strictEqual(translate(q), q);
    });

    it('does NOT touch CASE ... THEN true (no list delimiters)', function () {
        const out = translate('SELECT CASE WHEN x THEN true ELSE false END FROM t');
        assert.ok(/THEN true ELSE false END/.test(out), 'got: ' + out);
    });

    // ---- 3c. shapes surfaced by IRR on this very change --------------------
    // The `?` placeholder path inlines a JS boolean too (mysql.format), so the
    // class is WIDER than the 168 app/model escape() sites -- this is the main
    // reason the fold is scoped to list position rather than to VALUES alone.
    it('folds bare booleans arriving via the ? placeholder path (mysql.format)', function () {
        const sql = mysql.format('INSERT INTO t (a,b,c,d,e) VALUES (?, ?, ?, ?, ?)',
                                 [1, false, 'x', true, null]);
        assert.ok(/VALUES \(1, false, 'x', true, NULL\)/.test(sql), 'fixture: ' + sql);
        const out = translate(sql);
        assert.ok(/VALUES \(1, 0, 'x', 1, NULL\)/.test(out), 'got: ' + out);
    });

    it('folds multi-row VALUES, uppercase FALSE, and row-constructor IN lists', function () {
        assert.ok(/VALUES \(1,0\),\(2,1\)/.test(translate('INSERT INTO t(a,b) VALUES (1,false),(2,true)')));
        assert.ok(/VALUES \(1,0\)/.test(translate('INSERT INTO t(a,b) VALUES (1,FALSE)')));
        assert.ok(/IN \(\(1, 1\), \(2, 0\)\)/.test(
            translate('SELECT * FROM t WHERE (a, b) IN ((1, true), (2, false))')));
    });

    // Regression: the first version of this guard folded `AND ((true))` to
    // `((1))` because it only looked one paren back. PG needs a boolean there.
    it('does NOT fold a bare boolean in a NESTED predicate position', function () {
        const q = 'SELECT * FROM t WHERE x AND ((true))';
        assert.strictEqual(translate(q), q);
        assert.strictEqual(translate('SELECT * FROM t WHERE NOT (false)'),
                           'SELECT * FROM t WHERE NOT (false)');
        assert.strictEqual(translate('SELECT * FROM t HAVING (true)'),
                           'SELECT * FROM t HAVING (true)');
        const sub = 'SELECT * FROM t WHERE EXISTS (SELECT 1 FROM u WHERE (true))';
        assert.strictEqual(translate(sub), sub);
    });

    it('is idempotent (translate(translate(x)) === translate(x))', function () {
        ['INSERT INTO t(a,n) VALUES (1, false)',
         'SELECT * FROM t WHERE (true)',
         "SELECT * FROM t WHERE name = 'false'",
         'SELECT * FROM t WHERE flag IN (true, false)'].forEach(function (q) {
            const once = translate(q);
            assert.strictEqual(translate(once), once, 'not idempotent: ' + q);
        });
    });

    it('leaves #1871 comparison cases exactly as they were (no regression)', function () {
        assert.ok(/completed = 1\b/.test(translate('SELECT 1 FROM jobs J WHERE J.completed = true')));
        assert.ok(/hidden = 0\b/.test(translate('SELECT 1 FROM jobs J WHERE J.hidden = false')));
        assert.ok(/!= 1\b/.test(translate('SELECT 1 FROM jobs J WHERE J.completed != true')));
        assert.ok(/<> 0\b/.test(translate('SELECT 1 FROM jobs J WHERE J.completed <> false')));
    });
});
