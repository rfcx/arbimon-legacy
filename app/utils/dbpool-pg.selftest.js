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
// NOTE (2026-07-28): the expected CONCAT form changed when CONCAT gained
// NULL-propagating `||` translation. The SUBJECT of this test is the quoted
// ALIAS, which is unchanged; only the (now-translated) CONCAT body moved.
eq('quoted alias', m.translate("SELECT CONCAT('a', A.job_id) as 'uri' FROM aed A"),
   'SELECT ((\'a\')::text || (A.job_id)) as "uri" FROM aed A');
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
// (2026-07-28: expectation updated for the bare-= fold — `name = <lit>` on a
// FROM-narrowed sites query now folds. The SUBJECT of this test is the
// escaped-literal decoding, which must survive INSIDE the fold arguments.)
eq('sq literal escaped quotes (live Kraljevac 42601)',
   m.translate("SELECT count(*) as count FROM sites WHERE name = 'SNR \\'\\'Kraljevac\\'\\'' AND project_id = 8740"),
   "SELECT count(*) as count FROM sites WHERE translate(lower(name),'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ','aaaaaaeeeeiiiiooooouuuucny.') = translate(lower('SNR ''''Kraljevac'''''),'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ','aaaaaaeeeeiiiiooooouuuucny.') AND project_id = 8740");
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
// (same note as 'quoted alias' above: the alias is the subject, the CONCAT
// body is now `||`-translated for MySQL NULL-propagation parity.)
eq('quoted alias still wins over dq-literal', m.translate("SELECT CONCAT(a,b) as 'uri' FROM t"),
   'SELECT ((a)::text || (b)) as "uri" FROM t');
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
// REGRESSION GUARDS for the self-review defect (2026-07-27): string-literal
// contents and SQL keywords must NEVER become case-map entries. The first
// version of columnCaseMap mapped completed -> 'Completed' from the literal
// below and renamed the real jobs.completed result key.
var litMap = m.columnCaseMap("SELECT j.job_id, j.completed FROM jobs j WHERE j.state = 'Completed'");
eq('literal contents never enter case map', litMap, null);
eq('literal case defect: completed key preserved',
   m.restoreRowCase([{ job_id: 5, completed: 1 }], litMap)[0].completed, 1);
eq('literal case defect: no Completed key',
   m.restoreRowCase([{ job_id: 5, completed: 1 }], litMap)[0].Completed, undefined);
// dq literals too (MySQL string literals).
eq('dq literal contents never enter case map',
   m.columnCaseMap('SELECT a FROM t WHERE b = "MixedCase"'), null);
// Uppercase SQL keywords must not be treated as identifiers.
eq('keywords never enter case map',
   m.columnCaseMap('SELECT a FROM t WHERE b IS NOT NULL ORDER BY a DESC'), null);
// ...while a genuine camelCase column in the same shape still resolves.
var mixMap = m.columnCaseMap("SELECT SCC.typeId FROM soundscape_composition_classes SCC WHERE SCC.name = 'Birds' ORDER BY SCC.typeId DESC");
eq('camelCase survives alongside literals+keywords', mixMap && mixMap.typeid, 'typeId');
eq('camelCase map has no literal entry', mixMap && mixMap.birds, undefined);
// Qualified names map on their trailing component (the result key).
eq('qualified name maps trailing component',
   m.columnCaseMap('SELECT SCC.isSystemClass FROM t SCC').issystemclass, 'isSystemClass');

// Routing eligibility mirrors the shadow allowlist: writes never route to PG.
eq('pgRouteEligible allows plain select',
   m.pgRouteEligible('SELECT a FROM t WHERE b = 1'), true);
eq('pgRouteEligible refuses update',
   m.pgRouteEligible('UPDATE t SET a = 1 WHERE b = 2'), false);
eq('pgRouteEligible refuses insert',
   m.pgRouteEligible('INSERT INTO t (a) VALUES (1)'), false);

