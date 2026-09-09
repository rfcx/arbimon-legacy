var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — the classification delete waterfall + the orphan-visible read.
 *
 * Measured on live prod 2026-09-09 (rfcx-local OPEN-ITEMS §290,
 * runbooks/DESIGN-orphaned-analysis-rows-2026-09-09.md):
 *
 *   - 32 classification jobs / 673,252 `classification_results` rows exist
 *     whose `job_params_classification` parent is gone. 11 of them are modern
 *     delete debris; 3,174 of 3,185 deletes (99.65%) complete cleanly, so the
 *     waterfall is a rare-but-real failure, not a systemic one.
 *   - The delete route ran an `async.waterfall` of independent auto-commit
 *     statements and IGNORED `err`, so a partial delete looked successful.
 *     Four such clicks are on record for job 168896 (2026-09-03 22:04-22:13Z).
 *   - `moreDetails()` was the ONE read of classification_results that did not
 *     join `job_params_classification`, so it served rows belonging to deleted
 *     classifications: job 10170 returned 200 with 50,701 bytes on live prod
 *     while its own detail route correctly 404'd.
 *
 * These are SOURCE-SHAPE guards. The model needs a live MySQL pool to execute,
 * so (as with the export tests) the properties are pinned by asserting the
 * shipped SQL/control flow rather than by standing up a database. The
 * behavioural proof is recorded in the design doc: on the live PG leader the
 * new moreDetails shape returns 0 rows for orphan jobs 10170/168896 (was 100)
 * and is byte-identical in count for 5 healthy jobs (150/150/150/4750/4751).
 */

var modelSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'model', 'classifications.js'), 'utf8');
var routeSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'classifications.js'), 'utf8');

/** Extract a top-level function body from the model by its key. */
function modelFn(name) {
    var start = modelSrc.indexOf('\n    ' + name + ': function');
    if (start < 0) throw new Error('function not found in model: ' + name);
    var next = modelSrc.indexOf('\n    },\n', start);
    if (next < 0) throw new Error('function end not found: ' + name);
    return modelSrc.slice(start, next);
}

describe('classification delete — transactional + idempotent + reports failure', function() {

    it('runs the deletes inside a transaction (not independent auto-commits)', function() {
        var fn = modelFn('delete');
        expect(fn).to.contain('beginTransaction');
        expect(fn).to.contain('commit()');
        expect(fn).to.contain('rollback()');
    });

    it('rolls back and rethrows rather than swallowing a mid-delete failure', function() {
        var fn = modelFn('delete');
        var catchIdx = fn.indexOf('catch (err)');
        expect(catchIdx, 'delete must catch its own DB errors').to.be.greaterThan(-1);
        var tail = fn.slice(catchIdx);
        expect(tail).to.contain('rollback()');
        expect(tail).to.contain('throw err');
    });

    it('deletes job_params_classification LAST', function() {
        // jpc is the parent that proves "this classification was really
        // deleted" -- both for a retry (the row keeps the job visible and
        // re-deletable) and for the reverse-sync RESCAN_PARENT_GUARD. Deleting
        // it first would announce the delete while results still existed.
        var fn = modelFn('delete');
        var cr = fn.indexOf('DELETE FROM `classification_results`');
        var cs = fn.indexOf('DELETE FROM `classification_stats`');
        var jpc = fn.indexOf('DELETE FROM `job_params_classification`');
        expect(cr).to.be.greaterThan(-1);
        expect(cs).to.be.greaterThan(-1);
        expect(jpc).to.be.greaterThan(-1);
        expect(cr, 'results before stats').to.be.lessThan(cs);
        expect(cs, 'stats before params').to.be.lessThan(jpc);
    });

    it('is retry-safe at the front: does not resolve the model through a scalar subquery on jpc', function() {
        // The old step 1 was:
        //   SELECT uri FROM models WHERE model_id =
        //     (SELECT model_id FROM job_params_classification WHERE job_id = N)
        // and bailed with 'Classification not found' when that returned nothing
        // -- so once jpc was gone, a retry could never finish the cleanup.
        var fn = modelFn('delete');
        // Strip comments first: the rationale comment legitimately NAMES the old
        // error string, and a raw substring check cannot tell a comment from
        // code. (Caught by this test failing on its own first draft.)
        var code = fn.replace(/\/\/[^\n]*/g, '');
        expect(code, 'the old bail-out must not remain in executable code')
            .to.not.contain('Classification not found');
        expect(code, 'model lookup should be an explicit JOIN').to.contain('JOIN `models`');
    });

    it('keeps the S3 vector cleanup OUTSIDE the transaction and best-effort', function() {
        // A bucket op cannot participate in a DB transaction and must not be
        // able to block the DB cleanup (its previous behaviour ignored errors).
        var fn = modelFn('delete');
        var s3Idx = fn.indexOf('deleteObjects');
        var txIdx = fn.indexOf('beginTransaction');
        expect(s3Idx).to.be.greaterThan(-1);
        expect(s3Idx, 'S3 delete must run before the transaction opens').to.be.lessThan(txIdx);
        expect(fn.slice(s3Idx, txIdx)).to.contain('catch');
    });

    it('route reports a failed delete instead of replying success', function() {
        var idx = routeSrc.indexOf("router.get('/:classiId/delete'");
        expect(idx).to.be.greaterThan(-1);
        var handler = routeSrc.slice(idx, idx + 1400);
        expect(handler).to.contain('if (err)');
        expect(handler).to.contain('res.status(500)');
    });

    it('route only hides the job AFTER a successful delete', function() {
        var idx = routeSrc.indexOf("router.get('/:classiId/delete'");
        var handler = routeSrc.slice(idx, idx + 1400);
        var errIdx = handler.indexOf('if (err)');
        var hideIdx = handler.indexOf('hideAsync');
        expect(hideIdx).to.be.greaterThan(-1);
        expect(errIdx, 'the error branch must return before hideAsync').to.be.lessThan(hideIdx);
        expect(handler.slice(errIdx, hideIdx)).to.contain('return res.status(500)');
    });
});

describe('moreDetails — must not serve rows of a deleted classification', function() {

    it('joins job_params_classification', function() {
        var fn = modelFn('moreDetails');
        expect(fn).to.contain('`job_params_classification` jpc');
        expect(fn).to.contain('jpc.`job_id` = c.`job_id`');
    });

    it('every classification_results read in the model joins its params row', function() {
        // The generalised property, not just the one instance: this is what
        // made moreDetails the odd one out among 7 read sites.
        var readers = ['detail', 'moreDetails', 'getRecVector'];
        readers.forEach(function(name) {
            var fn = modelFn(name);
            if (fn.indexOf('classification_results') < 0) return;
            expect(fn, name + ' must join job_params_classification')
                .to.contain('job_params_classification');
        });
    });
});
