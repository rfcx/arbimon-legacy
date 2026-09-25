var expect = require('chai').expect;
var path = require('path');
var http = require('http');
var express = require('express');

/**
 * BEHAVIOURAL guard for §393 slice B: mount the REAL project/clustering-jobs.js
 * router behind a stub of index.js's projectUrl param (req.project = the URL
 * project), with the model layer and the DB pool replaced in require.cache, and
 * drive real HTTP.
 *
 *   - :job_id — NUMERIC ids bound to the URL project (clustering-details,
 *     job-details); the `_`/`undefined` PLACEHOLDER must still pass through
 *     (the visualizer's rois-details shape).
 *   - :recId audio — bound via recording ownership (own ∪ imported site);
 *     aedId resolved within the bound recording.
 *   - rois-details BODY ids — findRois must receive the URL project; a foreign
 *     rec_id must NOT reach getClusteringPlaylist and must answer `[]` (same as
 *     an own recording with no detections).
 *
 * Fixture: project 10 owns clustering job 70 and recording 1000 (own site);
 * recording 2000 on a site imported into 10; project 20 owns job 80 and
 * recording 3000. The fake model records every call (never called for foreign).
 */
var ROOT = path.join(__dirname, '..');
var cjobs = { 70: 10, 80: 20 };
var recs = { 1000: 10, 2000: 'imported-10', 3000: 20 };
var calls = [];

var fakeDbpool = {
    query: function(sql, params) {
        var id = Number(params[0]), pid = Number(params[1]);
        if (/FROM job_params_audio_event_clustering c/.test(sql)) {
            return Promise.resolve(cjobs[id] === pid ? [{ owned: 1 }] : []);
        }
        if (/FROM recordings r JOIN sites s/.test(sql)) {
            var r = recs[id];
            var hit = r === pid || (r === 'imported-' + pid && /project_imported_sites/.test(sql));
            return Promise.resolve(hit ? [{ owned: 1 }] : []);
        }
        return Promise.reject(new Error('unexpected sql ' + sql));
    }
};
var fakeModel = {
    ClusteringJobs: {
        findOne: function(id, opts) { calls.push(['findOne', +id, opts.project]); return Promise.resolve({ job: +id }); },
        findRois: function(opts) { calls.push(['findRois', opts.aed || null, opts.rec_id || null, opts.project]); return Promise.resolve([{ aed_id: 1 }]); },
        getClusteringPlaylist: function(recId) { calls.push(['getClusteringPlaylist', +recId]); return Promise.resolve([{ aed_id: 1, playlist_name: 'pl', playlist_id: 9 }]); },
        getRoiAudioFile: function(opts) { calls.push(['getRoiAudioFile', +opts.recId, +opts.aedId]); return Promise.resolve(undefined); },
        audioEventDetections: function() { return Promise.resolve([]); }
    },
    jobs: { find: function(o, cb) { cb(null, []); }, hideAsync: function() { return Promise.resolve(); } },
    recordings: { writeExportParams: function() { return Promise.resolve({}); } }
};

function stub(rel, exp) {
    var p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
    return p;
}

