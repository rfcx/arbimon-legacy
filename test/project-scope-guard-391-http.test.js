var expect = require('chai').expect;
var path = require('path');
var http = require('http');
var express = require('express');

/**
 * BEHAVIOURAL guard for §391: mount the REAL recordings + sites routers behind
 * a stub of index.js's projectUrl param (req.project = the URL project), with
 * the model and the DB pool replaced in require.cache. Then issue real HTTP
 * requests and assert STATUS + BODY for own / imported / foreign / missing —
 * the §1.1 acceptance matrix, minus the auth layer (which the live probe
 * covers).
 *
 * Fixture: project 10 owns site 100 (rec 1000) and imports site 200 (rec
 * 2000, owned by project 20); project 30 owns site 300 (rec 3000).
 */
var ROOT = path.join(__dirname, '..');
var sites = { 100: 10, 200: 20, 300: 30 };
var recs = { 1000: 100, 2000: 200, 3000: 300 };
var imported = [[200, 10]];
var queries = [];

function owned(site, pid) {
    return sites[site] === pid || imported.some(function(x) { return x[0] === site && x[1] === pid; });
}
var fakeDbpool = {
    query: function(sql, params) {
        queries.push(sql);
        var id = params[0], pid = params[1];
        var site = /FROM recordings r/.test(sql) ? recs[id] : (sites[id] !== undefined ? id : undefined);
        return Promise.resolve(site !== undefined && owned(site, pid) ? [{ owned: 1 }] : []);
    }
};
function parseUrlQuery(u) {
    var m;
    if ((m = /^(\d+)(\.(wav|flac|opus))?\/?$/.exec(String(u)))) return Promise.resolve({ id: { '=': Number(m[1]) } });
    if ((m = /^!q:(\d+)/.exec(String(u)))) return Promise.resolve({ site: { '=': Number(m[1]) } });
    return Promise.resolve({});
}
var fakeModel = {
    recordings: {
        parseUrlQuery: parseUrlQuery,
        findByUrlMatch: function(url, pid, opts, cb) {
            // Unscoped for by-id/by-site, exactly like the real model.
            return parseUrlQuery(url && typeof url === 'object' ? '' : url).then(function(q) {
                if (url && typeof url === 'object' && url.site && url.site.no_match) { return cb(null, opts.count_only ? [{ count: 0 }] : []); }
                if (q.id) { var r = recs[q.id['=']]; return cb(null, r ? [{ id: q.id['='], file: 'x.flac', site_id: r }] : []); }
                if (q.site) { var hit = Object.keys(recs).filter(function(k) { return recs[k] === q.site['=']; }); return cb(null, opts.count_only ? [{ count: hit.length }] : hit.map(function(k) { return { id: +k }; })); }
                return cb(null, opts.count_only ? [{ count: 99 }] : [{ id: 'project-wide' }]);
            });
        },
        getPrevAndNextRecordingsAsync: function(id) { return Promise.resolve(recs[id] ? [{ id: +id }] : []); },
        findByRecordingId: function(id, cb) { cb(null, recs[id] ? { uri: 'u' } : null); },
        fetchInfo: function(r, cb) { cb(null, r); },
        fetchOneSpectrogramTile: function(r, i, j, cb) { cb(new Error('tile-render-reached')); },
        exists: function(q, cb) { cb(null, true); },
        fetchValidations: function(r, cb) { cb(null, []); },
        fetchAedValidations: function() { return Promise.resolve(null); },
        fetchSpectrogramTiles: function(r, cb) { cb(null, r); }
    },
    sites: {
        findById: function(id, cb) { cb(null, sites[id] !== undefined ? [{ id: +id, project_id: sites[id] }] : []); },
        getRecordingStats: function(site, o, cb) { cb(new Error('stats-reached-for-site-' + site.id)); },
        getUploadStats: function(site, o, cb) { cb(new Error('uploads-reached-for-site-' + site.id)); }
    }
};

function stub(rel, exp) {
    var p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
    return p;
}

