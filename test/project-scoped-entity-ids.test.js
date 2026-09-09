var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — entity ids must be bound to the project in the URL.
 *
 * Measured on live prod 2026-09-09 (rfcx-local OPEN-ITEMS §291,
 * runbooks/FINDING-2026-09-09-classification-routes-missing-project-scoping.md):
 *
 *   Routes under /:projectUrl/... authorised req.project (the URL) and then
 *   acted on req.params.<id>, never checking the one owned the other. The
 *   permission check was real; it was asked about the WRONG OBJECT.
 *
 *   - READ routes on classifications had NO permission check at all, and the
 *     project gate admits any logged-in user to any of 922 PUBLIC projects, so
 *     11,821 classification jobs across 319 projects (9,663 in 249 PRIVATE
 *     ones) were reachable by a globally-sequential id.
 *   - DESTRUCTIVE routes: ~100,632 live pattern_matchings (1,995 projects) and
 *     ~68,286 live templates (2,291 projects) were cross-project soft-deletable.
 *
 * The fix follows the in-repo pattern (playlists.js:23, soundscapes.js:44):
 * resolve the id scoped by project and 404 a foreign one, PLUS a project
 * predicate on the UPDATE itself so the guarantee survives a future caller that
 * forgets the route-level check.
 *
 * Compatibility was measured before shipping, not assumed: 30 d of production
 * logs gave 190 MATCH / 0 MISMATCH of (url project == owning project) across
 * classifications, pattern-matchings, clustering-jobs and templates.
 */

function read(p) {
    return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

var R = 'app/routes/data-api/project/';
var M = 'app/model/';

describe('project-scoped entity ids — routers resolve the id by project', function() {

    it('classifications defines a project-scoped router.param', function() {
        var src = read(R + 'classifications.js');
        expect(src).to.contain("router.param('classiId'");
        expect(src).to.contain('findInProject');
        expect(src).to.contain('req.project.project_id');
        expect(src).to.contain("res.status(404)");
    });

    it('classifications.findInProject constrains BOTH the id and the project', function() {
        var src = read(M + 'classifications.js');
        var i = src.indexOf('findInProject');
        expect(i).to.be.greaterThan(-1);
        var fn = src.slice(i, i + 900);
        expect(fn).to.contain('jpc.`job_id` =');
        expect(fn).to.contain('j.`project_id` =');
    });

    it('training_sets router.param is project-scoped (it existed but was not)', function() {
        var src = read(R + 'training_sets.js');
        var i = src.indexOf("router.param('trainingSet'");
        expect(i).to.be.greaterThan(-1);
        var fn = src.slice(i, i + 400);
        expect(fn).to.contain('project:');
    });

    it('trainingSets.find lets id and project COMBINE (they were exclusive)', function() {
        // The original `if (query.id) ... else if (query.project)` silently
        // ignored the project when both were supplied -- so a "scoped" param
        // would have been a no-op.
        // Strengthened after MUTATION TESTING: the first version of this
        // assertion sliced 400 chars after the id constraint and looked for
        // 'TS.project_id =' -- which the `else if (query.project)` branch also
        // satisfies, so deleting the NESTED project push left the test GREEN.
        // Assert the nesting itself: inside the `if (query.id)` block, before
        // its closing `else`, a project constraint must appear.
        var src = read(M + 'training_sets.js');
        var i = src.indexOf('find: function');
        var fn = src.slice(i, i + 1600);
        var idIdx = fn.indexOf('TS.training_set_id =');
        expect(idIdx, 'id constraint not found').to.be.greaterThan(-1);
        var elseIdx = fn.indexOf('else if (query.project)', idIdx);
        expect(elseIdx, 'the else-if branch is the landmark for this test')
            .to.be.greaterThan(idIdx);
        var insideIdBlock = fn.slice(idIdx, elseIdx);
        expect(insideIdBlock,
            'the id branch must ALSO be able to constrain the project, or a ' +
            'scoped router.param silently degrades to an id-only lookup')
            .to.contain('TS.project_id =');
    });

    it('the shared-list handler re-lookup is also scoped (it bypassed the param)', function() {
        var src = read(R + 'training_sets.js');
        var i = src.indexOf("'/:trainingSet/shared-list'");
        var fn = src.slice(i, i + 700);
        expect(fn).to.contain('project: req.project.project_id');
    });
});

describe('project-scoped entity ids — destructive model calls carry the project', function() {

    var cases = [
        ['pattern_matchings.js',                    'patternMatchings.delete',   'project_id = ?'],
        ['templates.js',                            'templates.delete',          'project_id = ?'],
        ['audio-event-detections-clustering.js',    'AEDC.delete',               'project_id ='],
        ['clustering-jobs.js',                      'ClusteringJobs.delete',     'project_id ='],
    ];

    cases.forEach(function(c) {
        var file = c[0], label = c[1], pred = c[2];
        it(label + ' requires projectId and scopes the UPDATE', function() {
            var src = read(M + file);
            var i = src.indexOf('delete: function');
            expect(i, 'delete() not found in ' + file).to.be.greaterThan(-1);
            var fn = src.slice(i, i + 1200);
            expect(fn, label + ' must reject a missing projectId').to.contain('requires projectId');
            expect(fn, label + ' UPDATE must carry a project predicate').to.contain(pred);
        });
    });

    it('EVERY caller of those deletes passes a project (no bare-id call sites)', function() {
        // The citizen-scientist route was a THIRD instance, found only by
        // enumerating callers of the changed signature.
        var files = [
            R + 'pattern_matchings.js',
            R + 'templates.js',
            R + 'audio-event-detections-clustering.js',
            R + 'clustering-jobs.js',
            R + 'citizen-scientist/pattern-matchings.js',
        ];
        var bare = [];
        files.forEach(function(f) {
            var src = read(f);
            var re = /(patternMatchings|templates|AudioEventDetectionsClustering|ClusteringJobs)\.delete\(([^)]*)\)/g;
            var m;
            while ((m = re.exec(src)) !== null) {
                if (m[2].indexOf(',') === -1) bare.push(f + ' :: ' + m[0]);
            }
        });
        expect(bare, 'bare-id delete call sites remain: ' + bare.join(' | ')).to.have.length(0);
    });
});