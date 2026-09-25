var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

/**
 * REGRESSION GUARDS — rfcx-local OPEN-ITEMS §391 (2026-09-25).
 *
 * Measured over HTTP as a NON-super user (topher@, member of public project
 * 1989, not of private 8869): GET /legacy-api/project/<1989>/recordings/info/
 * <8869's recording> returned 200 with the full record. The same class had
 * fired twice before (§291, §292). The durable fix is ONE guard
 * (app/utils/project-scope.js) plus a required PR check
 * (build/check-project-scope.js) over every id route under /project/*.
 *
 * These tests pin each consumer to the guard and re-run the guard/gate
 * self-test, so a revert of any hunk goes RED here as well as in the gate.
 */
function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
var R = 'app/routes/data-api/project/';

function sliceFrom(src, start, endMarker) {
    var i = src.indexOf(start);
    expect(i, start).to.be.greaterThan(-1);
    var j = endMarker ? src.indexOf(endMarker, i + start.length) : -1;
    return src.slice(i, j > i ? j : undefined);
}

describe('§391 project-scope guard — consumers', function() {

    it('recordings oneRecUrl param checks ownership BEFORE resolving, 404 body identical to unknown id', function() {
        var fn = sliceFrom(read(R + 'recordings.js'), "router.param('oneRecUrl'", "router.get('/tiles/");
        var g = fn.indexOf('projectScope.recordingUrlOwned(model.recordings, recording_url, req.project.project_id)');
        var f = fn.indexOf('model.recordings.findByUrlMatch(');
        expect(g).to.be.greaterThan(-1);
        expect(g).to.be.lessThan(f);
        // both the foreign and the missing path answer the SAME body
        expect(fn.split('res.status(404).json({ error: "recording not found"})').length - 1).to.equal(2);
        expect(fn).to.contain('.catch(next)');
    });

    it('list / count / available route the selector through scopedSelector', function() {
        var src = read(R + 'recordings.js');
        ["router.get('/:recUrl?'", "router.get('/count/:recUrl?'", "router.get('/available/:recUrl?'"].forEach(function(r) {
            var fn = sliceFrom(src, r, 'router.');
            expect(fn, r).to.contain('scopedSelector(req, req.params.recUrl)');
        });
        var helper = sliceFrom(src, 'function scopedSelector', '\n}\n');
        expect(helper).to.contain('projectScope.selectorOwned(urlquery, req.project.project_id)');
        expect(helper).to.contain('deniedSelector(urlquery)');
    });

    it('prev/next (?recording_id=) and tiles are bound to the project', function() {
        var src = read(R + 'recordings.js');
        var list = sliceFrom(src, "router.get('/:recUrl?'", "router.get('/count/");
        expect(list).to.contain("projectScope.ownedByProject('recording', req.query.recording_id, req.project.project_id)");
        var tiles = sliceFrom(src, "router.get('/tiles/", "router.get('/:get/");
        var g = tiles.indexOf("projectScope.ownedByProject('recording', recordingId, req.project.project_id)");
        expect(g).to.be.greaterThan(-1);
        expect(g).to.be.lessThan(tiles.indexOf('findByRecordingId('));
    });

    it('exists/site/:siteid answers {exists:false} for a foreign site', function() {
        var fn = sliceFrom(read(R + 'recordings.js'), "router.get('/exists/site/", "router.get('/search'");
        expect(fn).to.contain("projectScope.ownedByProject('site', site_id, req.project.project_id)");
        expect(fn).to.contain('res.json({ exists: false })');
    });

    it('sites.js siteid param (the FOURTH instance) is bound to the project', function() {
        var fn = sliceFrom(read(R + 'sites.js'), "router.param('siteid'", "router.get('/:siteid/uploads.txt'");
        var g = fn.indexOf("projectScope.ownedByProject('site', siteid, req.project.project_id)");
        expect(g).to.be.greaterThan(-1);
        expect(g).to.be.lessThan(fn.indexOf('model.sites.findById('));
        expect(fn.split('res.status(404).json({ error: "site not found"})').length - 1).to.equal(2);
    });

    it('tags PUT binds the recording to the project before tagging', function() {
        var fn = sliceFrom(read(R + 'tags.js'), "router.put('/:resource/:id'", "router.delete(");
        var g = fn.indexOf("projectScope.ownedByProject('recording', req.params.id, req.project.project_id)");
        expect(g).to.be.greaterThan(-1);
        expect(g).to.be.lessThan(fn.indexOf('findByIdAsync('));
        expect(fn).to.contain('}).catch(next);');
    });

    it('the share-card resolver refuses a foreign recording', function() {
        var src = read('app/routes/resource-cards/visualizer.js');
        var g = src.indexOf('projectScope.recordingUrlOwned(Recordings, urlarg, project.project_id)');
        expect(g).to.be.greaterThan(-1);
        expect(g).to.be.lessThan(src.indexOf('Recordings.findByUrlMatch('));
    });

    it('findByUrlMatch itself is NOT scoped (its model-internal callers pass null/0 on purpose)', function() {
        var src = read('app/model/recordings.js');
        // model stays unscoped: it never requires the guard
        expect(/require\([^)]*project-scope/.test(src)).to.equal(false);
        expect(read('app/model/playlists.js')).to.contain("findByUrlMatch({id: Number(id)}, null");
    });

    it('training-set remove-roi binds the ROI to the scoped training set and never concatenates the id', function() {
        var src = read('app/model/training_sets.js');
        var fn = sliceFrom(src, 'remove_roi : function', '    },');
        expect(fn).to.contain('where roi_set_data_id = ? and training_set_id = ?');
        expect(fn).to.not.match(/roi_set_data_id = "\s*\+/);
        expect(src).to.contain('typedef.remove_roi(roi_id, training_set, callback)');
    });

    it('the guard module has no app/model or npm requires (stays out of the job-stage closure; runs on bare node)', function() {
        var src = read('app/utils/project-scope.js');
        var reqs = (src.match(/require\(['"][^'"]+['"]\)/g) || []);
        expect(reqs).to.deep.equal(["require('./dbpool')"]);
    });
});

describe('§391 template duplicate → 409 (FINDING spa-visualizer F3)', function() {
    it('PG_INSERT_NO_ROW raises an APIError with status 409 and the user-facing message', function() {
        var src = read('app/model/templates.js');
        expect(src).to.contain("const APIError = require('../utils/apierror');");
        var i = src.indexOf("err.code === 'PG_INSERT_NO_ROW'");
        var blk = src.slice(i, i + 900);
        expect(blk).to.contain("throw new APIError('Template already exists for this project/recording/species/songtype', 409)");
        expect(blk).to.not.contain('throw new Error(');
    });

    it('the app error handler returns an APIError message with its status (so the 409 reaches the SPA)', function() {
        var src = read('app/index.js');
        expect(src).to.contain('res.status(err.status || 500)');
        expect(src).to.contain('if(err instanceof APIError){\n            return res.json(err.message);');
        var APIError = require('../app/utils/apierror');
        var e = new APIError('x', 409);
        expect(e).to.be.instanceOf(Error);
        expect(e.status).to.equal(409);
    });
});

describe('§391 gate + guard self-test (red-tests included)', function() {
    this.timeout(30000);
    it('build/check-project-scope.selftest.js passes', function() {
        var r = spawnSync(process.execPath, [path.join(__dirname, '..', 'build/check-project-scope.selftest.js')], { encoding: 'utf8' });
        expect(r.status, r.stdout + r.stderr).to.equal(0);
        expect(r.stdout).to.match(/\n(\d+) passed, 0 failed/);
    });
});