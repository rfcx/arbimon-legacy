'use strict';
// Self-test for dbpool-pg.js — classifier + translator.
// The comparator/normalizer sections were removed at P7 step 5 (2026-09-20)
// with the functions they tested; the g6HalfEven float-canonicalization cases
// live on in their original home (they were built for the comparator, which
// is retired). DB_ENGINE=pg mirrors the single engine the module now accepts.
process.env.DB_ENGINE = process.env.DB_ENGINE || 'pg';
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

console.log('== template/hash ==');
eq('template collapses literals+IN arity',
   m.sqlTemplate("SELECT * FROM t WHERE id IN (1,2,3) AND name='x' AND n=5"),
   'SELECT * FROM t WHERE id IN (?) AND name=? AND n=?');
eq('same template same hash',
   m.templateHash("SELECT * FROM t WHERE id=1") === m.templateHash("SELECT * FROM t WHERE id=999"), true);

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

// ---- NULL placement (2026-08-06 — the §6 trap armed by W9 zero-date NULLs;
// census hash 3fde2630; verified live on site 35416 pre-merge) ----
console.log('== ORDER BY NULL placement (nullable keys get MySQL semantics) ==');
eq('nulls: the 3fde2630 shape — DESC nullable datetime -> NULLS LAST',
   /ORDER BY r\.site_id DESC, r\.datetime DESC NULLS LAST LIMIT/.test(
     m.translate('SELECT r.recording_id FROM recordings r WHERE r.archived_at IS NULL AND r.site_id IN (?) ORDER BY r.site_id DESC, r.datetime DESC LIMIT ?, ?')), true);
eq('nulls: ASC (implicit) nullable key -> NULLS FIRST',
   /ORDER BY r\.datetime NULLS FIRST/.test(
     m.translate('SELECT r.recording_id FROM recordings r ORDER BY r.datetime LIMIT 5')), true);
eq('nulls: explicit ASC nullable key -> NULLS FIRST',
   /r\.datetime ASC NULLS FIRST/.test(
     m.translate('SELECT r.recording_id FROM recordings r ORDER BY r.datetime ASC LIMIT 5')), true);
eq('nulls: NOT-NULL key -> NO clause emitted (plan-preserving)',
   /NULLS/.test(m.translate('SELECT t.tag FROM tags t ORDER BY t.tag DESC LIMIT 5')), false);
eq('nulls: NOT-NULL folded key -> fold only, no clause',
   /NULLS/.test(m.translate('SELECT s.name FROM sites s ORDER BY s.name')), false);
eq('nulls: nullable + collation-folded key -> BOTH (fold then dir then clause)',
   /translate\(lower\(t\.uri\).*\) DESC NULLS LAST/.test(
     m.translate('SELECT t.uri FROM templates t ORDER BY t.uri DESC')), true);
// ---- LIMIT-1 extreme subquery: two index dives instead of NULLS FIRST/LAST
// (P7 debt #9, 2026-09-10 — hash ae28794138b7d016, the sites-list per-site
// first/last; measured 346 ms -> 4.2 ms on an 8-site project, 8 s cancels on
// giants). Semantics verified live on 5 sites incl. two zero-date sites: PG
// old == PG new == MariaDB original.
console.log('== extreme-subquery NULL placement -> two index dives (P7 debt #9) ==');
var SL = "SELECT s.site_id AS site_id, (SELECT r.datetime FROM recordings r WHERE r.site_id = s.site_id AND r.archived_at IS NULL ORDER BY r.datetime ASC LIMIT 1) AS first_recording_at, (SELECT r.datetime FROM recordings r WHERE r.site_id = s.site_id AND r.archived_at IS NULL ORDER BY r.datetime DESC LIMIT 1) AS last_recording_at FROM sites s WHERE s.site_id IN (1,2)";
var SLT = m.translate(SL);
eq('extreme: sites-list shape emits NO NULLS FIRST/LAST', /NULLS (FIRST|LAST)/.test(SLT), false);
eq('extreme: ASC form = EXISTS(k IS NULL) guard + IS NOT NULL dive',
   /CASE WHEN EXISTS \(SELECT 1 FROM recordings r WHERE r\.site_id = s\.site_id AND r\.archived_at IS NULL AND r\.datetime IS NULL\) THEN NULL ELSE \(SELECT r\.datetime FROM recordings r WHERE r\.site_id = s\.site_id AND r\.archived_at IS NULL AND r\.datetime IS NOT NULL ORDER BY r\.datetime ASC LIMIT 1\) END\) AS first_recording_at/.test(SLT), true);
