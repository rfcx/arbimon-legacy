var expect = require('chai').expect;
var path = require('path');
var http = require('http');
var fs = require('fs');
var express = require('express');

/**
 * BEHAVIOURAL guard for §394: mount the REAL project/models.js router behind a
 * stub of index.js's projectUrl param (req.project = the URL project), with
 * the model layer and the DB pool replaced in require.cache, then drive real
 * HTTP requests: own / shared-copy / imported / FOREIGN / missing for every
 * read, and the three write routes that had NO check before (savethreshold,
 * share-model, unshare) plus delete + retraining.
 *
 * For every foreign case the test asserts the fake model's WRITE functions
 * were NEVER called — a status code alone cannot prove a write did not happen.
 *
 * Fixture (mirrors the shapes measured on the replica 2026-09-25):
 *   project 10: original 500 (job 5000), shared COPY 501 (row in 10, uri of
 *               project 20's model 600 → job 6000), imports 602 (a project-20
 *               row, via project_imported_models)
 *   project 20: original 600 (job 6000) + its copy 601 living in project 30
 *   project 30: original 700 (job 7000) and copy 601 of 600
 *   user: manages models in 10 and 20, is a Guest (no manage) in 40, nothing in 30.
 */
var ROOT = path.join(__dirname, '..');
var models = {
    500: { model_id: 500, project_id: 10, name: 'm500', uri: 'project_10/models/job_5000_1_1.mod', training_set_id: 1 },
    501: { model_id: 501, project_id: 10, name: 'm600', uri: 'project_20/models/job_6000_1_1.mod', training_set_id: 2 },
    600: { model_id: 600, project_id: 20, name: 'm600', uri: 'project_20/models/job_6000_1_1.mod', training_set_id: 2 },
    601: { model_id: 601, project_id: 30, name: 'm600', uri: 'project_20/models/job_6000_1_1.mod', training_set_id: 2 },
    602: { model_id: 602, project_id: 20, name: 'm602', uri: 'project_20/models/job_6020_1_1.mod', training_set_id: 3 },
    700: { model_id: 700, project_id: 30, name: 'm700', uri: 'project_30/models/job_7000_1_1.mod', training_set_id: 4 },
    800: { model_id: 800, project_id: 40, name: 'm800', uri: 'project_40/models/job_8000_1_1.mod', training_set_id: 5 },
    // a COPY of project 10's model 500, living in project 30 and IMPORTED back into 10: its uri names
    // project 10, so only the row-ownership check (model_own) tells it is not 10's to write.
    503: { model_id: 503, project_id: 30, name: 'm500', uri: 'project_10/models/job_5000_1_1.mod', training_set_id: 1 }
};
var jpt = { 500: 5000, 600: 6000, 602: 6020, 700: 7000 };
var pim = [[602, 10], [503, 10]];
var jobs = { 5000: 10, 6000: 20, 6020: 20, 7000: 30 };
var trainingSets = { 1: 10, 2: 20, 4: 30 };
var playlists = { 11: 10, 33: 30 };
var perms = { 10: true, 20: true, 30: false, 40: false };
var writes = [];
var reads = [];

function sqlParams(sql, params) { return { sql: sql, params: params }; }
var fakeDbpool = {
    query: function(sql, params) {
        var id = Number(params[0]), pid = Number(params[1]);
        var hit = false;
        if (/FROM models m/.test(sql)) {
            var m = models[id];
            hit = !!m && (m.project_id === pid || (/project_imported_models/.test(sql) && pim.some(function(x) { return x[0] === id && x[1] === pid; })));
        } else if (/FROM playlists/.test(sql)) { hit = playlists[id] === pid; }
        else if (/FROM training_sets/.test(sql)) { hit = trainingSets[id] === pid; }
        else if (/FROM jobs/.test(sql)) { hit = jobs[id] === pid; }
        else { return Promise.reject(new Error('unexpected sql ' + sql)); }
        return Promise.resolve(hit ? [{ owned: 1 }] : []);
    }
};

