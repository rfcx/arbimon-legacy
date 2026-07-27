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

console.log('== translator: dialect functions (P6 hardening) ==');
// SUBSTRING_INDEX -> split_part, guarded to |count|=1
eq('subidx last seg', m.translate("SELECT SUBSTRING_INDEX(r.uri, '/', -1) AS f FROM recordings r"),
   "SELECT split_part(r.uri, '/', -1) AS f FROM recordings r");
eq('subidx before dot', m.translate("SELECT SUBSTRING_INDEX(m.uri, '.', 1) FROM models m"),
   "SELECT split_part(m.uri, '.', 1) FROM models m");
eq('subidx backtick+spaces', m.translate("SELECT SUBSTRING_INDEX( r.`uri` , '.', 1 ) FROM recordings r"),
   "SELECT split_part(r.uri, '.', 1) FROM recordings r");
// NOTE: backtick `uri` -> bare uri (T14 fold); args are trimmed by splitTopArgs
eq('subidx count>1 NOT rewritten (would be wrong)', m.translate("SELECT SUBSTRING_INDEX(a, '/', 2) FROM t"),
   "SELECT SUBSTRING_INDEX(a, '/', 2) FROM t");
// YEAR/MONTH/DAY/HOUR -> EXTRACT
eq('year->extract', m.translate('SELECT YEAR(R.datetime) as year FROM recordings R'),
   'SELECT EXTRACT(YEAR FROM R.datetime)::int as year FROM recordings R');
eq('month+day both', m.translate('SELECT MONTH(r.datetime) m, DAY(r.datetime) d FROM t r'),
   'SELECT EXTRACT(MONTH FROM r.datetime)::int m, EXTRACT(DAY FROM r.datetime)::int d FROM t r');
// DATE_FORMAT -> to_char (double-quoted MySQL format string too)
eq('date_format mdy hi', m.translate("SELECT date_format(r.datetime,'%m-%d-%Y %H:%i') FROM t r"),
   "SELECT to_char(r.datetime, 'MM-DD-YYYY HH24:MI') FROM t r");
eq('date_format ymd dquote', m.translate('SELECT DATE_FORMAT(r.datetime, "%Y/%m/%d") as date FROM t r'),
   "SELECT to_char(r.datetime, 'YYYY/MM/DD') as date FROM t r");
eq('date_format %T', m.translate('SELECT DATE_FORMAT(r.datetime, "%T") FROM t r'),
   "SELECT to_char(r.datetime, 'HH24:MI:SS') FROM t r");
// unknown code: the CALL bails (stays DATE_FORMAT -> honest 42883) but the
// dq-literal is still converted to a PG string literal (see restoreLiteralsPg).
eq('date_format unknown code bails', m.translate('SELECT DATE_FORMAT(x, "%Q") FROM t'),
   "SELECT DATE_FORMAT(x, '%Q') FROM t");
// GROUP_CONCAT -> string_agg
eq('group_concat w/ separator', m.translate("SELECT GROUP_CONCAT(a.alias SEPARATOR ', ') FROM species_aliases a"),
   "SELECT string_agg((a.alias)::text, ', ') FROM species_aliases a");
eq('group_concat default sep', m.translate('SELECT GROUP_CONCAT(x) FROM t'),
   "SELECT string_agg((x)::text, ',') FROM t");
// IF -> CASE (incl. nested), ISNULL -> IS NULL
eq('if->case', m.translate('SELECT IF(a IS NULL, 0, 1) FROM t'),
   'SELECT CASE WHEN a IS NULL THEN 0 ELSE 1 END FROM t');
eq('nested if->case', m.translate('SELECT IF(x=1, 1, IF(y=1, 1, 0)) FROM t'),
   'SELECT CASE WHEN x=1 THEN 1 ELSE CASE WHEN y=1 THEN 1 ELSE 0 END END FROM t');
eq('isnull->is null', m.translate('SELECT IF(ISNULL(p.present), 1, 0) FROM t p'),
   'SELECT CASE WHEN (p.present IS NULL) THEN 1 ELSE 0 END FROM t p');