eq('extreme: DESC form = single IS NOT NULL dive, no EXISTS',
   /\(SELECT r\.datetime FROM recordings r WHERE r\.site_id = s\.site_id AND r\.archived_at IS NULL AND r\.datetime IS NOT NULL ORDER BY r\.datetime DESC LIMIT 1\) AS last_recording_at/.test(SLT), true);
eq('extreme: the date_range fast path (b83db7de) rewrites too',
   (m.translate("SELECT MIN(z.f) AS min_date FROM ( SELECT (SELECT r.datetime FROM recordings r WHERE r.site_id = s.site_id AND r.archived_at IS NULL ORDER BY r.datetime ASC LIMIT 1) AS f FROM sites s WHERE s.site_id IN (1) ) z").match(/IS NOT NULL ORDER BY/g) || []).length, 1);
// the EXACT live text (projects.js getProjectSites compute.rec_count, as the
// leader log shows it) -- its hash must stay ae28794138b7d016 so the census
// keeps discriminating; the translated form must be dive-shaped.
var SL_LIVE = "SELECT s.site_id AS site_id,        (SELECT COUNT(*) FROM recordings r           WHERE r.site_id = s.site_id             AND r.archived_at IS NULL) AS rec_count,        (SELECT r.datetime FROM recordings r           WHERE r.site_id = s.site_id             AND r.archived_at IS NULL           ORDER BY r.datetime ASC LIMIT 1) AS first_recording_at,        (SELECT r.datetime FROM recordings r           WHERE r.site_id = s.site_id             AND r.archived_at IS NULL           ORDER BY r.datetime DESC LIMIT 1) AS last_recording_at FROM sites s WHERE s.site_id IN (88151, 88152)";
eq('extreme: LIVE sites-list text keeps hash ae28794138b7d016', m.templateHash(SL_LIVE), 'ae28794138b7d016');
eq('extreme: LIVE sites-list text translates to 2 IS NOT NULL dives + 1 EXISTS and 0 NULLS clauses',
   [(m.translate(SL_LIVE).match(/IS NOT NULL ORDER BY/g) || []).length, (m.translate(SL_LIVE).match(/EXISTS/g) || []).length, (m.translate(SL_LIVE).match(/NULLS (FIRST|LAST)/g) || []).length].join(','), '2,1,0');
// fail-safe: anything outside the exact shape keeps the placement clause
eq('extreme: LIMIT 2 -> untouched (still NULLS FIRST)',
   /NULLS FIRST LIMIT 2/.test(m.translate('SELECT (SELECT r.datetime FROM recordings r WHERE r.site_id = 5 ORDER BY r.datetime ASC LIMIT 2) AS x')), true);
eq('extreme: selected column != sort key -> untouched',
   /NULLS FIRST/.test(m.translate('SELECT (SELECT r.recording_id FROM recordings r WHERE r.site_id = 5 ORDER BY r.datetime ASC LIMIT 1) AS x')), true);
eq('extreme: top-level (not a parenthesised scalar subquery) -> untouched',
   /NULLS FIRST LIMIT 1$/.test(m.translate('SELECT r.datetime FROM recordings r WHERE r.site_id = 5 ORDER BY r.datetime ASC LIMIT 1')), true);
eq('extreme: NOT-NULL sort key never had a clause -> untouched',
   /IS NOT NULL/.test(m.translate('SELECT (SELECT t.tag FROM tags t WHERE t.tag_id = 5 ORDER BY t.tag ASC LIMIT 1) AS x')), false);
eq('extreme: nested parens in WHERE -> untouched (fail-safe)',
   /NULLS FIRST/.test(m.translate('SELECT (SELECT r.datetime FROM recordings r WHERE r.site_id IN (1,2) ORDER BY r.datetime ASC LIMIT 1) AS x')), true);

eq('nulls: G1 DISTINCT -> untouched (no clause)',
   /NULLS/.test(m.translate('SELECT DISTINCT r.datetime FROM recordings r ORDER BY r.datetime DESC')), false);
eq('nulls: G2 trailing set-op ORDER BY -> untouched',
   /NULLS/.test(m.translate('SELECT r.datetime FROM recordings r UNION SELECT r2.datetime FROM recordings r2 ORDER BY datetime DESC')), false);
eq('nulls: UNRESOLVED alias -> untouched (fail-safe)',
   /NULLS/.test(m.translate('SELECT x.datetime FROM (SELECT 1) q ORDER BY x.datetime DESC')), false);