// ---------------------------------------------------------------- collation
// MySQL compares every arbimon2 string ci; PG compares varchar/text cs.
// The fold reproduces MySQL semantics PER COLLATION (the two disagree on
// umlauts). Measured live 2026-07-27; runbook:
// runbooks/mysql2pg-p6-collation-case-sensitivity-2026-07-27.md
var GEN = "translate(lower(%s),'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ','aaaaaaeeeeiiiiooooouuuucny.')";
var SV  = "translate(lower(%s),'áàâãéèêëíìîïóòôõúùûçñýÿ','aaaaeeeeiiiioooouuucny.')";
function g(x) { return GEN.replace('%s', x); }
function v(x) { return SV.replace('%s', x); }

// -- alias resolution (REQUIRED: the same alias means different tables)
eq('collation: alias T -> tags (gen)',
   m.collationClass('T.tag', m.aliasMap('SELECT T.tag FROM tags T WHERE T.tag LIKE ?')),
   'gen');
eq('collation: alias T -> templates (sv)',
   m.collationClass('T.name', m.aliasMap('SELECT T.name FROM templates as T WHERE T.name LIKE ?')),
   'sv');
eq('collation: pattern_matchings.name is sv',
   m.collationClass('PM.name', m.aliasMap('SELECT PM.name FROM pattern_matchings as PM WHERE PM.name LIKE ?')),
   'sv');
eq('collation: projects.name is gen',
   m.collationClass('P.name', m.aliasMap('SELECT P.name FROM projects P WHERE P.name LIKE ?')),
   'gen');

// -- FAIL-SAFE: never guess. Unresolvable -> untouched.
eq('collation: bare column is UNRESOLVED',
   m.collationClass('name', m.aliasMap('SELECT name FROM templates WHERE name LIKE ?')),
   null);
eq('collation: unknown alias is UNRESOLVED',
   m.collationClass('X.name', m.aliasMap('SELECT a FROM (SELECT name FROM templates) X')),
   null);
eq('collation: unknown column is UNRESOLVED',
   m.collationClass('T.no_such_col', m.aliasMap('SELECT 1 FROM templates T')),
   null);
eq('collation: unresolved predicate left untouched',
   m.translate('SELECT a FROM nosuchtable T WHERE T.whatever LIKE ?'),
   'SELECT a FROM nosuchtable T WHERE T.whatever LIKE ?');

// -- the folds actually applied
eq('collation: LIKE on a gen column folds accents+case',
   m.translate('SELECT T.tag FROM tags T WHERE T.tag LIKE ?'),
   'SELECT T.tag FROM tags T WHERE ' + g('T.tag') + ' LIKE ' + g('?'));
eq('collation: LIKE on an sv column keeps umlauts distinct',
   m.translate('SELECT T.name FROM templates as T WHERE T.name LIKE ?'),
   'SELECT T.name FROM templates as T WHERE ' + v('T.name') + ' LIKE ' + v('?'));
eq('collation: NOT LIKE is folded too (negation must not invert)',
   m.translate('SELECT T.tag FROM tags T WHERE T.tag NOT LIKE ?'),
   'SELECT T.tag FROM tags T WHERE ' + g('T.tag') + ' NOT LIKE ' + g('?'));
eq('collation: = is folded (the surface is LARGER than LIKE)',
   m.translate('SELECT T.tag FROM tags T WHERE T.tag = ?'),
   'SELECT T.tag FROM tags T WHERE ' + g('T.tag') + ' = ' + g('?'));
eq('collation: <> is folded',
   m.translate('SELECT T.tag FROM tags T WHERE T.tag <> ?'),
   'SELECT T.tag FROM tags T WHERE ' + g('T.tag') + ' <> ' + g('?'));

// -- REGRESSION GUARDS for the defects found while building this
// (1) PG native enums: folding is a HARD type error. jobs.state is the
//     hottest predicate in the LIVE PG jobs plane. Caught by an existing
//     test failing -- exactly what regression tests are for.
eq('collation: enum jobs.state NEVER folded (hard PG type error)',
   m.translate('SELECT J.state FROM jobs J WHERE J.state = "completed"'),
   "SELECT J.state FROM jobs J WHERE J.state = 'completed'");
