'use strict';
// Self-test for dbpool-pg.js — classifier + translator + normalizer.
// Run: DB_ENGINE=shadow node app/utils/dbpool-pg.selftest.js
// (shadow engine set so module exports are live; no PG connection is made —
//  we only test the pure functions.)
process.env.DB_ENGINE = process.env.DB_ENGINE || 'mysql'; // pure fns don't need shadow
var m = require('./dbpool-pg');
var fails = 0, n = 0;
function eq(label, got, want) {
    n++;
    var g = JSON.stringify(got), w = JSON.stringify(want);
    if (g !== w) { fails++; console.log('FAIL', label, '\n   got ', g, '\n   want', w); }
    else { console.log('ok  ', label); }
}
function classifyReplayable(sql) { return m.classify(sql).replayable; }

console.log('== classifier ==');
eq('plain select', classifyReplayable('SELECT * FROM projects WHERE project_id = 5'), true);
eq('select with join+groupby', classifyReplayable('SELECT p.project_id, COUNT(*) FROM projects p JOIN sites s ON s.project_id=p.project_id GROUP BY p.project_id'), true);
eq('with-cte select', classifyReplayable('WITH x AS (SELECT 1 AS a) SELECT a FROM x'), true);
eq('reject insert', classifyReplayable('INSERT INTO jobs (state) VALUES ("waiting")'), false);
eq('reject update', classifyReplayable('UPDATE jobs SET state="processing" WHERE job_id=1'), false);
eq('reject delete', classifyReplayable('DELETE FROM jobs WHERE job_id=1'), false);
eq('reject for update', classifyReplayable('SELECT * FROM jobs WHERE job_id=1 FOR UPDATE'), false);
eq('reject multi-stmt', classifyReplayable('SELECT 1; SELECT 2'), false);
eq('reject now()', classifyReplayable('SELECT NOW()'), false);
eq('reject last_insert_id', classifyReplayable('SELECT LAST_INSERT_ID()'), false);
eq('reject user var', classifyReplayable('SELECT @x'), false);
eq('reject into outfile', classifyReplayable('SELECT * FROM t INTO OUTFILE "/tmp/x"'), false);
eq('col named update in string ok', classifyReplayable("SELECT * FROM t WHERE name = 'update me'"), true);
eq('backtick col update ok', classifyReplayable('SELECT `update` FROM t'), true);
eq('rand forbidden', classifyReplayable('SELECT * FROM t ORDER BY RAND()'), false);
// desc as order modifier is fine (not statement-initial DESCRIBE)
eq('order by desc ok', classifyReplayable('SELECT a FROM t ORDER BY a DESC'), true);

console.log('== translator ==');
eq('backtick reserved -> quoted', m.translate('SELECT `order` FROM `project_soundscape_composition_classes`'),
   'SELECT "order" FROM project_soundscape_composition_classes');
eq('backtick normal -> bare', m.translate('SELECT `job_id`, `name` FROM `jobs`'),
   'SELECT job_id, name FROM jobs');
eq('limit offset,count', m.translate('SELECT a FROM t ORDER BY a LIMIT 20, 10'),
   'SELECT a FROM t ORDER BY a LIMIT 10 OFFSET 20');
eq('limit offset,count placeholder-free (jobs.js:587)', m.translate("SELECT * FROM jobs LIMIT 0, 100"),
   'SELECT * FROM jobs LIMIT 100 OFFSET 0');
eq('ifnull->coalesce', m.translate('SELECT IFNULL(a, 0) FROM t'), 'SELECT COALESCE(a, 0) FROM t');
eq('backtick inside string untouched', m.translate("SELECT `name` FROM t WHERE x = '`literal`'"),
   "SELECT name FROM t WHERE x = '`literal`'");
eq('limit inside string untouched', m.translate("SELECT a FROM t WHERE note = 'LIMIT 1, 2'"),
   "SELECT a FROM t WHERE note = 'LIMIT 1, 2'");

console.log('== template/hash ==');
eq('template collapses literals+IN arity',
   m.sqlTemplate("SELECT * FROM t WHERE id IN (1,2,3) AND name='x' AND n=5"),
   'SELECT * FROM t WHERE id IN (?) AND name=? AND n=?');
eq('same template same hash',
   m.templateHash("SELECT * FROM t WHERE id=1") === m.templateHash("SELECT * FROM t WHERE id=999"), true);

console.log('== normalizer/compare ==');
// identical
eq('identical rows equal', m.compare('SELECT a,b FROM t', [{a:1,b:'x'}], [{a:1,b:'x'}], 1e-9), null);
// int vs decimal-string (pg numeric) bridge
eq('int==numeric-string', m.compare('SELECT a FROM t', [{a:5}], [{a:'5'}], 1e-9), null);
// tinyint 1 vs boolean true
eq('tinyint1==bool', m.compare('SELECT a FROM t', [{a:1}], [{a:true}], 1e-9), null);
// column-name case-insensitive
eq('colname case-insensitive', m.compare('SELECT A FROM t', [{A:1}], [{a:1}], 1e-9), null);
// no-order-by: row order should not matter
eq('unordered set equal reordered', m.compare('SELECT a FROM t', [{a:1},{a:2}], [{a:2},{a:1}], 1e-9), null);
// order-by: different order -> ordering_only
var ord = m.compare('SELECT a FROM t ORDER BY a', [{a:1},{a:2}], [{a:2},{a:1}], 1e-9);
eq('ordered different -> ordering_only', ord && ord.klass, 'ordering_only');
// genuine mismatch
var mm = m.compare('SELECT a FROM t', [{a:1}], [{a:2}], 1e-9);
eq('genuine value diff -> result_mismatch', mm && mm.klass, 'result_mismatch');
// row count diff
var rc = m.compare('SELECT a FROM t', [{a:1}], [{a:1},{a:2}], 1e-9);
eq('row count diff -> result_mismatch', rc && rc.klass, 'result_mismatch');
// float epsilon
eq('float within epsilon equal', m.compare('SELECT a FROM t', [{a:1.0000000001}], [{a:1.0}], 1e-9), null);
// null vs empty NOT equal (T4 policy)
var ne = m.compare('SELECT a FROM t', [{a:null}], [{a:''}], 1e-9);
eq('null != empty (T4)', ne && ne.klass, 'result_mismatch');

console.log('\n' + (fails ? ('FAILED ' + fails + '/' + n) : ('ALL ' + n + ' PASS')));
process.exit(fails ? 1 : 0);