eq('nulls: pmr denorm datetime (3.1M NULLs live) -> NULLS LAST in DESC',
   /PMR\.denorm_recording_datetime DESC NULLS LAST/.test(
     m.translate('SELECT PMR.x1 FROM pattern_matching_rois PMR ORDER BY PMR.denorm_recording_datetime DESC')), true);
eq('nulls: multi-key — each key judged independently',
   (function () {
     var s = m.translate('SELECT r.recording_id FROM recordings r JOIN sites s ON s.site_id = r.site_id ORDER BY s.site_id DESC, r.datetime DESC LIMIT 5');
     return /s\.site_id DESC(?! NULLS)/.test(s) && /r\.datetime DESC NULLS LAST/.test(s);
   })(), true);

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

// ---- COLLATION_EXACT: recordings.uri is NEVER folded (P7 debt #9, 2026-09-10)
// The 6.4 flip routed recordingInfoGivenUri; the fold on recordings.uri turned
// its indexed point lookup into a 306M-row seq scan cancelled at 8 s on every
// call (340/480 pg_route_timeout events in 48 h). Exact match on every pass.
console.log('== COLLATION_EXACT (recordings.uri exact-match, P7 debt #9) ==');
var RIU = "SELECT r.recording_id AS id, r.uri, s.site_id FROM recordings r JOIN sites s ON s.site_id = r.site_id WHERE r.uri = '2020/11/18/co8K2020066/e881c16e.flac'";
eq('exact: recordingInfoGivenUri shape untouched (qualified =)', nfold(RIU), 0);
eq('exact: predicate emitted verbatim (indexable: no lower() around column or literal)',
   /WHERE r\.uri = '2020\/11\/18\/co8K2020066\/e881c16e\.flac'$/.test(m.translate(RIU)), true);
eq('exact: collationClass resolves recordings.uri to null',
   m.collationClass('r.uri', m.aliasMap('SELECT 1 FROM recordings r')), null);
eq('exact: bare uri in exists() shape untouched',
   nfold("SELECT count(recording_id) as count FROM recordings WHERE site_id = 5 AND uri = 'x/y.flac'"), 0);
eq('exact: IN-list on recordings.uri untouched (archiveBySiteAndUris shape)',
   nfold("SELECT recording_id FROM recordings WHERE site_id = 5 AND uri IN ('a.flac','B.flac')"), 0);
eq('exact: ORDER BY r.uri untouched',
   nfold('SELECT r.uri FROM recordings r ORDER BY r.uri'), 0);
// cached_metrics.key (P7 debt #9 census, 2026-09-10): the same machine-key class;
// the fold's plan is a 41,888-row Seq Scan on every getCachedMetrics read.
var CMK = "SELECT * FROM cached_metrics cm WHERE cm.key = 'project-9809-rec'";
eq('exact: getCachedMetrics read untouched (qualified =)', nfold(CMK), 0);
eq('exact: getCachedMetrics read emitted verbatim (PK-indexable)',
   /WHERE cm\.key = 'project-9809-rec'$/.test(m.translate(CMK)), true);
eq('exact: collationClass resolves cached_metrics.key to null',
   m.collationClass('cm.key', m.aliasMap('SELECT 1 FROM cached_metrics cm')), null);
eq('exact: bare key on cached_metrics untouched',
   nfold("SELECT value FROM cached_metrics WHERE `key` = 'recording-count'"), 0);
eq('exact: OTHER uri columns still fold (templates.uri is sv)',
   nfold("SELECT T.uri FROM templates T WHERE T.uri = 'x'"), 2);
eq('exact: sibling string column in the same query still folds (sites.name)',
   nfold("SELECT r.recording_id FROM recordings r JOIN sites s ON s.site_id = r.site_id WHERE r.uri = 'a' AND s.name = 'b'"), 2);

// ---- COLLATION_ORDER_EXACT: recordings.filename is folded in predicates but
// NEVER in ORDER BY (P7 pre-flip read-timeout sweep, 2026-09-12). The fold on
// the ORDER BY key defeats the (site_id, filename) composite that serves the
// per-site top-N union arms (app/utils/persite-sort.js): folded, the giant's
// filename sort cancelled at the 8 s statement_timeout deterministically
// (pg_route_timeout f44b4c1fdbb60431/16670983c3ff6008); unfolded, the union
// runs 1.38 s on the leader.
console.log('== COLLATION_ORDER_EXACT (recordings.filename order-by exemption) ==');
var FNS = "SELECT r.recording_id AS id FROM recordings r WHERE r.archived_at IS NULL AND r.site_id IN (6725, 6726) ORDER BY r.filename ASC, r.recording_id ASC LIMIT 0, 10";
eq('order-exact: filename sort key NOT folded', nfold(m.translate(FNS)), 0);
eq('order-exact: key kept verbatim + NULLS FIRST (MySQL placement)',
   m.translate(FNS).indexOf('ORDER BY r.filename ASC NULLS FIRST, r.recording_id ASC') !== -1, true);