eq('collation: enum resolves to null',
   m.collationClass('J.state', m.aliasMap('SELECT 1 FROM jobs J')),
   null);
eq('collation: enum job_tasks.status never folded',
   m.collationClass('JT.status', m.aliasMap('SELECT 1 FROM job_tasks JT')),
   null);
// (2) <=> is MySQL null-safe equality; folding would change NULL semantics.
eq('collation: <=> left alone (null-safe equality)',
   m.translate('SELECT T.tag FROM tags T WHERE T.tag <=> ?'),
   'SELECT T.tag FROM tags T WHERE T.tag <=> ?');
// (3) a cross-collation column pair must NOT be coerced to one side.
eq('collation: sv vs gen column pair left alone',
   m.translate('SELECT 1 FROM templates T JOIN projects P ON T.name = P.name'),
   'SELECT 1 FROM templates T JOIN projects P ON T.name = P.name');
// (4) literal contents must never be scanned as identifiers (the #1782 lesson).
eq('collation: literal text is not an operand',
   m.translate("SELECT T.tag FROM tags T WHERE T.tag = 'P.name = x'"),
   "SELECT T.tag FROM tags T WHERE " + g('T.tag') + " = " + g("'P.name = x'"));

// -- the real divergent template resolves BOTH classes in ONE query
(function () {
    var sql = 'SELECT count(*) FROM templates as T JOIN projects P ON T.project_id = P.project_id '
            + 'LEFT JOIN projects P2 ON T.source_project_id = P2.project_id '
            + 'WHERE T.name LIKE ? OR P2.name LIKE ?';
    var out = m.translate(sql);
    eq('collation: mixed sv+gen in one query (templates sv)',
       out.indexOf(v('T.name')) >= 0, true);
    eq('collation: mixed sv+gen in one query (projects gen)',
       out.indexOf(g('P2.name')) >= 0, true);
})();

// -- ADVERSARIAL GUARDS: only *_ci STRING columns may be folded.
// COLLATION_KNOWN is built from information_schema rows with a non-NULL
// COLLATION_NAME, so numeric/date/binary columns are structurally absent and
// hit the UNRESOLVED fail-safe. These pin that property: folding a bigint
// would be a PG type error, and folding a join key would wreck plans.
function unfolded(sql) { return m.translate(sql).indexOf('translate(lower(') < 0; }
eq('collation: numeric columns never fold (recording_id)',
   unfolded('SELECT 1 FROM recordings R WHERE R.recording_id = 42'), true);
eq('collation: numeric columns never fold (site_id)',
   unfolded('SELECT 1 FROM sites S WHERE S.site_id = 5'), true);
eq('collation: tinyint flags never fold',
   unfolded('SELECT 1 FROM pattern_matchings PM WHERE PM.deleted = 0'), true);
eq('collation: datetime never folds',
   unfolded("SELECT 1 FROM recordings R WHERE R.datetime = '2026-01-01'"), true);
eq('collation: numeric JOIN keys never fold',
   unfolded('SELECT 1 FROM recordings R JOIN sites S ON S.site_id = R.site_id'), true);

// ------------------------------------------------- float4 canonicalization
// MariaDB renders float32 as C %.6g (half-even); PG renders shortest-
// roundtrip. canonValue must converge the two renderings of the SAME stored
// value while keeping genuinely different values apart. All 'live pairs'
// below were MEASURED on production rows 2026-07-28 (aedc 240283170 batch +
// pm_rois 1140661357); see the p6 collation runbook §7f-7g.
function cv(x) { return m.compare('SELECT a FROM t ORDER BY a',
    [{ a: x }], [{ a: x }], 1e-9); }
function cvPair(a, b) { return m.compare('SELECT a FROM t ORDER BY a',
    [{ a: a }], [{ a: b }], 1e-9); }