var fakeModel = {
    projects: {
        modelList: function(url, cb) { reads.push(['modelList', url]); cb(null, [{ model_id: 1, job_id: 1 }]); },
        trainingSets: function(url, cb) { reads.push(['trainingSets', url]); cb(null, []); },
        modelValidationUri: function(id, cb) { reads.push(['modelValidationUri', +id]); cb(null, []); }
    },
    models: {
        types: function(cb) { cb(null, []); },
        isModelRetrained: function() { return Promise.resolve(null); },
        getModelById: function(id, cb) { reads.push(['getModelById', +id]); cb(null, models[id] ? [Object.assign({}, models[id])] : []); },
        getModelByUri: function(pid, uri) {
            var hit = Object.keys(models).map(function(k) { return models[k]; }).filter(function(m) { return m.project_id === pid && m.uri === uri; });
            return Promise.resolve(hit[0]);
        },
        getModelJobId: function(id) { return Promise.resolve(jpt[id] ? { job_id: jpt[id] } : undefined); },
        details: function(id, opts, cb) { reads.push(['details', +id, opts]); cb(null, { id: +id, jobId: opts.isSharedModel ? opts.sourceJobId : jpt[id] }); },
        getModelRetrainingDates: function(jobId, cb) { reads.push(['retrainingDates', String(jobId)]); cb(null, [{ date_created: 'd' + jobId }]); },
        getSharedModels: function(opts) { reads.push(['getSharedModels', opts.projectId]); return Promise.resolve([]); },
        getTrainingVector: function(id, rec, cb) { reads.push(['getTrainingVector', +id]); cb(new Error('vector-reached-' + id)); },
        savethreshold: function(m, t, pid, cb) { writes.push(['savethreshold', +m, pid]); cb(null, {}); },
        checkExistingModel: function(opts, cb) { cb(null, []); },
        shareModel: function(opts, cb) { writes.push(['shareModel', +opts.modelId, opts.projectIdTo]); cb(null, {}); },
        unshareModel: function(opts) {
            writes.push(['unshareModel', +opts.modelId, +opts.projectId, opts.sourceUri, opts.sourceProjectId]);
            var m = models[opts.modelId];
            var hit = m && m.project_id === +opts.projectId && m.uri === opts.sourceUri && m.project_id !== opts.sourceProjectId;
            return Promise.resolve({ affectedRows: hit ? 1 : 0 });
        },
        delete: function(id, cb) { writes.push(['delete', +id]); cb(null, {}); },
        createRFM: function(d, cb) { cb(null, {}); }
    },
    jobs: {
        modelNameExists: function(o, cb) { cb(null, [{ count: 0 }]); },
        newJob: function(params, type) { writes.push(['newJob', type, params.project]); return Promise.resolve(1); },
        hideAsync: function() { return Promise.resolve(); }
    },
    users: {
        getPermissions: function(uid, pid) {
            return Promise.resolve(perms[pid] ? [{ name: 'manage models and classification' }] : [{ name: 'view' }]);
        }
    }
};

function stub(rel, exp) {
    var p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
    return p;
}

