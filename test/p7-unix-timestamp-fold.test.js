// translate() must fold UNIX_TIMESTAMP(x) -> EXTRACT(EPOCH FROM x) — PG has no
// unix_timestamp(), and the P7 write-conn path (pgWriteExec) executes the
// translated SQL directly. Measured live 2026-09-12 (hash 71a84649c9905962,
// ~50 errors/hour, 42883): the jobs-list query — and the models-list query
// (projects.js:1267/1291) — 500'd for every user on PG.
//
// NEGATIVE CONTROL: the "no unix_timestamp remains" assertions FAIL against the
// unfixed translator (the fold did not exist before this change).
'use strict';
const assert = require('assert');
const path = require('path');

const pgshadow = require(path.join(__dirname, '..', 'app', 'utils', 'dbpool-pg.js'));
const translate = pgshadow.translate;

describe('translate() — UNIX_TIMESTAMP fold (P7 write-conn 42883 fix)', function () {
    it('folds UNIX_TIMESTAMP(column) with a backticked arg', function () {
        const out = translate("SELECT UNIX_TIMESTAMP( J.`date_created` )*1000 as `date` FROM jobs AS J");
        assert.ok(/EXTRACT\(EPOCH FROM J\.(?:"date_created"|date_created|`date_created`)\)/i.test(out), 'got: ' + out);
        assert.ok(!/unix_timestamp/i.test(out), 'unix_timestamp survived: ' + out);
    });

    it('folds the exact live failing shape (jobs list, placeholders intact)', function () {
        const out = translate("SELECT UNIX_TIMESTAMP( J.? )*? as ? FROM ? AS J JOIN ? AS JPC ON J.? = JPC.?");
        assert.ok(!/unix_timestamp/i.test(out), 'unix_timestamp survived: ' + out);
        assert.ok(/EXTRACT\(EPOCH FROM/i.test(out), 'no EXTRACT(EPOCH… in: ' + out);
    });

    it('folds UNIX_TIMESTAMP() with no argument to EXTRACT(EPOCH FROM NOW())', function () {
        const out = translate("SELECT UNIX_TIMESTAMP()");
        assert.ok(/EXTRACT\(EPOCH FROM NOW\(\)\)/i.test(out), 'got: ' + out);
        assert.ok(!/unix_timestamp/i.test(out), 'unix_timestamp survived: ' + out);
    });

    it('folds inside a FLOOR(UNIX_TIMESTAMP(x)/N) wrapper (admin-plots shape)', function () {
        const out = translate("SELECT FLOOR(UNIX_TIMESTAMP(R.upload_time)/3600) FROM recordings R");
        assert.ok(/FLOOR\(EXTRACT\(EPOCH FROM R\.upload_time\)\/3600\)/i.test(out), 'got: ' + out);
        assert.ok(!/unix_timestamp/i.test(out), 'unix_timestamp survived: ' + out);
    });

    it('folds a WHERE-clause use (UNIX_TIMESTAMP(x) * 1000 >= ?)', function () {
        const out = translate("SELECT 1 FROM job_params jp WHERE (UNIX_TIMESTAMP(jp.date_created) * 1000) >= ?");
        assert.ok(/EXTRACT\(EPOCH FROM jp\.date_created\)/i.test(out), 'got: ' + out);
        assert.ok(!/unix_timestamp/i.test(out), 'unix_timestamp survived: ' + out);
    });

    it('leaves an unrelated query byte-identical (non-vacuity control)', function () {
        const q = "SELECT job_id, state FROM jobs WHERE project_id = ?";
        assert.strictEqual(translate(q), q);
    });
});
