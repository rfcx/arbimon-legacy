var expect = require('chai').expect;
var path = require('path');

/**
 * §393 slice B model guard: the REAL ClusteringJobs.findRois must constrain the
 * ROI rows to recordings the project owns (own or imported sites) whenever the
 * caller passes `project` (the /rois-details route) or `project_id` (the export
 * job). dbpool is stubbed so the SQL is captured, never executed; the export
 * job's already-scoped call is covered by the same predicate.
 *
 * RED on master: master has no scope constraint at all.
 */
var ROOT = path.join(__dirname, '..');
var captured = [];

function stub(rel, exp) {
    var p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
    return p;
}

describe('§393 slice B: findRois constrains ROIs to project-owned recordings', function() {
    var stubbed = [], reloaded = [], CJ;
    before(function() {
        // The model's heavy siblings are not under test; keep them out of the load.
        stubbed.push(stub('app/model/recordings.js', {}));
        stubbed.push(stub('app/utils/storage.js', { createS3Client: function() { return {}; }, deleteObjects: function() {} }));
        stubbed.push(stub('app/utils/dbpool.js', {
            query: function(sql) { captured.push(String(sql.sql || sql)); return Promise.resolve([]); },
            escape: function(v) { return typeof v === 'string' ? "'" + v + "'" : String(v); }
        }));
        var p = require.resolve(path.join(ROOT, 'app/model/clustering-jobs.js')); delete require.cache[p]; reloaded.push(p);
        CJ = require(p);
    });
    after(function() { stubbed.concat(reloaded).forEach(function(p) { delete require.cache[p]; }); });
    beforeEach(function() { captured.length = 0; });

    it('options.project adds the own-or-imported-site constraint on the ROI recording', async function() {
        await CJ.findRois({ aed: [1, 2], all: true, project: 10 });
        var sql = captured[0];
        expect(sql).to.match(/JOIN recordings RSCO ON A\.recording_id = RSCO\.recording_id/);
        expect(sql).to.match(/JOIN sites SSCO ON SSCO\.site_id = RSCO\.site_id/);
        expect(sql).to.match(/SSCO\.project_id = 10 OR EXISTS \(SELECT 1 FROM project_imported_sites pis WHERE pis\.site_id = RSCO\.site_id AND pis\.project_id = 10\)/);
        expect(sql).to.match(/A\.aed_id IN \('1','2'\)|A\.aed_id IN \(1,2\)/);
    });
    it('options.project_id (the export job path) gets the SAME constraint', async function() {
        await CJ.findRois({ aed: [3], exportReport: true, project_id: 20 });
        expect(captured[0]).to.match(/SSCO\.project_id = 20/);
    });
    it('NO project passed (internal callers like playlist creation) — unchanged SQL', async function() {
        await CJ.findRois({ aed: [3] });
        expect(captured[0]).to.not.match(/RSCO/);
    });
});