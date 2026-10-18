/* jshint node:true */
'use strict';

// Site QC summary (rfcx-local OPEN-ITEMS §479 A2 G3b) — the SQL in
// model.sites.getQcSummary is PG-native (FILTER, ::real, substring FROM regex,
// percentile_cont, now() - interval). It still goes through dbpool.query, whose
// router (dbpool-pg.js classify/translate) was written for MySQL-dialect text.
// These tests prove (a) the statement is classified replayable so it is routed
// to PG at all, (b) translate() leaves the PG-native parts byte-identical, and
// (c) `days` is clamped so the route can never become a table scan.
// Run: node test/site-qc-summary.test.js

const assert = require('assert');
const path = require('path');
const mysql = require('mysql');

let pass = 0, fail = 0;
function ok (label, cond, detail) {
    if (cond) { console.log('  ok   ' + label); pass++; }
    else { console.log('  FAIL ' + label + (detail ? '  ' + detail : '')); fail++; }
}

const root = path.join(__dirname, '..');
const pgshadow = require(path.join(root, 'app/utils/dbpool-pg.js'));

// Capture the SQL + params the model hands to dbpool.query without touching a DB.
const dbpoolPath = require.resolve(path.join(root, 'app/utils/dbpool.js'));
const dbpool = require(dbpoolPath);
let captured = null;
const realQuery = dbpool.query;
dbpool.query = function (sql, params) {
    captured = { sql: typeof sql === 'string' ? sql : sql.sql, params };
    return Promise.resolve([{ n: '1128', n_qc: '3', n_skipped: '0', clipped: '1', mostly_silent: '0', dc_offset: '0', floor_median_dbfs: '-48.6', peak_median_dbfs: '-6.2', from_datetime: null, to_datetime: null }]);
};
const sites = require(path.join(root, 'app/model/sites.js'));

(async function () {
    const out = await sites.getQcSummary(89923, { days: 30 });
    ok('model returns the summary shape with numbers, not strings', out.n === 1128 && out.clipped === 1 && out.floor_median_dbfs === -48.6 && out.days === 30);
    ok('params are [site_id, since-Date ≈ now − 30 d]', captured.params[0] === 89923 && captured.params[1] instanceof Date && Math.abs(Date.now() - captured.params[1].getTime() - 30 * 86400000) < 5000, JSON.stringify(captured.params));

    const finalSql = mysql.format(captured.sql, captured.params, false, 'Z');
    const cls = pgshadow.classify(finalSql);
    ok('🔴 classify(): replayable (routed to PG at all)', cls.replayable === true, JSON.stringify(cls));
    const translated = pgshadow.translate(finalSql);
    const t = typeof translated === 'string' ? translated : translated.text || translated.sql;
    ok('translate() keeps FILTER (WHERE …) and the presence test is position(), not a router-rewritten LIKE', /COUNT\(\*\) FILTER \(WHERE position\('"qc"' in meta\) > 0\)/.test(t) && !/translate\(lower/.test(t), t.slice(0, 300));
    ok('translate() keeps ::real casts', /\)\)::real >= 0\.01/.test(t));
    ok('translate() keeps percentile_cont … WITHIN GROUP', /percentile_cont\(0\.5\) WITHIN GROUP/.test(t));
    ok('translate() keeps the regex substring', /substring\(meta from '"clip_pct":\(\[0-9\.\]\+\)'\)/.test(t), t.match(/substring\([^)]*\)/g) && t.match(/substring\([^)]*\)/g)[0]);
    ok('🔴 no `?` placeholder was consumed inside a regex (the -? trap): every -{0,1} intact, no digits/quotes injected', (t.match(/-\{0,1\}\[0-9\.\]\+/g) || []).length === 3 && !/\(-89923|\(-'30'/.test(t), t.match(/substring\(meta from '[^']*'\)/g).join(' | '));
    ok('translate() keeps the bound (site_id AND datetime literal → recordings_site_datetime_idx), no now()', /WHERE site_id = 89923 AND archived_at IS NULL AND datetime >= '20\d\d-\d\d-\d\d \d\d:\d\d:\d\d/.test(t) && !/now\(\)/.test(t), t.slice(t.indexOf('WHERE')));
    ok('no MySQL-only tokens survive', !/UNIX_TIMESTAMP|IFNULL|DATE_FORMAT|`/.test(t));

    // clamp
    const dAgo = () => Math.round((Date.now() - captured.params[1].getTime()) / 86400000);
    await sites.getQcSummary(1, { days: 9999 }); ok('🔴 days clamps to 90', dAgo() === 90, dAgo());
    await sites.getQcSummary(1, { days: -5 }); ok('days clamps to 1 (negative)', dAgo() === 1, dAgo());
    await sites.getQcSummary(1, { days: 'abc' }); ok('days defaults to 30 on garbage', dAgo() === 30, dAgo());
    await sites.getQcSummary(1, undefined); ok('days defaults to 30 when options absent', dAgo() === 30, dAgo());

    dbpool.query = realQuery;
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });