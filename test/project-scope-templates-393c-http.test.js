var expect = require('chai').expect;
var path = require('path');
var http = require('http');
var express = require('express');

/**
 * BEHAVIOURAL guard for §393 slice C: mount the REAL project/templates.js router
 * behind a stub of index.js's projectUrl param (req.project = the URL project),
 * model + DB pool replaced in require.cache, real HTTP.
 *
 * The ruled rule (operator 12:02): the template's row must be the URL project's
 * (original or COPY) or a PUBLIC ORIGINAL (owner public_templates_enabled=1,
 * source_project_id IS NULL, deleted=0) — everyone, staff included. Foreign and
 * missing get the same 404 body; a foreign id never reaches the model.
 *
 * Fixture: 20 is public_templates_enabled; 10 is the viewer; 30 is private.
 *   300 public original in 20 · 301 COPY in 20 (source set) · 302/303 own in 10
 *   (303 deleted) · 304 public original in 20 but deleted · 305 in private 30.
 */
var ROOT = path.join(__dirname, '..');
var tpls = {
    300: { project_id: 20, source_project_id: null, deleted: 0 },
    301: { project_id: 20, source_project_id: 5, deleted: 0 },
    302: { project_id: 10, source_project_id: null, deleted: 0 },
    303: { project_id: 10, source_project_id: 7, deleted: 1 },
    304: { project_id: 20, source_project_id: null, deleted: 1 },
    305: { project_id: 30, source_project_id: null, deleted: 0 }
};
var tflags = { 20: 1 };
var calls = [];

var fakeDbpool = {
    query: function(sql, params) {
        if (!/FROM templates t JOIN projects p/.test(sql)) { return Promise.reject(new Error('unexpected sql ' + sql)); }
        var id = Number(params[0]), pid = Number(params[1]);
        var t = tpls[id];
        var owned = !!t && (t.project_id === pid || (tflags[t.project_id] === 1 && t.source_project_id === null && t.deleted === 0));
        return Promise.resolve(owned ? [{ owned: 1 }] : []);
    }
};
var fakeModel = {
    templates: {
        find: function(opts) {
            calls.push(['find', +opts.id]);
            var t = tpls[opts.id];
            var rows = t ? [{ id: +opts.id, name: 't' + opts.id, recUri: 'project_x/1.flac', storedUri: 'https://s3/x.png' }] : [];
            var p = Promise.resolve(rows); p.get = function(i) { return p.then(function(x) { return x[i]; }); };
            return p;
        },
        getAudioFile: function(id) { calls.push(['getAudioFile', +id]); return Promise.resolve(undefined); },
        delete: function(id, pid) { calls.push(['delete', +id, +pid]); return Promise.resolve(); }
    },
    recordings: {}
};

function stub(rel, exp) {
    var p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
    return p;
}

describe('§393 slice C: template id routes under the ruled rule (real router)', function() {
    this.timeout(20000);
    var server, base, stubbed = [], reloaded = [];

    before(function(done) {
        stubbed.push(stub('app/model/index.js', fakeModel));
        stubbed.push(stub('app/utils/dbpool.js', fakeDbpool));
        ['app/utils/project-scope.js', 'app/routes/data-api/project/templates.js'].forEach(function(r) {
            var p = require.resolve(path.join(ROOT, r)); delete require.cache[p]; reloaded.push(p);
        });
        var tRouter = require(path.join(ROOT, 'app/routes/data-api/project/templates.js'));
        var app = express();
        app.use('/project/:pid', function(req, res, next) {
            req.project = { project_id: Number(req.params.pid), url: 'p' + req.params.pid };
            req.session = { user: { id: 1, isSuper: 0, permissions: {} } };
            req.haveAccess = function() { return true; };
            next();
        });
        app.use('/project/:pid/templates', tRouter);
        app.use(function(err, req, res, next) { res.status(500).json({ reached: String(err.message) }); });
        server = app.listen(0, '127.0.0.1', function() { base = 'http://127.0.0.1:' + server.address().port; done(); });
    });
    after(function(done) {
        stubbed.concat(reloaded).forEach(function(p) { delete require.cache[p]; });
        server.close(done);
    });
    beforeEach(function() { calls.length = 0; });

    function get(p) {
        return new Promise(function(resolve, reject) {
            http.get(base + p, function(res) {
                var b = ''; res.on('data', function(c) { b += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: b }); });
            }).on('error', reject);
        });
    }
    function touched(t) { return calls.filter(function(c) { return c[1] === t; }); }

    ['spectrogram', 'audio', 'download'].forEach(function(kind) {
        var path302 = kind === 'spectrogram' ? '/302/spectrogram' : '/' + kind + '/302.mp3';
        var path300 = kind === 'spectrogram' ? '/300/spectrogram' : '/' + kind + '/300.mp3';
        var path305 = kind === 'spectrogram' ? '/305/spectrogram' : '/' + kind + '/305.mp3';
        var pathMiss = kind === 'spectrogram' ? '/9999/spectrogram' : '/' + kind + '/9999.mp3';

        it(kind + ': own 302 reaches the model; PRIVATE-foreign 305 404 === missing, model never called', async function() {
            await get('/project/10/templates' + path302);
            expect(touched(302).length, 'own reached the model').to.be.above(0);
            var foreign = await get('/project/10/templates' + path305);
            var missing = await get('/project/10/templates' + pathMiss);
            expect(foreign.status).to.equal(404);
            expect(missing.status).to.equal(404);
            expect(foreign.body).to.equal(missing.body);
            expect(touched(305)).to.deep.equal([]);
            expect(touched(9999)).to.deep.equal([]);
        });

        it(kind + ': PUBLIC ORIGINAL 300 is readable under the viewer slug 10; foreign COPY 301 is not; deleted original 304 is not (owner still resolves it)', async function() {
            await get('/project/10/templates' + path300);
            expect(touched(300).length, 'public original reached the model under viewer slug').to.be.above(0);
            var copy = await get('/project/10/templates' + (kind === 'spectrogram' ? '/301/spectrogram' : '/' + kind + '/301.mp3'));
            expect(copy.status, 'foreign copy').to.equal(404);
            var del = await get('/project/10/templates' + (kind === 'spectrogram' ? '/304/spectrogram' : '/' + kind + '/304.mp3'));
            expect(del.status, 'deleted public original').to.equal(404);
            expect(touched(301)).to.deep.equal([]);
            expect(touched(304)).to.deep.equal([]);
            await get('/project/20/templates' + (kind === 'spectrogram' ? '/304/spectrogram' : '/' + kind + '/304.mp3'));
            expect(touched(304).length, 'owner resolves its deleted original').to.be.above(0);
        });
    });

    it('own DELETED template (303) still resolves for its owner (unchanged behaviour)', async function() {
        await get('/project/10/templates/303/spectrogram');
        expect(touched(303).length).to.be.above(0);
    });

    it('/:template/image is GONE (removed with the broken model fn)', async function() {
        var r = await get('/project/10/templates/302/image');
        expect(r.status).to.equal(404);
        expect(touched(302)).to.deep.equal([]);
    });

    it('/:template/remove keeps its model-scoped write under the bound param', async function() {
        var foreign = await new Promise(function(resolve, reject) {
            var rq = http.request(base + '/project/10/templates/305/remove', { method: 'POST' }, function(res) {
                var b = ''; res.on('data', function(c) { b += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: b }); });
            });
            rq.on('error', reject); rq.end();
        });
        expect(foreign.status).to.equal(404);
        expect(calls.filter(function(c) { return c[0] === 'delete'; })).to.deep.equal([]);
    });
});