describe('§391 behavioural matrix (real routers, fake model/DB)', function() {
    this.timeout(20000);
    var server, base, stubbed = [], reloaded = [];

    before(function(done) {
        stubbed.push(stub('app/model/index.js', fakeModel));
        stubbed.push(stub('app/utils/dbpool.js', fakeDbpool));
        ['app/utils/project-scope.js', 'app/routes/data-api/project/recordings.js', 'app/routes/data-api/project/sites.js'].forEach(function(r) {
            var p = require.resolve(path.join(ROOT, r)); delete require.cache[p]; reloaded.push(p);
        });
        var recordings = require(path.join(ROOT, 'app/routes/data-api/project/recordings.js'));
        var sitesR = require(path.join(ROOT, 'app/routes/data-api/project/sites.js'));
        var app = express();
        app.use('/project/:pid', function(req, res, next) {
            req.project = { project_id: Number(req.params.pid), url: 'p' + req.params.pid };
            req.session = { user: { id: 1 } };
            req.haveAccess = function() { return true; };
            next();
        });
        app.use('/project/:pid/recordings', recordings);
        app.use('/project/:pid/sites', sitesR);
        app.use(function(err, req, res, next) { res.status(500).json({ reached: String(err.message) }); });
        server = app.listen(0, '127.0.0.1', function() { base = 'http://127.0.0.1:' + server.address().port; done(); });
    });
    after(function(done) {
        stubbed.concat(reloaded).forEach(function(p) { delete require.cache[p]; });
        server.close(done);
    });

    function get(p) {
        return new Promise(function(resolve, reject) {
            http.get(base + p, function(res) {
                var b = ''; res.on('data', function(c) { b += c; }); res.on('end', function() { resolve({ status: res.statusCode, body: b }); });
            }).on('error', reject);
        });
    }

    it('info: own 200, imported 200, FOREIGN 404, missing 404 — foreign body === missing body', async function() {
        var own = await get('/project/10/recordings/find/1000');
        var imp = await get('/project/10/recordings/find/2000');
        var foreign = await get('/project/10/recordings/find/3000');
        var missing = await get('/project/10/recordings/find/9999');
        expect(own.status).to.equal(200);
        expect(imp.status).to.equal(200);
        expect(foreign.status).to.equal(404);
        expect(missing.status).to.equal(404);
        expect(foreign.body).to.equal(missing.body);
        // CONTROL: the foreign recording is served under ITS OWN project
        expect((await get('/project/30/recordings/find/3000')).status).to.equal(200);
    });

    it('audio-style ids with an extension and a trailing slash are scoped too', async function() {
        expect((await get('/project/10/recordings/find/3000.flac')).status).to.equal(404);
        expect((await get('/project/10/recordings/find/3000%2F')).status).to.equal(404);
        expect((await get('/project/10/recordings/find/1000.flac')).status).to.equal(200);
    });

    it('site selector !q:<site>: foreign list is empty and count is 0, own is not', async function() {
        var fl = await get('/project/10/recordings/!q:300');
        var ol = await get('/project/10/recordings/!q:100');
        var fc = await get('/project/10/recordings/count/!q:300');
        var oc = await get('/project/10/recordings/count/!q:100');
        expect(fl.status).to.equal(200); expect(JSON.parse(fl.body)).to.deep.equal([]);
        expect(JSON.parse(ol.body).length).to.equal(1);
        expect(JSON.parse(fc.body)).to.deep.equal([{ count: 0 }]);
        expect(JSON.parse(oc.body)).to.deep.equal([{ count: 1 }]);
        // project-wide list is untouched (model union)
        expect(JSON.parse((await get('/project/10/recordings/')).body)).to.deep.equal([{ id: 'project-wide' }]);
    });

    it('?recording_id= neighbours: foreign 404, own 200', async function() {
        expect((await get('/project/10/recordings/?recording_id=3000')).status).to.equal(404);
        expect((await get('/project/10/recordings/?recording_id=1000')).status).to.equal(200);
    });

    it('tiles: foreign 404 BEFORE any render; own reaches the renderer', async function() {
        var f = await get('/project/10/recordings/tiles/3000/0/0/x');
        var o = await get('/project/10/recordings/tiles/1000/0/0/x');
        expect(f.status).to.equal(404);
        expect(o.body).to.contain('tile-render-reached');
    });

    it('exists/site: foreign site → {exists:false}', async function() {
        expect(JSON.parse((await get('/project/10/recordings/exists/site/300/file/a.wav')).body)).to.deep.equal({ exists: false });
        expect(JSON.parse((await get('/project/10/recordings/exists/site/100/file/a.wav')).body)).to.deep.equal({ exists: true });
    });

    it('sites/<id>/data.txt + uploads.txt: foreign/missing 404 (same body), own + imported reach the stats', async function() {
        var f = await get('/project/10/sites/300/data.txt');
        var m = await get('/project/10/sites/9999/data.txt');
        var fu = await get('/project/10/sites/300/uploads.txt');
        expect(f.status).to.equal(404); expect(m.status).to.equal(404); expect(fu.status).to.equal(404);
        expect(f.body).to.equal(m.body);
        expect((await get('/project/10/sites/100/data.txt')).body).to.contain('stats-reached-for-site-100');
        expect((await get('/project/10/sites/200/uploads.txt')).body).to.contain('uploads-reached-for-site-200');
    });

    it('malformed ids never reach the DB and 404', async function() {
        var before = queries.length;
        expect((await get('/project/10/sites/1%20OR%201%3D1/data.txt')).status).to.equal(404);
        expect((await get('/project/10/recordings/tiles/abc/0/0/x')).status).to.equal(404);
        expect(queries.length).to.equal(before);
    });
});