// -- live pairs: maria-rendering vs pg-rendering of the SAME float32
[[7.92533, 7.9253335], [9.25867, 9.258667], [22171.9, 22171.875],
 [18843.8, 18843.75], [21281.2, 21281.25], [30.1547, 30.154667],
 [1734.38, 1734.375], [11.1573, 11.157333], [52.0475, 52.047527],
 [0.691209, 0.69120884]].forEach(function (p) {
    eq('float4: live pair equal ' + p[0] + '~' + p[1], cvPair(p[0], p[1]), null);
});
// -- genuinely different values MUST still diverge
[[7.92533, 7.92534], [22171.9, 22172.0], [0.691209, 0.69121],
 [1.0, 1.00001]].forEach(function (p) {
    eq('float4: distinct pair differs ' + p[0] + ' vs ' + p[1],
       cvPair(p[0], p[1]) !== null, true);
});
// -- g6HalfEven unit behaviour
eq('g6: half-even rounds 21281.25 DOWN (C semantics, not JS half-away)',
   m.g6HalfEven(21281.25), '21281.2');
eq('g6: integer-like float32 keeps its zeros (the fuzz-harness bug class)',
   m.g6HalfEven(28000.0000001), '28000');
eq('g6: negative values', m.g6HalfEven(-93579.953125), '-93580');
eq('g6: small values scale-free', m.g6HalfEven(0.69120884), '0.691209');
eq('g6: zero', m.g6HalfEven(0), '0');
// -- integers are untouched (fast-path unchanged)
eq('float4: integer columns unaffected', cvPair(42, 42), null);
eq('float4: integer mismatch still fires', cvPair(42, 43) !== null, true);
// -- decimal-as-string tail path uses the SAME canonicalization
eq('float4: pg-numeric string vs mysql float converge',
   cvPair('7.9253335', 7.92533), null);

console.log('== CONCAT NULL-propagation (P6 2026-07-28) ==');
// MySQL CONCAT returns NULL if ANY arg is NULL; PG's concat() FUNCTION ignores
// NULLs, but the `||` OPERATOR propagates. Measured live: MariaDB
// CONCAT('https://x/', NULL) IS NULL -> 1; PG concat(...) -> 'https://x/'.
eq('concat: 2-arg -> || with leading text cast',
   m.translate("SELECT CONCAT('https://x/', T.uri) FROM templates T"),
   "SELECT (('https://x/')::text || (T.uri)) FROM templates T");
eq('concat: numeric operands get a text cast (PG has no int||int)',
   m.translate('SELECT CONCAT(a, b) FROM t'),
   'SELECT ((a)::text || (b)) FROM t');
eq('concat: 3-arg',
   m.translate("SELECT CONCAT(a, ' ', b) FROM t"),
   "SELECT ((a)::text || (' ') || (b)) FROM t");
// GROUP_CONCAT must be untouched by the CONCAT rule: rewriteCall's name
// boundary is (^|[^A-Za-z0-9_.]) and GROUP_CONCAT's CONCAT is preceded by '_'.
eq('concat: GROUP_CONCAT still becomes string_agg, not ||',
   m.translate("SELECT GROUP_CONCAT(sa.alias SEPARATOR ', ') FROM species_aliases sa"),
   "SELECT string_agg((sa.alias)::text, ', ') FROM species_aliases sa");