// ROUND(x,n) -> numeric cast
eq('round two-arg', m.translate('SELECT ROUND(TSD.y2-TSD.y1,1) FROM t TSD'),
   'SELECT round((TSD.y2-TSD.y1)::numeric, 1) FROM t TSD');
eq('round one-arg untouched', m.translate('SELECT ROUND(x) FROM t'), 'SELECT ROUND(x) FROM t');
// TRUNCATE(x,n) -> trunc((x)::numeric,n) (MySQL toward-zero == PG trunc, both signs)
eq('truncate two-arg', m.translate('SELECT TRUNCATE(pmr.x1, 3) FROM t pmr'),
   'SELECT trunc((pmr.x1)::numeric, 3) FROM t pmr');
eq('truncate one-arg untouched', m.translate('SELECT TRUNCATE(x) FROM t'), 'SELECT TRUNCATE(x) FROM t');
// backticked NON-PLAIN identifier (export SQLBuilder escapeId aliases like
// `val<Genus species/Song>`) -> PG quoted identifier (bare would be a syntax
// error; MariaDB backtick + PG double-quote yield the SAME result key).
eq('backtick special-char alias -> quoted ident',
   m.translate('SELECT x AS `val<Genus species/Song>` FROM t'),
   'SELECT x AS "val<Genus species/Song>" FROM t');
eq('backtick plain ident still bare',
   m.translate('SELECT `plain_col` FROM t'), 'SELECT plain_col FROM t');
// FORCE INDEX stripped
eq('force index stripped', m.translate('SELECT r.recording_id FROM recordings AS r FORCE INDEX (idx) JOIN sites s ON s.site_id=r.site_id'),
   'SELECT r.recording_id FROM recordings AS r JOIN sites s ON s.site_id=r.site_id');
// quoted alias -> double-quoted identifier; string-value literals untouched
eq('quoted alias', m.translate("SELECT CONCAT('a', A.job_id) as 'uri' FROM aed A"),
   'SELECT CONCAT(\'a\', A.job_id) as "uri" FROM aed A');
eq('multi-word quoted alias -> identifier', m.translate("SELECT x as 'a b' FROM t"),
   'SELECT x as "a b" FROM t');
// literal protection: none of the above touch matching text inside a string
// -- double-quoted string literals (MySQL) -> single-quoted (PG). Live P6
// canary classes: J.state = "completed" resolved as IDENTIFIER on PG ->
// 42883 job_state=smallint (AED) / 42702 ambiguous "completed" (PM).
eq('dq literal -> sq literal', m.translate('SELECT J.state FROM jobs J WHERE J.state = "completed"'),
   "SELECT J.state FROM jobs J WHERE J.state = 'completed'");
eq('dq literal with embedded sq', m.translate('SELECT a FROM t WHERE b = "it\'s"'),
   "SELECT a FROM t WHERE b = 'it''s'");
eq('dq literal doubled dq', m.translate('SELECT a FROM t WHERE b = "a""b"'),
   "SELECT a FROM t WHERE b = 'a\"b'");
// -- MySQL backslash-escape DECODING (rfcx-local 2026-07-27).
// Supersedes the former "backslash punts" assertion: punting produced live
// 42601s (site name `SNR ''Kraljevac''`, 2026-07-27T10:18:26Z) and, worse,
// SILENT wrong values for \n/\t (PG standard_conforming_strings=on reads
// 'a\nb' as literal backslash+n — proven live). Expected values below are
// MEASURED cross-engine, not assumed.
// MySQL "x\\y" is the 3-char string x\y (live: LENGTH=3); PG writes that as
// 'x\y' with standard_conforming_strings=on (live: length=3).
eq('dq literal backslash decodes', m.translate('SELECT a FROM t WHERE b = "x\\\\y"'),
   "SELECT a FROM t WHERE b = 'x\\y'");
// THE LIVE 42601 CASE: mysql driver escapes ' as \' — site 88347.
eq('sq literal escaped quotes (live Kraljevac 42601)',
   m.translate("SELECT count(*) as count FROM sites WHERE name = 'SNR \\'\\'Kraljevac\\'\\'' AND project_id = 8740"),
   "SELECT count(*) as count FROM sites WHERE name = 'SNR ''''Kraljevac''''' AND project_id = 8740");