eq('order-exact: DESC gets NULLS LAST',
   m.translate(FNS.replace(/ASC/g, 'DESC')).indexOf('ORDER BY r.filename DESC NULLS LAST, r.recording_id DESC') !== -1, true);
eq('order-exact: WHERE r.filename = ? STILL folds (order-only exemption; exists() dedup semantics kept)',
   nfold(m.translate("SELECT r.recording_id FROM recordings r WHERE r.site_id = 8412 AND r.filename = 'x.wav'")), 2);
eq('order-exact: collationClass still resolves recordings.filename (fold machinery unchanged for predicates)',
   m.collationClass('r.filename', m.aliasMap('SELECT 1 FROM recordings r')), 'gen');
eq('order-exact: other ORDER BY string keys still fold (sites.name control)',
   nfold(m.translate('SELECT s.site_id FROM sites s WHERE s.project_id = 1523 ORDER BY s.name ASC')), 1);
// The PG-form union text passes through translate() byte-identical: the arm
// keys carry explicit NULLS FIRST (no _SORTKEY_RE match) and LIMIT/OFFSET is
// already PG form. This is what the pg-mode request path runs (translate() is
// applied to ALL routed SQL, including isPg-branched text).
var persite = require('./persite-sort.js');
var unionPg = persite.buildPerSiteSortSql({ expr: 'r.filename', nullable: true, sortRev: false,
   siteIds: [6725, 6726], archiveScope: 'r.archived_at IS NULL', offset: 0, limit: 10, isPg: true });
eq('order-exact: PG-form union is a translate() passthrough', m.translate(unionPg) === unionPg, true);
eq('order-exact: PG-form union arms carry PG-NATIVE placement (index-servable) + IS NULL split',
   unionPg.indexOf('ORDER BY r.filename ASC NULLS LAST, r.recording_id ASC') !== -1 &&
   unionPg.indexOf('IS NOT NULL') !== -1 && unionPg.indexOf('IS NULL') !== -1, true);
eq('order-exact: PG-form union outer carries the app-semantic placement (NULLS FIRST on ASC)',
   unionPg.indexOf('ORDER BY u.sort_key ASC NULLS FIRST, u.id ASC') !== -1, true);
var unionMy = persite.buildPerSiteSortSql({ expr: 'r.filename', nullable: true, sortRev: false,
   siteIds: [6725, 6726], archiveScope: 'r.archived_at IS NULL', offset: 0, limit: 10, isPg: false });
var unionMyT = m.translate(unionMy);
eq('order-exact: shadow-path union arms get placement from the #1794 leg, no fold',
   unionMyT.indexOf('ORDER BY r.filename ASC NULLS FIRST, r.recording_id ASC') !== -1 && nfold(unionMyT) === 0, true);
eq('order-exact: shadow-path union outer key unresolvable -> untouched',
   unionMyT.indexOf('ORDER BY u.sort_key ASC, u.id ASC') !== -1, true);

// ---- schema-qualifier strip (P6, 2026-07-29) ------------------------------
// The first genuine dialect_error caught by the post-#1787 unconditional
// gate: legacy qualifies two queries with the MySQL schema name `arbimon2.`,
// which is a hard 42P01 on PG (database `arbimon`, schema `public`).
console.log('== schema-qualifier strip (P6 2026-07-29) ==');
eq('schema: the live d2f44837 shape (playlists.js:551)',
   m.translate("SELECT DISTINCT(playlist_id) FROM arbimon2.playlist_recordings WHERE recording_id in (1,2)"),
   'SELECT DISTINCT(playlist_id) FROM playlist_recordings WHERE recording_id in (1,2)');
eq('schema: the projects.js:79 shape (aliased, lowercase from)',
   /from projects p\b/.test(m.translate("select p.project_id from arbimon2.projects p join user_project_role upr on p.project_id = upr.project_id where upr.user_id = 5")),
   true);
