var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — OPEN-ITEMS §292.
 *
 * Same class as §291: routes under /:projectUrl authorised the project in the
 * URL and then acted on a bare entity id. Measured on live prod 2026-09-09:
 *
 *   - jobs:  168,090 jobs across 2,603 projects hide/cancel-able by id, by any
 *            of 7,334 non-super users holding 'manage project jobs' somewhere.
 *   - tags:  384,578 recording_tags readable/deletable by id; the READ needed
 *            NO permission at all (declared above its router.use gate).
 *   - scomp: 615,471 annotations over 94,115 recordings, same shape.
 *
 * Plus a distinct SECOND defect in the same cancel handler: it called
 * activeJobs(req.params.projectUrl), which is ALWAYS undefined (no
 * mergeParams), and activeJobs(undefined) silently drops the project filter =>
 * a FLEET-WIDE response of 134,558 jobs across 2,525 projects.
 *
 * Source-shape guards (the models need a live pool). The behavioural proof is
 * in the PR: a read-only simulation of the new WHERE clauses with the un-fixed
 * predicate measured alongside as the control.
 */

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
var R = 'app/routes/data-api/project/';
var M = 'app/model/';

describe('§292 — jobs hide/cancel are project-scoped', function() {
    it('jobs.hide requires projectId and scopes the UPDATE', function() {
        var src = read(M + 'jobs.js');
        var i = src.indexOf('hide: function');
        var fn = src.slice(i, i + 700);
        expect(fn).to.contain('requires projectId');
        expect(fn).to.contain('`project_id` = ?');
    });

    it('jobs.cancel requires projectId and scopes the UPDATE', function() {
        var src = read(M + 'jobs.js');
        var i = src.indexOf('cancel: function');
        var fn = src.slice(i, i + 700);
        expect(fn).to.contain('requires projectId');
        expect(fn).to.contain('`project_id` = ?');
    });

    it('hideAsync forwards projectId (5 call sites depend on it)', function() {
        var src = read(M + 'jobs.js');
        var i = src.indexOf('hideAsync: function');
        var fn = src.slice(i, i + 400);
        expect(fn).to.contain('hideAsync: function(jId, projectId)');
        expect(fn).to.contain('hideJob(jId, projectId)');
    });

    it('EVERY hideAsync caller passes a project (no bare-id call sites)', function() {
        var files = [
            'app/routes/data-api/models.js',
            R + 'pattern_matchings.js',
            R + 'classifications.js',
            R + 'clustering-jobs.js',
            R + 'audio-event-detections-clustering.js',
        ];
        var bare = [];
        files.forEach(function(f) {
            var re = /hideAsync\(([^)]*)\)/g, m, src = read(f);
            while ((m = re.exec(src)) !== null) {
                if (m[1].indexOf(',') === -1) bare.push(f + ' :: ' + m[0]);
            }
        });
        expect(bare, 'bare hideAsync call sites: ' + bare.join(' | ')).to.have.length(0);
    });

    it('the cancel handler no longer passes req.params.projectUrl to activeJobs', function() {
        var src = read(R + 'jobs.js');
        expect(src, 'req.params.projectUrl is always undefined here')
            .to.not.contain('activeJobs(req.params.projectUrl');
        expect(src).to.contain('activeJobs({ id: req.project.project_id }');
    });

    it('the jobs router still has NO mergeParams (the fix must not add it)', function() {
        // Adding mergeParams would make projectUrl resolve and switch
        // activeJobs to its P.url branch, changing behaviour on four other
        // routers that rely on params NOT being inherited.
        //
        // Strip comments first: the rationale comment legitimately NAMES
        // mergeParams, and a raw substring check cannot tell a comment from
        // code. (Caught by this test failing on its own first draft -- the
        // same confusion as the 'Classification not found' guard in #1839.)
        var code = read(R + 'jobs.js').replace(/\/\/[^\n]*/g, '');
        expect(code, 'express.Router() must not be given mergeParams')
            .to.not.contain('mergeParams');
    });
});

describe('§292 — tags reads/deletes are project-scoped', function() {
    it('recording getFor requires projectId and constrains by site', function() {
        var src = read(M + 'tags.js');
        var i = src.indexOf('getFor: async function');
        var fn = src.slice(i, i + 1200);
        expect(fn).to.contain('requires projectId');
        expect(fn).to.contain('getProjectSites');
        expect(fn).to.contain('RT.site_id IN');
    });

    it('recording removeFrom requires projectId and constrains the DELETE', function() {
        var src = read(M + 'tags.js');
        var i = src.indexOf('removeFrom: async function');
        var fn = src.slice(i, i + 1200);
        expect(fn).to.contain('requires projectId');
        expect(fn).to.contain('site_id IN');
    });

    it('the routes forward req.project.project_id', function() {
        var src = read(R + 'tags.js');
        expect(src).to.contain('getTagsFor(req.params.resource, req.params.id, req.project.project_id)');
        expect(src).to.contain('req.params.tagId, req.project.project_id');
    });
});

describe('§292 — soundscape annotations are project-scoped', function() {
    it('getAnnotationsFor requires options.project and joins to sites', function() {
        var src = read(M + 'soundscape-composition.js');
        var i = src.indexOf('getAnnotationsFor: function');
        var fn = src.slice(i, i + 1400);
        expect(fn).to.contain('requires options.project');
        expect(fn).to.contain('JOIN sites s');
        expect(fn).to.contain('s.project_id = ?');
    });

    it('annotate verifies the recording belongs to the project BEFORE writing', function() {
        var src = read(M + 'soundscape-composition.js');
        var i = src.indexOf('annotate: function');
        var fn = src.slice(i, i + 1400);
        expect(fn).to.contain('requires options.project');
        expect(fn).to.contain('recording not found in this project');
        var checkIdx = fn.indexOf('JOIN sites s');
        var writeIdx = fn.indexOf('annotateSchema');
        expect(checkIdx, 'the ownership check must precede the write path')
            .to.be.lessThan(writeIdx);
    });

    it('annotateSchema DECLARES project (or joi rejects every call)', function() {
        // Proven by execution: with the key undeclared joi returns
        // '"project" is not allowed' and every annotate call fails.
        var src = read(M + 'soundscape-composition.js');
        var i = src.indexOf('annotateSchema');
        expect(src.slice(i, i + 500)).to.contain('project: joi.number()');
    });

    it('the routes forward req.project.project_id', function() {
        var src = read(R + 'soundscape-composition.js');
        var occurrences = src.split('project: req.project.project_id').length - 1;
        expect(occurrences, 'both the read and the write route must scope')
            .to.be.at.least(2);
    });
});