eq('sq literal single escaped quote (O\'Brien class)',
   m.translate("SELECT a FROM t WHERE b = 'O\\'Brien'"),
   "SELECT a FROM t WHERE b = 'O''Brien'");
// THE SILENT CASE: \n must become a REAL newline, not backslash+n.
eq('sq literal newline decodes to real newline',
   m.translate("SELECT a FROM t WHERE b = 'a\\nb'"),
   "SELECT a FROM t WHERE b = 'a\nb'");
eq('sq literal tab decodes to real tab',
   m.translate("SELECT a FROM t WHERE b = 'a\\tb'"),
   "SELECT a FROM t WHERE b = 'a\tb'");
// LIKE metacharacter escapes: MySQL KEEPS the backslash (live: LENGTH('a\\%b')
// = 4), so decoding them would silently change LIKE semantics.
eq('sq literal keeps \\% for LIKE', m.translate("SELECT a FROM t WHERE b LIKE 'a\\%b'"),
   "SELECT a FROM t WHERE b LIKE 'a\\%b'");
eq('sq literal keeps \\_ for LIKE', m.translate("SELECT a FROM t WHERE b LIKE 'a\\_b'"),
   "SELECT a FROM t WHERE b LIKE 'a\\_b'");
// Unknown escape -> bare char (live: '[a\\qb]' -> [aqb]).
eq('sq literal unknown escape drops backslash', m.translate("SELECT a FROM t WHERE b = 'a\\qb'"),
   "SELECT a FROM t WHERE b = 'aqb'");
// NUL is unrepresentable in PG text -> punt verbatim (honest dialect_error).
eq('sq literal NUL punts verbatim', m.translate("SELECT a FROM t WHERE b = 'a\\0b'"),
   "SELECT a FROM t WHERE b = 'a\\0b'");
eq('quoted alias still wins over dq-literal', m.translate("SELECT CONCAT(a,b) as 'uri' FROM t"),
   'SELECT CONCAT(a,b) as "uri" FROM t');
// -- ORDER BY FIELD -> COALESCE(array_position(...), 0) (54023 >100-arg class)
eq('field -> array_position', m.translate('SELECT r.id FROM r ORDER BY FIELD(r.id, 5, 3, 9)'),
   'SELECT r.id FROM r ORDER BY COALESCE(array_position(ARRAY[5, 3, 9], r.id), 0)');
eq('field non-numeric tail bails', m.translate('SELECT FIELD(x, 1, col) FROM t'),
   'SELECT FIELD(x, 1, col) FROM t');
// -- TIMESTAMPDIFF -> epoch math (42703 column "second" class, models.js)
eq('timestampdiff second', m.translate('SELECT TIMESTAMPDIFF(SECOND, a.c1, b.c2) as joblength FROM t'),
   'SELECT trunc(EXTRACT(EPOCH FROM ((b.c2) - (a.c1))))::bigint as joblength FROM t');
eq('timestampdiff minute', m.translate('SELECT TIMESTAMPDIFF(MINUTE, a, b) FROM t'),
   'SELECT trunc(EXTRACT(EPOCH FROM ((b) - (a))) / 60)::bigint FROM t');
eq('timestampdiff month bails (inexact)', m.translate('SELECT TIMESTAMPDIFF(MONTH, a, b) FROM t'),
   'SELECT TIMESTAMPDIFF(MONTH, a, b) FROM t');

eq('func name inside string untouched', m.translate("SELECT a FROM t WHERE note = 'call YEAR(x) and IF(y)'"),
   "SELECT a FROM t WHERE note = 'call YEAR(x) and IF(y)'");
eq('column named year (no paren) untouched', m.translate('SELECT year FROM summary'),
   'SELECT year FROM summary');