eq('schema: qualifier inside a STRING LITERAL untouched',
   m.translate("SELECT * FROM t WHERE uri = 'https://arbimon2.s3.us-east-1.amazonaws.com/x'"),
   "SELECT * FROM t WHERE uri = 'https://arbimon2.s3.us-east-1.amazonaws.com/x'");
eq('schema: backticked form also stripped',
   m.translate('SELECT * FROM `arbimon2`.`playlist_recordings` LIMIT 1'),
   'SELECT * FROM playlist_recordings LIMIT 1');
eq('schema: an identifier merely CONTAINING arbimon2 untouched',
   m.translate('SELECT arbimon2_backup_flag FROM t'),
   'SELECT arbimon2_backup_flag FROM t');
eq('schema: case-insensitive (ARBIMON2.)',
   m.translate('SELECT * FROM ARBIMON2.projects LIMIT 1'),
   'SELECT * FROM projects LIMIT 1');

// ---- clustering perDate GROUP BY shape (P6 2026-08-03, 42803 hash 8ff48586) --
// findRois(aed+perDate) selects MIN(C.`date_created`) with the aed-branch
// columns in the GROUP BY. Pin that the translator carries the whole fixed
// shape: MIN() aggregate untouched, backtick alias -> bare/quoted ident,
// CONCAT -> || with text cast. (The FIX lives in clustering-jobs.js; this
// guards the translated form the 6.4 routing path will execute.)
console.log('== clustering perDate GROUP BY shape (P6 2026-08-03) ==');
eq('clustering: MIN(backtick col) + alias translates',
   m.translate('SELECT A.aed_id, MIN(C.`date_created`) as `date_created` FROM a A JOIN c C ON A.j = C.k GROUP BY A.aed_id, A.species_id'),
   'SELECT A.aed_id, MIN(C.date_created) as date_created FROM a A JOIN c C ON A.j = C.k GROUP BY A.aed_id, A.species_id');

// ---- soundscape region-tags GROUP BY shape (P6 2026-08-16, 42803 hash e2600c86) --
// getRegionTags() (soundscapes.js) fired the first genuine dialect_error on
// the 17th clock: soundscape_region_tag_id + recording_id projected without
// aggregation while grouped only by (region_id, tag_id) — measured fan-out
// up to 99 rows/group, so the #1790 MIN() precedent applies (bare GROUP BY
// addition would 4x the result reaching the UI: 237 groups vs 991 rows).
// ST.tag/ST.type join the GROUP BY via ST's PK — cardinality-neutral. Pin
// that the translator carries the fixed shape untouched.
console.log('== soundscape region-tags GROUP BY shape (P6 2026-08-16) ==');
eq('srt: MIN() representatives + PK-joined GROUP BY cols translate',
   m.translate('SELECT MIN(SRT.soundscape_region_tag_id) as id, SRT.soundscape_region_id as region, MIN(SRT.recording_id) as recording, ST.tag, ST.type, COUNT(*) as count FROM soundscape_region_tags SRT JOIN soundscape_tags ST ON ST.soundscape_tag_id = SRT.soundscape_tag_id WHERE SRT.soundscape_region_id = 1 GROUP BY SRT.soundscape_region_id, SRT.soundscape_tag_id, ST.tag, ST.type'),
   'SELECT MIN(SRT.soundscape_region_tag_id) as id, SRT.soundscape_region_id as region, MIN(SRT.recording_id) as recording, ST.tag, ST.type, COUNT(*) as count FROM soundscape_region_tags SRT JOIN soundscape_tags ST ON ST.soundscape_tag_id = SRT.soundscape_tag_id WHERE SRT.soundscape_region_id = 1 GROUP BY SRT.soundscape_region_id, SRT.soundscape_tag_id, ST.tag, ST.type');
eq('srt: recording-branch shape (MIN user/timestamp projections) translates',
   m.translate('SELECT MIN(SRT.soundscape_region_tag_id) as id, MIN(SRT.user_id) as user, MIN(SRT.timestamp) as timestamp, ST.tag, COUNT(*) as count FROM soundscape_region_tags SRT JOIN soundscape_tags ST ON ST.soundscape_tag_id = SRT.soundscape_tag_id WHERE SRT.soundscape_region_id = 1 AND SRT.recording_id = 2 GROUP BY SRT.soundscape_region_id, SRT.recording_id, SRT.soundscape_tag_id, ST.tag, ST.type'),
   'SELECT MIN(SRT.soundscape_region_tag_id) as id, MIN(SRT.user_id) as user, MIN(SRT.timestamp) as timestamp, ST.tag, COUNT(*) as count FROM soundscape_region_tags SRT JOIN soundscape_tags ST ON ST.soundscape_tag_id = SRT.soundscape_tag_id WHERE SRT.soundscape_region_id = 1 AND SRT.recording_id = 2 GROUP BY SRT.soundscape_region_id, SRT.recording_id, SRT.soundscape_tag_id, ST.tag, ST.type');