describe('§394 models routes: behavioural matrix (real router, fake model/DB)', function() {
    this.timeout(20000);
    var server, base, stubbed = [], reloaded = [];

    before(function(done) {
        stubbed.push(stub('app/model/index.js', fakeModel));
        stubbed.push(stub('app/utils/dbpool.js', fakeDbpool));
        stubbed.push(stub('app/utils/monkey.js', function() {}));
        ['app/utils/project-scope.js', 'app/routes/data-api/project/models.js'].forEach(function(r) {
            var p = require.resolve(path.join(ROOT, r)); delete require.cache[p]; reloaded.push(p);
        });
        var modelsRouter = require(path.join(ROOT, 'app/routes/data-api/project/models.js'));
        var app = express();
        app.use(express.json());
        app.use('/project/:pid', function(req, res, next) {
            req.project = { project_id: Number(req.params.pid), url: 'p' + req.params.pid };
            req.session = { user: { id: 1, isSuper: 0, permissions: {} } };
            req.haveAccess = function(pid) { return !!perms[pid]; };
            next();
        });
        app.use('/project/:pid/models', modelsRouter);
        app.use(function(err, req, res, next) { res.status(err.status || 500).json({ reached: String(err.message) }); });
        server = app.listen(0, '127.0.0.1', function() { base = 'http://127.0.0.1:' + server.address().port; done(); });
    });
    after(function(done) {
        stubbed.concat(reloaded).forEach(function(p) { delete require.cache[p]; });
        server.close(done);
    });
    beforeEach(function() { writes.length = 0; reads.length = 0; });
    // chai 3's deep.include does not deep-compare array members; compare JSON.
    function has(list, item) { return list.some(function(x) { return JSON.stringify(x) === JSON.stringify(item); }); }

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
    var get = function(p) { return req('GET', p); };
    var post = function(p, b) { return req('POST', p, b); };

    it('list + forminfo read the URL project (req.project), never a raw slug', async function() {
        expect((await get('/project/10/models')).status).to.equal(200);
        expect((await get('/project/10/models/forminfo')).status).to.equal(200);
        expect(has(reads, ['modelList', 'p10'])).to.equal(true);
        expect(has(reads, ['trainingSets', 'p10'])).to.equal(true);
    });

    it('GET /:mid — own 200, shared COPY 200 (reads the source), IMPORTED 200, FOREIGN 404 === missing 404', async function() {
        var own = await get('/project/10/models/500');
        var copy = await get('/project/10/models/501');
        var imp = await get('/project/10/models/602');
        var foreign = await get('/project/10/models/700');
        var missing = await get('/project/10/models/9999');
        expect(own.status).to.equal(200);
        expect(copy.status).to.equal(200);
        expect(JSON.parse(copy.body).jobId).to.equal(6000);
        expect(imp.status).to.equal(200);
        expect(foreign.status).to.equal(404);
        expect(missing.status).to.equal(404);
        expect(foreign.body).to.equal(missing.body);
        expect(reads.filter(function(r) { return r[0] === 'details' && r[1] === 700; })).to.have.length(0);
        // CONTROL: the foreign model opens under ITS OWN project
        expect((await get('/project/30/models/700')).status).to.equal(200);
    });

    it('every other :mid / :modelId read route is bound the same way', async function() {
        var paths = ['/validation-list?limit=1&offset=0', '/retraining?jobId=7000', '/shared?modelName=m700', '/training-vector/1'];
        for (var i = 0; i < paths.length; i++) {
            var f = await get('/project/10/models/700' + paths[i]);
            expect(f.status, paths[i]).to.equal(404);
        }
        expect(reads.filter(function(r) { return r[1] === 700 || r[1] === '7000'; })).to.have.length(0);
        // own reaches the model layer
        expect((await get('/project/10/models/500/training-vector/1')).body).to.contain('vector-reached-500');
        // shared copy reads the SOURCE model's vector
        expect((await get('/project/10/models/501/training-vector/1')).body).to.contain('vector-reached-600');
    });

    it('retraining: the model\'s own job (or a copy\'s SOURCE job) only; any other job reads nothing', async function() {
        expect(JSON.parse((await get('/project/10/models/500/retraining?jobId=5000')).body)).to.deep.equal([{ date_created: 'd5000' }]);
        expect(JSON.parse((await get('/project/10/models/501/retraining?jobId=6000')).body)).to.deep.equal([{ date_created: 'd6000' }]);
        expect(JSON.parse((await get('/project/10/models/500/retraining?jobId=7000')).body)).to.deep.equal([]);
        expect(reads.filter(function(r) { return r[0] === 'retrainingDates' && r[1] === '7000'; })).to.have.length(0);
    });

    it('shared list is for the URL project', async function() {
        await get('/project/10/models/500/shared?modelName=m500');
        expect(has(reads, ['getSharedModels', 10])).to.equal(true);
    });

    it('savethreshold: own 200; FOREIGN / IMPORTED / missing 404 and NO write; no permission 403', async function() {
        expect((await post('/project/10/models/savethreshold', { m: 500, t: 0.5 })).status).to.equal(200);
        expect(writes).to.deep.equal([['savethreshold', 500, 10]]);
        writes.length = 0;
        expect((await post('/project/10/models/savethreshold', { m: 700, t: 0.5 })).status).to.equal(404);
        expect((await post('/project/10/models/savethreshold', { m: 602, t: 0.5 })).status).to.equal(404);
        expect((await post('/project/10/models/savethreshold', { m: 9999, t: 0.5 })).status).to.equal(404);
        expect((await post('/project/10/models/savethreshold', { m: '500 OR 1=1', t: 0.5 })).status).to.equal(404);
        expect((await post('/project/40/models/savethreshold', { m: 800, t: 0.5 })).status).to.equal(403);
        expect(writes).to.deep.equal([]);
    });

    it('share-model: own ORIGINAL → a project the user manages 200; every other shape refused with NO write', async function() {
        expect((await post('/project/10/models/share-model', { modelId: 500, modelName: 'x', projectId: 20 })).status).to.equal(200);
        expect(writes).to.deep.equal([['shareModel', 500, 20]]);
        writes.length = 0;
        // foreign source model
        expect((await post('/project/10/models/share-model', { modelId: 700, projectId: 20 })).status).to.equal(404);
        // a copy / an import is not ours to re-share
        expect((await post('/project/10/models/share-model', { modelId: 501, projectId: 20 })).status).to.equal(404);
        expect((await post('/project/10/models/share-model', { modelId: 602, projectId: 20 })).status).to.equal(404);
        expect((await post('/project/10/models/share-model', { modelId: 503, projectId: 20 })).status).to.equal(404);
        // target the user cannot manage
        expect((await post('/project/10/models/share-model', { modelId: 500, projectId: 30 })).status).to.equal(403);
        expect((await post('/project/10/models/share-model', { modelId: 500, projectId: 40 })).status).to.equal(403);
        // injection / junk target
        expect((await post('/project/10/models/share-model', { modelId: 500, projectId: '20; DELETE FROM models' })).status).to.equal(400);
        expect((await post('/project/10/models/share-model', { modelId: '500 OR 1=1', projectId: 20 })).status).to.equal(404);
        // self-share
        expect((await post('/project/10/models/share-model', { modelId: 500, projectId: 10 })).status).to.equal(400);
        // no manage permission in the source
        expect((await post('/project/40/models/share-model', { modelId: 800, projectId: 20 })).status).to.equal(403);
        expect(writes).to.deep.equal([]);
    });

    it('unshare: from the SOURCE page, a copy of THAT model in another project; originals / other models refused', async function() {
        // legit: source 600 (project 20) unshares its copy 601 in project 30
        var ok = await post('/project/20/models/600/unshare', { model: 601, project: 30 });
        expect(ok.status).to.equal(201);
        writes.length = 0;
        // an ORIGINAL of another project named as the "copy" — the DELETE predicate refuses (uri differs)
        expect((await post('/project/20/models/600/unshare', { model: 700, project: 30 })).status).to.equal(404);
        // :mid foreign to the URL project → refused before any write
        expect((await post('/project/10/models/700/unshare', { model: 601, project: 30 })).status).to.equal(404);
        // :mid is a COPY in the URL project (not an original) → refused before any write
        expect((await post('/project/10/models/501/unshare', { model: 601, project: 30 })).status).to.equal(404);
        // :mid imported into the URL project → refused before any write
        expect((await post('/project/10/models/602/unshare', { model: 601, project: 30 })).status).to.equal(404);
        // :mid imported into the URL project whose uri even names the URL project → still refused (row is 30's)
        expect((await post('/project/10/models/503/unshare', { model: 601, project: 30 })).status).to.equal(404);
        // no manage permission in the URL project (its own model 800)
        expect((await post('/project/40/models/800/unshare', { model: 601, project: 30 })).status).to.equal(403);
        // a model not readable from the URL project is 404 before the permission check (no oracle)
        expect((await post('/project/40/models/600/unshare', { model: 601, project: 30 })).status).to.equal(404);
        var real = writes.filter(function(w) { return w[0] === 'unshareModel'; });
        expect(real).to.have.length(1);
        expect(real[0][3]).to.equal('project_20/models/job_6000_1_1.mod');
        expect(real[0][4]).to.equal(20);
    });

    it('delete: own 200; FOREIGN / IMPORTED 404 and NO delete', async function() {
        expect((await get('/project/10/models/500/delete')).status).to.equal(200);
        expect(writes).to.deep.equal([['delete', 500]]);
        writes.length = 0;
        expect((await get('/project/10/models/700/delete')).status).to.equal(404);
        expect((await get('/project/10/models/602/delete')).status).to.equal(404);
        expect(writes).to.deep.equal([]);
        expect((await get('/project/40/models/800/delete')).body).to.contain('dont have permission');
        expect(writes).to.deep.equal([]);
    });

    it('new: training set must be the project\'s; a retrain must retrain one of its jobs', async function() {
        expect((await post('/project/10/models/new', { n: 'a', t: 1, c: 1 })).status).to.equal(200);
        expect(writes).to.deep.equal([['newJob', 'training_job', 10]]);
        writes.length = 0;
        var foreignTs = await post('/project/10/models/new', { n: 'a', t: 4, c: 1 });
        expect(foreignTs.status).to.equal(404);
        expect((await post('/project/10/models/new', { isRetrain: true, modelUri: '/x/project_30/models/job_7000_1_1.png' })).status).to.equal(404);
        expect((await post('/project/10/models/new', { isRetrain: true, modelUri: 'no-job-here' })).status).to.equal(404);
        expect(writes).to.deep.equal([]);
        expect((await post('/project/10/models/new', { isRetrain: true, modelUri: '/x/project_10/models/job_5000_1_1.png' })).status).to.equal(200);
        expect(writes).to.deep.equal([['newJob', 'retraining_job', 10]]);
    });

    it('the old root-mounted file is gone and nothing else serves /project/:projectUrl/models', function() {
        expect(fs.existsSync(path.join(ROOT, 'app/routes/data-api/models.js'))).to.equal(false);
        var idx = fs.readFileSync(path.join(ROOT, 'app/routes/data-api/index.js'), 'utf8');
        expect(/require\('\.\/models'\)/.test(idx)).to.equal(false);
        var pidx = fs.readFileSync(path.join(ROOT, 'app/routes/data-api/project/index.js'), 'utf8');
        expect(pidx).to.match(/router\.use\('\/:projectUrl\/models', modelRoutes\)/);
        expect(pidx).to.match(/router\.get\('\/:projectUrl\/validations', /);
        expect(pidx).to.match(/router\.post\('\/:projectUrl\/soundscape\/single-batch', /);
    });

    it('model layer: share/unshare/threshold/getModelById/retraining SQL takes bound parameters, never interpolation', function() {
        var src = fs.readFileSync(path.join(ROOT, 'app/model/models.js'), 'utf8');
        function fn(name) { var i = src.indexOf('    ' + name + ':'); return src.slice(i, src.indexOf('\n    },', i)); }
        expect(fn('shareModel')).to.not.match(/\$\{opts\./);
        expect(fn('checkExistingModel')).to.not.match(/\$\{opts\./);
        expect(fn('getModelById')).to.not.match(/\$\{model_id\}/);
        expect(fn('getModelRetrainingDates')).to.not.match(/\$\{jobId\}/);
        expect(fn('getModelByUri')).to.not.match(/\$\{/);
        expect(fn('unshareModel')).to.match(/uri = \? and project_id <> \?/);
        expect(fn('savethreshold')).to.match(/project_id/);
    });
});