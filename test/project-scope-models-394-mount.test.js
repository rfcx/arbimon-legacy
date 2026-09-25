var expect = require('chai').expect;
var path = require('path');
var http = require('http');
var express = require('express');

/**
 * §394 MOUNT proof: load the REAL app/routes/data-api/project/index.js (its
 * real `router.param('projectUrl')`), with only the model layer + DB pool
 * faked, and prove that /:projectUrl/models*, /validations and
 * /soundscape/single-batch now pass THROUGH that param: a non-member of a
 * PRIVATE project gets 401 and the model layer is never asked for the data.
 * Before §394 these URLs were served by a root-mounted router that the param
 * never saw (measured 200 on prod).
 */
var ROOT = path.join(__dirname, '..');
var projects = { priv: { project_id: 30, url: 'priv', is_private: 1 }, pub: { project_id: 10, url: 'pub', is_private: 0 } };
var reached = [];
function rec(name) { return function() { reached.push(name); var cb = arguments[arguments.length - 1]; if (typeof cb === 'function') cb(null, []); return Promise.resolve([]); }; }

var fakeModel = new Proxy({
    projects: new Proxy({
        find: function(q, cb) { cb(null, projects[q.url] ? [projects[q.url]] : []); },
    }, { get: function(t, k) { return k in t ? t[k] : rec('projects.' + String(k)); } }),
    users: new Proxy({
        getPermissions: function(uid, pid, cb) { cb(null, pid === 10 ? [{ name: 'view project' }] : []); }
    }, { get: function(t, k) { return k in t ? t[k] : rec('users.' + String(k)); } })
}, { get: function(t, k) { return k in t ? t[k] : new Proxy({}, { get: function(_, f) { return rec(String(k) + '.' + String(f)); } }); } });
var fakeDbpool = { query: function() { reached.push('dbpool.query'); return Promise.resolve([]); }, format: function(s) { return s; }, escape: function(v) { return String(v); }, queryHandler: rec('dbpool.queryHandler') };

function stub(rel, exp) {
    var p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
    return p;
}

describe('§394 mount: models/validations/single-batch go through the REAL projectUrl param', function() {
    this.timeout(30000);
    var server, base, stubbed = [], reloaded = [];
    before(function(done) {
        stubbed.push(stub('app/model/index.js', fakeModel));
        stubbed.push(stub('app/utils/dbpool.js', fakeDbpool));
        ['app/routes/data-api/project/index.js', 'app/routes/data-api/project/models.js', 'app/utils/project-scope.js'].forEach(function(r) {
            var p = require.resolve(path.join(ROOT, r)); delete require.cache[p]; reloaded.push(p);
        });
        var projectRouter = require(path.join(ROOT, 'app/routes/data-api/project/index.js'));
        var app = express();
        app.use(express.json());
        app.use(function(req, res, next) {
            req.session = { user: { id: 7, isSuper: 0, permissions: {} } };
            req.haveAccess = function() { return false; };
            next();
        });
        app.use('/legacy-api/project', projectRouter);
        app.use(function(err, req, res, next) { res.status(500).json({ reached: String(err && err.message) }); });
        server = app.listen(0, '127.0.0.1', function() { base = 'http://127.0.0.1:' + server.address().port; done(); });
    });
    after(function(done) {
        stubbed.concat(reloaded).forEach(function(p) { delete require.cache[p]; });
        server.close(done);
    });
    beforeEach(function() { reached.length = 0; });

    function req(method, p) {
        return new Promise(function(resolve, reject) {
            var r = http.request(base + p, { method: method, headers: { 'content-type': 'application/json' } }, function(res) {
                var b = ''; res.on('data', function(c) { b += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: b }); });
            });
            r.on('error', reject); r.end(method === 'POST' ? '{}' : undefined);
        });
    }

    var PRIVATE = [
        ['GET', '/models'], ['GET', '/models/forminfo'], ['GET', '/models/123'], ['GET', '/models/123/validation-list'],
        ['GET', '/models/123/retraining?jobId=1'], ['GET', '/models/123/shared'], ['GET', '/models/123/training-vector/1'],
        ['GET', '/models/123/delete'], ['POST', '/models/savethreshold'], ['POST', '/models/share-model'],
        ['POST', '/models/123/unshare'], ['POST', '/models/new'],
        ['GET', '/validations?species_id=1&sound_id=1'], ['POST', '/soundscape/single-batch']
    ];
    PRIVATE.forEach(function(c) {
        it('private non-member ' + c[0] + ' ' + c[1] + ' → 401, model layer untouched', async function() {
            var r = await req(c[0], '/legacy-api/project/priv' + c[1]);
            expect(r.status).to.equal(401);
            expect(reached, JSON.stringify(reached)).to.deep.equal([]);
        });
    });

    it('unknown project → 404 from the param', async function() {
        expect((await req('GET', '/legacy-api/project/nope/models')).status).to.equal(404);
    });

    it('CONTROL: a public project passes the param and reaches the model layer', async function() {
        var r = await req('GET', '/legacy-api/project/pub/models');
        expect(r.status).to.equal(200);
        expect(reached).to.contain('projects.modelList');
    });
});