// ---- connection-lifetime SQLSTATE classification (P6, 2026-07-29) --------
// #1781 ruled that a connection DEATH must never book as dialect_error (the
// O5 gate's hard-zero metric). Its guard tested `!err.code` only, so an
// ADMINISTRATIVE termination — which DOES carry a SQLSTATE — slipped through.
// MEASURED live: the 2026-07-29 04:04:06Z TL72->73 failover booked exactly
// two 57P01s as dialect_error; the 19:11:47Z TL74->75 failover booked zero
// (the client 'error' handler won that race). Non-deterministic by nature,
// so these tests pin the CLASSIFIER rather than any one incident's outcome.
console.log('== connection-lifetime SQLSTATE classification (P6 2026-07-29) ==');
var cle = m.isConnLifetimeError;
// the #1781 shape must keep behaving exactly as before
eq('conn: no-SQLSTATE error is conn-lifetime (#1781 shape preserved)',
   cle(new Error('Connection terminated unexpectedly')), true);
eq('conn: null/undefined is not conn-lifetime', cle(null), false);
// the measured live gap
eq('conn: 57P01 admin_shutdown (THE measured 04:04Z failover case)',
   cle({ code: '57P01', message: 'terminating connection due to administrator command' }), true);
eq('conn: 57P02 crash_shutdown', cle({ code: '57P02' }), true);
eq('conn: 57P03 cannot_connect_now', cle({ code: '57P03' }), true);
eq('conn: 08006 connection_failure', cle({ code: '08006' }), true);
eq('conn: 08003 connection_does_not_exist', cle({ code: '08003' }), true);
eq('conn: 08000 connection_exception', cle({ code: '08000' }), true);
eq('conn: lowercase SQLSTATE still matches', cle({ code: '57p01' }), true);
// the boundaries that MUST stay visible — these are the whole point of the gate
eq('conn: 57014 query_canceled is NOT conn-lifetime (our statement_timeout)',
   cle({ code: '57014' }), false);
eq('conn: 53300 too_many_connections is NOT absorbed (real capacity fault)',
   cle({ code: '53300' }), false);
eq('conn: 42P01 undefined_table is a REAL dialect error',
   cle({ code: '42P01' }), false);
eq('conn: 42P10 invalid_column_reference is a REAL dialect error',
   cle({ code: '42P10' }), false);
eq('conn: 22P02 invalid_text_representation is a REAL dialect error',
   cle({ code: '22P02' }), false);
eq('conn: 42883 undefined_function is a REAL dialect error',
   cle({ code: '42883' }), false);
eq('conn: 42601 syntax_error is a REAL dialect error',
   cle({ code: '42601' }), false);
eq('conn: 42804 datatype_mismatch is a REAL dialect error',
   cle({ code: '42804' }), false);
eq('conn: 23505 unique_violation is a REAL error (not infra)',
   cle({ code: '23505' }), false);
// 08P01 protocol_violation (P6 2026-08-03, 3rd incompleteness): pgbouncer
// SYNTHESIZES this state when a backend dies under the pooler ("server conn
// crashed?" — both strings live in the pgbouncer binary). The shadow path
// rides pgbouncer, so pooler-mediated deaths surface as 08P01, not 57P01.
// MEASURED live: the 2026-08-03 06:47:33Z TL78->79 failover booked exactly
// 2 records per pod as dialect_error via this state.
eq('conn: 08P01 protocol_violation (pgbouncer-synthesized conn death, 06:47Z case)',
   cle({ code: '08P01', message: 'server conn crashed?' }), true);
eq('conn: lowercase 08p01 still matches', cle({ code: '08p01' }), true);
eq('conn: the table is exactly the 7 Class-57/08 codes',
   Object.keys(m.CONN_LIFETIME_SQLSTATES).sort().join(','),
   '08000,08003,08006,08P01,57P01,57P02,57P03');

console.log('\n' + (fails ? ('FAILED ' + fails + '/' + n) : ('ALL ' + n + ' PASS')));
process.exit(fails ? 1 : 0);