describe('§393 slice B: clustering id routes are bound to the URL project (real router)', function() {
    this.timeout(20000);
    var server, base, stubbed = [], reloaded = [];

    before(function(done) {
        stubbed.push(stub('app/model/index.js', fakeModel));
        stubbed.push(stub('app/utils/dbpool.js', fakeDbpool));
        ['app/utils/project-scope.js', 'app/routes/data-api/project/clustering-jobs.js'].forEach(function(r) {
            var p = require.resolve(path.join(ROOT, r)); delete require.cache[p]; reloaded.push(p);
        });
        var clRouter = require(path.join(ROOT, 'app/routes/data-api/project/clustering-jobs.js'));
        var app = express();
        app.use(express.json());
        app.use('/project/:pid', function(req, res, next) {
            req.project = { project_id: Number(req.params.pid), url: 'p' + req.params.pid };
            req.session = { user: { id: 1, isSuper: 0, permissions: {} } };
            req.haveAccess = function() { return true; };
            next();
        });
        app.use('/project/:pid/clustering-jobs', clRouter);
        app.use(function(err, req, res, next) { res.status(500).json({ reached: String(err.message) }); });
        server = app.listen(0, '127.0.0.1', function() { base = 'http://127.0.0.1:' + server.address().port; done(); });
    });
    after(function(done) {
        stubbed.concat(reloaded).forEach(function(p) { delete require.cache[p]; });
        server.close(done);
    });
    beforeEach(function() { calls.length = 0; });

    function req(method, p, body) {
        return new Promise(function(resolve, reject) {
            var data = body ? JSON.stringify(body) : null;
            var r = http.request(base + p, { method: method, headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {} }, function(res) {
                var b = ''; res.on('data', function(c) { b += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: b }); });
            });
            r.on('error', reject);
            if (data) r.write(data);
            r.end();
        });
    }
    function get(p) { return req('GET', p); }
    function post(p, b) { return req('POST', p, b); }

    it('job-details: own 200; FOREIGN 404 === missing 404, model never called', async function() {
        expect((await get('/project/10/clustering-jobs/70/job-details')).status).to.equal(200);
        var foreign = await get('/project/10/clustering-jobs/80/job-details');
        var missing = await get('/project/10/clustering-jobs/9999/job-details');
        expect(foreign.status).to.equal(404);
        expect(missing.status).to.equal(404);
        expect(foreign.body).to.equal(missing.body);
        expect(calls.filter(function(c) { return c[1] === 80 || c[1] === 9999; })).to.deep.equal([]);
        expect((await get('/project/20/clustering-jobs/80/job-details')).status).to.equal(200);
    });

    it('clustering-details: foreign job 404s BEFORE any S3 read (error surfaces as 500-reached or 404, never the foreign JSON)', async function() {
        var foreign = await get('/project/10/clustering-jobs/80/clustering-details');
        var missing = await get('/project/10/clustering-jobs/9999/clustering-details');
        expect(foreign.status).to.equal(404);
        expect(foreign.body).to.equal(missing.body);
        expect((await get('/project/20/clustering-jobs/80/clustering-details')).status).to.not.equal(404);
    });

    it('rois-details: numeric job id bound (foreign 404); PLACEHOLDER `_` passes through with body bound to the URL project', async function() {
        var foreign = await post('/project/10/clustering-jobs/80/rois-details', { aed: [1], all: true });
        expect(foreign.status).to.equal(404);
        expect(calls).to.deep.equal([]);
        var ph = await post('/project/10/clustering-jobs/_/rois-details', { aed: [1, 2], all: true });
        expect(ph.status).to.equal(200);
        expect(calls[0]).to.deep.equal(['findRois', [1, 2], null, 10]);
        var own = await post('/project/10/clustering-jobs/70/rois-details', { rec_id: 1000, all: true });
        expect(own.status).to.equal(200);
        expect(calls.filter(function(c) { return c[0] === 'findRois'; })[1]).to.deep.equal(['findRois', null, 1000, 10]);
        expect(calls.filter(function(c) { return c[0] === 'getClusteringPlaylist'; })).to.deep.equal([['getClusteringPlaylist', 1000]]);
    });

    it('rois-details: foreign rec_id in the body → `[]` (own-no-detections shape), playlist lookup NEVER runs', async function() {
        var r = await post('/project/10/clustering-jobs/_/rois-details', { rec_id: 3000, all: true });
        expect(r.status).to.equal(200);
        expect(r.body).to.equal('[]');
        expect(calls.filter(function(c) { return c[0] === 'getClusteringPlaylist'; })).to.deep.equal([]);
        // imported recording: owned → reaches both model calls
        var imp = await post('/project/10/clustering-jobs/_/rois-details', { rec_id: 2000, all: true });
        expect(imp.status).to.equal(200);
        expect(JSON.parse(imp.body)).to.deep.equal([{ aed_id: 1, playlist_name: 'pl', playlist_id: 9 }]);
    });

    it('/:recId/audio/:aedId — own + imported reach the model; FOREIGN rec 404 === missing 404, model never called', async function() {
        await get('/project/10/clustering-jobs/1000/audio/7');
        expect(calls).to.deep.equal([['getRoiAudioFile', 1000, 7]]);
        calls.length = 0;
        await get('/project/10/clustering-jobs/2000/audio/7');
        expect(calls).to.deep.equal([['getRoiAudioFile', 2000, 7]]);
        calls.length = 0;
        var foreign = await get('/project/10/clustering-jobs/3000/audio/7');
        var missing = await get('/project/10/clustering-jobs/9999/audio/7');
        expect(foreign.status).to.equal(404);
        expect(missing.status).to.equal(404);
        expect(foreign.body).to.equal(missing.body);
        expect(calls).to.deep.equal([]);
        // the aedId is resolved within the bound recording by the model call (recId, aedId pair)
        expect((await get('/project/20/clustering-jobs/3000/audio/7')).status).to.equal(404); // fake model: no audio -> 404
    });
});