eq('concat: nested CONCAT resolves (author expression shape)',
   /\(\(\(/.test(m.translate("SELECT CONCAT(CONCAT(a,b),' ',CONCAT(c,d)) FROM t")), true);
eq('concat: no || left un-parenthesised inside GROUP_CONCAT',
   /string_agg/.test(m.translate("SELECT GROUP_CONCAT(CONCAT(a,b) SEPARATOR ',') FROM t")), true);

console.log('== ORDER BY per-collation fold (P6 2026-07-28) ==');
var OB = function (sql) { var p = m.translate(sql).split(/order\s+by/i); return p.length > 1 ? p.slice(1).join(' ') : ''; };
var isFolded = function (sql) { return /translate\(lower\(/.test(OB(sql)); };
// gen-class column (utf8mb3_general_ci)
eq('orderby: tags.tag folds (gen)',
   /translate\(lower\(T\.tag\),'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ'/.test(OB(
     'SELECT T.tag FROM tags T ORDER BY T.tag LIMIT 20')), true);
// sv-class column (latin1_swedish_ci) -- MUST use the swedish fold, which
// KEEPS umlauts distinct (measured: MariaDB sorts apple,zebra,äpple)
eq('orderby: templates.name folds with the SV fold (umlauts distinct)',
   /translate\(lower\(T\.name\),'áàâãéèêëíìîïóòôõúùûçñýÿ'/.test(OB(
     'SELECT T.name FROM templates T ORDER BY T.name DESC')), true);
eq('orderby: direction preserved', /DESC/.test(OB(
   'SELECT T.name FROM templates T ORDER BY T.name DESC')), true);
eq('orderby: mixed keys -- only the string key folds',
   /translate\(lower\(S\.name\).*ASC, S\.site_id ASC/.test(OB(
     'SELECT S.site_id FROM sites S ORDER BY S.name ASC, S.site_id ASC LIMIT 10')), true);
// fail-safe cases: never guess
eq('orderby: bare column UNRESOLVED -> untouched',
   isFolded('SELECT a FROM templates T ORDER BY date_created DESC LIMIT 5'), false);
eq('orderby: numeric column -> untouched',
   isFolded('SELECT SCC.id FROM soundscape_composition_classes SCC ORDER BY SCC.typeId, SCC.isSystemClass DESC'), false);
// (2026-07-28: expectation updated — the bare-= pass now folds the
// `email = ?` PREDICATE inside the ORDER BY expression (users.email
// FROM-narrows cleanly; verified live: executes + ranks identically).
// translateOrderByCollation itself still leaves expressions/bare KEYS alone:
// the second key `email ASC` stays raw (citext sorts ci natively on PG).
eq('orderby: embedded = predicate folds via the bare pass (live-verified)',
   isFolded('SELECT user_id FROM users WHERE email LIKE ? ORDER BY (email = ?) DESC, email ASC LIMIT 10'), true);
eq('orderby: pure expression KEY itself never rewritten by the orderby pass',
   /ORDER BY \(.*\) DESC, email ASC/.test(m.translate('SELECT user_id FROM users WHERE email LIKE ? ORDER BY (email = ?) DESC, email ASC LIMIT 10')), true);
eq('orderby: PG enum (jobs.state) -> untouched (a fold is a hard type error)',
   isFolded('SELECT J.job_id FROM jobs J ORDER BY J.state'), false);
// ---- guards pinned from the ADVERSARIAL SELF-REVIEW (both reproduced live
// as hard PG errors before the guards existed; cf. the #1780 lesson) ----
eq('orderby GUARD G1: SELECT DISTINCT -> untouched (42P10 otherwise)',
   isFolded('SELECT DISTINCT t.tag FROM tags t ORDER BY t.tag LIMIT 3'), false);
eq('orderby GUARD G2: trailing ORDER BY after UNION -> untouched (42P01 otherwise)',
   isFolded('SELECT t.tag FROM tags t UNION SELECT s.name FROM sites s ORDER BY t.tag LIMIT 3'), false);
eq('orderby GUARD G2: W5 jobs-progress UNION shape untouched',
   isFolded("(SELECT J.job_id FROM jobs J WHERE J.state='processing') UNION (SELECT J.job_id FROM jobs J WHERE J.state='waiting') ORDER BY job_id DESC"), false);
eq('orderby: ORDER BY inside a parenthesised UNION branch still folds',
   isFolded('(SELECT t.tag FROM tags t ORDER BY t.tag LIMIT 1) UNION (SELECT s.name FROM sites s LIMIT 1)'), true);
// clause-extent correctness: the fold must not swallow LIMIT/OFFSET
eq('orderby: LIMIT/OFFSET preserved verbatim after a folded key',
   /LIMIT \? OFFSET \?/.test(m.translate(
     'SELECT T.tag FROM tags T ORDER BY T.tag LIMIT ? OFFSET ?')), true);
eq('orderby: WHERE fold and ORDER BY fold coexist on the same column',
   (m.translate('SELECT T.tag FROM tags T WHERE T.tag LIKE ? ORDER BY T.tag LIMIT ?')
      .match(/translate\(lower\(T\.tag\)/g) || []).length, 2);

console.log('== bare-= + IN-list collation fold (P6 =-surface, 2026-07-28) ==');
var nfold = function (sql) { return (m.translate(sql).match(/translate\(lower\(/g) || []).length; };
// FROM-narrowed bare = : the enumeration's real exposed shapes
eq('bare=: sites dup-check folds (FROM narrows `name` to sites.name/gen)',
   nfold("SELECT count(*) FROM sites WHERE name = 'x' AND project_id = 1 AND deleted_at is null"), 2);
eq('bare=: tags create-lookup folds', nfold("SELECT tag_id FROM tags WHERE tag = 'bird'"), 2);
eq('bare=: templates dup-check folds with the SV fold',
   /translate\(lower\(name\),'áàâãéèêëíìîïóòôõúùûçñýÿ'/.test(
     m.translate("SELECT 1 FROM templates WHERE `name`='X' AND `project_id`=1 LIMIT 1")), true);
eq('bare=: same-class multi-table still folds (sites+projects both gen)',
   nfold("SELECT 1 FROM sites S JOIN projects P ON S.project_id=P.project_id WHERE name = 'x'"), 2);
// fail-safes: never guess
eq('bare=: AMBIGUOUS across classes untouched (templates sv + projects gen)',
   nfold("SELECT 1 FROM templates T JOIN projects P ON T.project_id=P.project_id WHERE name = 'x'"), 0);
eq('bare=: enum column untouched (jobs.state)',
   nfold("SELECT job_id FROM jobs WHERE state = 'completed'"), 0);
eq('bare=: numeric column untouched', nfold("SELECT site_id FROM sites WHERE project_id = 5"), 0);
eq('bare=: unknown table untouched', nfold("SELECT x FROM unknown_table WHERE name = 'x'"), 0);
// THE STATEMENT GATE (load-bearing: the EXPORTS path translates without a
// SELECT gate; a fold inside UPDATE..SET would corrupt a write)
eq('bare= GATE: UPDATE SET untouched',
   nfold("UPDATE playlists SET name = 'x', uri = NULL WHERE playlist_id = 5"), 0);
eq('bare= GATE: INSERT untouched',
   nfold("INSERT INTO tags (tag) VALUES ('x')"), 0);
// IN lists
eq('IN: qualified string LHS folds LHS + members',
   nfold("SELECT r.recording_id FROM recordings r JOIN sites s ON s.site_id=r.site_id WHERE s.name IN ('A','B')"), 3);
eq('IN: bare string LHS folds via FROM-narrowing',
   nfold("SELECT tag_id FROM tags WHERE tag IN ('a','b')"), 3);
eq('IN: NOT IN preserved',
   /NOT IN \(/.test(m.translate("SELECT tag_id FROM tags WHERE tag NOT IN ('a')")), true);
eq('IN: subquery RHS untouched',
   nfold("SELECT tag_id FROM tags WHERE tag IN (SELECT tag FROM tags WHERE tag_id < 5)"), 0);
eq('IN: numeric LHS untouched', nfold("SELECT site_id FROM sites WHERE site_id IN (1,2,3)"), 0);
eq('IN: template-collapsed placeholder shape unchanged',
   m.sqlTemplate("SELECT * FROM t WHERE id IN (1,2,3) AND name='x' AND n=5"),
   'SELECT * FROM t WHERE id IN (?) AND name=? AND n=?');

console.log('\n' + (fails ? ('FAILED ' + fails + '/' + n) : ('ALL ' + n + ' PASS')));
process.exit(fails ? 1 : 0);
