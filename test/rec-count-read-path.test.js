// S4 of the rec_count design (rfcx-local DESIGN-2026-09-16-rec-count-event-driven-cache):
// getProjectSites reads rec_count / first_recording_at / last_recording_at from
// the `sites` COLUMNS (S2 maintains them, S3 backfilled them) instead of running
// the per-site COUNT(*)/MIN/MAX fan-out (translator hash ae28794138b7d016, the
// >8 s cold read behind 7 real-user 500s in 7 d).
//
// PINNED HERE (source-level, since the model cannot be require()d on node 26):
//  1. the outer SELECT carries the three columns + the trust flag
//  2. the fan-out's recCountSql / runPerSite / runInChunks are GONE from
//     getProjectSites (the ae28 statement can no longer be emitted from here)
//  3. the guard: untrusted sites (rec_count_updated_at IS NULL) are recounted
//     live; trusted ones are served from the column
//  4. response-shape parity: when the caller does not ask for counts, the
//     three fields are ABSENT (as before), and the transport flag never leaks
//
// NEGATIVE CONTROL: against the pre-S4 file, tests 1-3 go RED (verified by
// stashing the change while writing this).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'model', 'projects.js'), 'utf8');
const start = SRC.indexOf('getProjectSites: function(project_id, options)');
const end = SRC.indexOf('\n    },', start);
const FN = SRC.slice(start, end);
assert.ok(start > 0 && end > start, 'getProjectSites not found');

describe('rec_count S4 — getProjectSites reads the sites columns', function () {
    it('selects rec_count / first_recording_at / last_recording_at and the trust flag from sites', function () {
        assert.ok(/s\.rec_count_updated_at IS NOT NULL AS rec_count_trusted/.test(FN), 'trust flag missing');
        assert.ok(/"\s+s\.rec_count, /.test(FN), 'rec_count column missing');
        assert.ok(/s\.first_recording_at/.test(FN) && /s\.last_recording_at/.test(FN), 'range columns missing');
    });

    it('NO LONGER runs the per-site fan-out (ae28794138b7d016 cannot be emitted from here)', function () {
        assert.ok(!/recCountSql/.test(FN), 'recCountSql still present');
        assert.ok(!/persiteCount\.runPerSite/.test(FN), 'runPerSite still called from getProjectSites');
        assert.ok(!/persiteCount\.runInChunks/.test(FN), 'runInChunks still called from getProjectSites');
        // the OLD unconditional per-site COUNT over every site is gone; the only
        // remaining COUNT(*) is inside the untrusted-fallback, gated on a list
        const counts = (FN.match(/SELECT COUNT\(\*\) FROM recordings r/g) || []).length;
        assert.strictEqual(counts, 1, 'expected exactly ONE residual COUNT (the guard fallback), got ' + counts);
        assert.ok(/WHERE s\.site_id IN \(\?\)", \[untrusted\]/.test(FN), 'the residual COUNT is not gated on the untrusted list');
    });

    it('recounts ONLY untrusted sites, and short-circuits when there are none', function () {
        assert.ok(/if \(!site\.rec_count_trusted\) \{ untrusted\.push\(site\.id\); \}/.test(FN));
        assert.ok(/if \(!untrusted\.length\) \{ return q\(\); \}/.test(FN), 'no early return when every site is trusted');
    });

    it('response-shape parity: fields absent when counts were not requested; transport flag never leaks', function () {
        // the compute-but-not-rec_count branch strips them
        const noCount = FN.indexOf('caller did not ask for counts');
        assert.ok(noCount > 0, 'no-count branch missing');
        const blk = FN.slice(noCount, noCount + 500);
        ['rec_count_trusted', 'rec_count', 'first_recording_at', 'last_recording_at'].forEach(function (f) {
            assert.ok(new RegExp('delete site\\.' + f).test(blk), 'no-count branch does not delete ' + f);
        });
        // the no-compute-at-all branch strips them too
        const noCompute = FN.indexOf('no `compute` at all');
        assert.ok(noCompute > 0, 'no-compute branch missing');
        const blk2 = FN.slice(noCompute, noCompute + 500);
        ['rec_count_trusted', 'rec_count', 'first_recording_at', 'last_recording_at'].forEach(function (f) {
            assert.ok(new RegExp('delete site\\.' + f).test(blk2), 'no-compute branch does not delete ' + f);
        });
        // and the trusted path deletes the flag before returning
        assert.ok(/delete site\.rec_count_trusted;/.test(FN));
    });

    it('persite-count.js is still required (its project-level caller remains)', function () {
        assert.ok(/persiteCount\.PERSITE_COUNT_MAX_SITES/.test(SRC.slice(end)), 'other persiteCount caller vanished — the require may now be dead');
    });
});