// The per-site count fan-out must sum the per-site COUNT(*) values — not 0.
//
// Regression test for the live 2026-09-12 defect: the combined recordings-search
// count leg (recordings.js findProjectRecordings, the persiteCount.runPerSite
// branch) resolved each per-site query with the queryHandler [rows, fields]
// contract, then read siteRows[0].n — where siteRows[0] IS the rows array, so
// .n was undefined and the total computed to 0. Every <=200-site project's
// recordings page showed count 0 ("recordings not found", no pagination) while
// the list leg rendered fine. Found by a user, proven in-pod (per-site results
// [[{n:11315}],null]... summed to 0 against a DB truth of 15,811).
//
// The fix unwraps the contract with .get(0) (the dbpool.js:275 convention), so
// each per-site result IS the bare rows array and siteRows[0].n is the count.
// NEGATIVE CONTROL: this test FAILS against the unfixed accessor.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'recordings.js'), 'utf8');

// The contract as queryHandler resolves it on PG: [rows, fields].
const PG_SHAPED_PER_SITE = [
    [[{ n: 11315 }], null],
    [[{ n: 5073 }], null],
    [[{ n: 5105 }], null],
    [[{ n: 449 }], null],
];
// The contract as dbpool.query resolves it (bare rows) — the shape the accessor
// was written for. Both must yield the same total after the fix.
const BARE_ROWS_PER_SITE = [[{ n: 11315 }], [{ n: 5073 }], [{ n: 5105 }], [{ n: 449 }]];
const EXPECTED = 11315 + 5073 + 5105 + 449; // 21942

// Mirror the production reduce exactly as written at recordings.js (the
// siteRows[0].n accessor), applied AFTER the runQuery unwrap. The test asserts
// on (a) the unwrap being present in the source, and (b) the arithmetic.
function totalLikeTheApp(perSiteResults, unwrap) {
    const rows = unwrap ? perSiteResults.map(function (r) { return r[0]; }) : perSiteResults;
    return rows.reduce(function (acc, siteRows) {
        return acc + ((siteRows && siteRows[0] && Number(siteRows[0].n)) || 0);
    }, 0);
}

describe('per-site count fan-out — the count must be the summed value, not 0', function () {
    it('the runQuery unwraps the [rows, fields] contract with .get(0)', function () {
        assert.ok(
            /Q\.nfcall\(queryHandler, \{ sql: sql, typeCast: sqlutil\.parseUtcDatetime \}\)\.get\(0\)/.test(src),
            'recordings.js count fan-out runQuery does not unwrap [rows, fields] with .get(0)'
        );
    });

    it('ARITHMETIC PROOF: the unfixed accessor sums the PG-shaped results to 0 (the defect)', function () {
        // This is what production computed before the fix — the failing state.
        assert.strictEqual(totalLikeTheApp(PG_SHAPED_PER_SITE, false), 0,
            'precondition check failed: the PG-shaped results should mis-sum to 0 without the unwrap');
    });

    it('after the unwrap, the PG-shaped results sum to the true count', function () {
        assert.strictEqual(totalLikeTheApp(PG_SHAPED_PER_SITE, true), EXPECTED);
    });

    it('the bare-rows shape (dbpool.query siblings) sums correctly with the same accessor', function () {
        assert.strictEqual(totalLikeTheApp(BARE_ROWS_PER_SITE, false), EXPECTED);
    });
});