console.log('== compare: app-injected phantom column (users.picture) ==');
// Same SQL both engines; MariaDB row gained a `picture` col the app attached
// after the callback (in NEITHER schema). Must NOT be a divergence.
eq('phantom col on maria ignored',
   m.compare('SELECT * FROM users WHERE email = \'x\'',
     [{user_id:1, email:'x', firstname:'A', picture:'http://p/x.png'}],
     [{user_id:1, email:'x', firstname:'A'}], 1e-9), null);
// PG-ONLY extra column is NOT an app mutation (app never mutates PG rows) ->
// it signals a real translation/aliasing artifact and MUST be reported.
eq('pg-only extra col is reported',
   m.compare('SELECT * FROM users WHERE email = \'x\'',
     [{user_id:1, email:'x'}],
     [{user_id:1, email:'x', extra:'z'}], 1e-9).klass, 'result_mismatch');
// A REAL value diff on a SHARED column is still caught (intersection compare).
eq('real shared-col diff still caught',
   m.compare('SELECT * FROM users WHERE email = \'x\'',
     [{user_id:1, email:'x', firstname:'A', picture:'p'}],
     [{user_id:1, email:'x', firstname:'B'}], 1e-9).klass, 'result_mismatch');
// No shared columns at all IS a real structural divergence.
eq('no shared cols is real',
   m.compare('SELECT a FROM t', [{a:1}], [{b:2}], 1e-9).klass, 'result_mismatch');

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

// -- Phase 6.4 response routing: COLUMN-CASE RESTORATION -------------------
// PG folds unquoted identifiers to lowercase and the migrated schema is
// all-lowercase, so PG returns `typeid` where MariaDB returns `typeId`. The
// shadow's comparator lowercases keys before diffing, so it is structurally
// BLIND to this class — these tests are the only guard. Live surface measured
// 2026-07-27: 8 camelCase columns / 4 tables + ~20 camelCase aliases.
var ccm = m.columnCaseMap('SELECT SCC.id, SCC.name, SCC.isSystemClass, SCC.typeId FROM soundscape_composition_classes SCC');
eq('caseMap picks up isSystemClass', ccm && ccm.issystemclass, 'isSystemClass');
eq('caseMap picks up typeId', ccm && ccm.typeid, 'typeId');
// The real live shape from app/model/soundscape-composition.js:104.
var pgRow = [{ id: 7, name: 'Birds', issystemclass: 1, typeid: 2 }];
var restored = m.restoreRowCase(pgRow, ccm);
eq('restored row exposes isSystemClass', restored[0].isSystemClass, 1);
eq('restored row exposes typeId', restored[0].typeId, 2);
eq('restored row keeps lowercase cols', restored[0].name, 'Birds');
eq('restored row drops folded key', restored[0].issystemclass, undefined);
// camelCase ALIASES must round-trip too (`as recUri`, `as maxSiteId`, …).
var am = m.columnCaseMap('SELECT r.uri as recUri, MAX(s.site_id) as maxSiteId FROM recordings r');
eq('caseMap picks up alias recUri', am && am.recuri, 'recUri');
var ar = m.restoreRowCase([{ recuri: 'a/b.flac', maxsiteid: 9 }], am);
eq('restored alias recUri', ar[0].recUri, 'a/b.flac');
eq('restored alias maxSiteId', ar[0].maxSiteId, 9);
// All-lowercase SQL must be a no-op (no map, rows untouched by identity).
eq('all-lowercase sql -> no case map',
   m.columnCaseMap('select site_id, name from sites where project_id = 1'), null);
eq('no-op restore returns rows unchanged',
   m.restoreRowCase([{ site_id: 1 }], null)[0].site_id, 1);
// Routing eligibility mirrors the shadow allowlist: writes never route to PG.
eq('pgRouteEligible allows plain select',
   m.pgRouteEligible('SELECT a FROM t WHERE b = 1'), true);
eq('pgRouteEligible refuses update',
   m.pgRouteEligible('UPDATE t SET a = 1 WHERE b = 2'), false);
eq('pgRouteEligible refuses insert',
   m.pgRouteEligible('INSERT INTO t (a) VALUES (1)'), false);

console.log('\n' + (fails ? ('FAILED ' + fails + '/' + n) : ('ALL ' + n + ' PASS')));
process.exit(fails ? 1 : 0);
