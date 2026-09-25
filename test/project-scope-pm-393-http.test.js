var expect = require('chai').expect;
var path = require('path');
var http = require('http');
var express = require('express');

/**
 * BEHAVIOURAL guard for §393 slice A: mount the REAL project/pattern_matchings.js
 * and citizen-scientist/pattern-matchings.js routers behind a stub of index.js's
 * projectUrl param (req.project = the URL project), with the model layer and the
 * DB pool replaced in require.cache, and drive real HTTP:
 *   own / own-DELETED / FOREIGN / missing / non-numeric for every :patternMatching
 *   route in both files (reads AND the two CS validate writes).
 *
 * For foreign ids the test asserts the fake model was NEVER called — a status
 * code alone cannot prove a read did not leak or a write did not happen — and
 * that the foreign body is byte-identical to the missing body (no oracle).
 *
 * Fixture: project 10 owns PM 50 (live) and 51 (DELETED); project 20 owns PM 60.
 */
var ROOT = path.join(__dirname, '..');
var pms = { 50: 10, 51: 10, 60: 20 };
var calls = [];

var fakeDbpool = {
    query: function(sql, params) {
        if (!/FROM pattern_matchings pm/.test(sql)) { return Promise.reject(new Error('unexpected sql ' + sql)); }
        var id = Number(params[0]), pid = Number(params[1]);
        return Promise.resolve(pms[id] === pid ? [{ owned: 1 }] : []);
    }
};

function rec(name) {
    return function() {
        var a = Array.prototype.slice.call(arguments);
        calls.push([name].concat(a.map(function(x) {
            if (x && typeof x === 'object' && x.params) { return 'req:' + x.params.patternMatching; }
            if (x && typeof x === 'object' && x.patternMatchingId !== undefined) { return 'opts:' + x.patternMatchingId; }
            return x;
        })));
        return Promise.resolve(name === 'findOne' ? { id: a[0] && a[0].id, name: 'pm' } : []);
    };
}
function stream() {
    var Readable = require('stream').Readable;
    var s = new Readable({ objectMode: true, read: function() { this.push(null); } });
    return [s, [{ name: 'id' }]];
}
var fakeModel = {
    patternMatchings: {
        findOne: rec('findOne'),
        getPmRois: rec('getPmRois'),
        getSitesForPM: rec('getSitesForPM'),
        getRoisForId: rec('getRoisForId'),
        getPmRecordingsForAudioUrls: rec('getPmRecordingsForAudioUrls'),
        exportRois: function(pm) { calls.push(['exportRois', pm]); return Promise.resolve(stream()); },
        exportDataFormatted: function() {},
        getRoiAudioFile: function(pm, roi) { calls.push(['getRoiAudioFile', pm, roi]); return Promise.resolve(undefined); }
    },
    CitizenScientist: {
        validateCSRois: function(pm, uid, rois, v) { calls.push(['validateCSRois', pm, rois]); return Promise.resolve(); },
        expertValidateCSRois: function(uid, pm, rois, v) { calls.push(['expertValidateCSRois', pm, rois]); return Promise.resolve(); }
    }
};

function stub(rel, exp) {
    var p = require.resolve(path.join(ROOT, rel));
    require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
    return p;
}

describe('§393 slice A: pattern-matching id routes are bound to the URL project (real routers)', function() {
    this.timeout(20000);
    var server, base, stubbed = [], reloaded = [];

    before(function(done) {
        stubbed.push(stub('app/model/index.js', fakeModel));
        stubbed.push(stub('app/utils/dbpool.js', fakeDbpool));
        ['app/utils/project-scope.js',
         'app/routes/data-api/project/pattern_matchings.js',
         'app/routes/data-api/project/citizen-scientist/pattern-matchings.js'].forEach(function(r) {
            var p = require.resolve(path.join(ROOT, r)); delete require.cache[p]; reloaded.push(p);
        });
        var pmRouter = require(path.join(ROOT, 'app/routes/data-api/project/pattern_matchings.js'));
        var csRouter = require(path.join(ROOT, 'app/routes/data-api/project/citizen-scientist/pattern-matchings.js'));
        var app = express();
        app.use(express.json());
        app.use('/project/:pid', function(req, res, next) {
            req.project = { project_id: Number(req.params.pid), url: 'p' + req.params.pid, citizen_scientist_enabled: 1 };
            req.session = { user: { id: 1, isSuper: 0, permissions: {} } };
            req.haveAccess = function() { return true; };
            next();
        });
        app.use('/project/:pid/pattern-matchings', pmRouter);
        app.use('/project/:pid/citizen-scientist/pattern-matchings', csRouter);
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
    function touched(pm) {
        return calls.filter(function(c) {
            return c.slice(1).some(function(x) {
                return String(x) === String(pm) || x === 'req:' + pm || x === 'opts:' + pm ||
                    (x && typeof x === 'object' && x.id !== undefined && String(x.id) === String(pm));
            });
        });
    }

    var PM_READS = ['/details', '/rois/0_10', '/site-index', '/rois.csv?out=text', '/audio/7.mp3'];
    var CS_READS = ['/details', '/expert/details', '/rois/0_10', '/expert-rois/0_10', '/export.csv?out=text', '/export-per-user.csv?out=text'];
    var CS_WRITES = ['/validate', '/expert-validate'];

    function matrix(prefix, suffixes, method) {
        suffixes.forEach(function(s) {
            it(method + ' ' + prefix + '/:pm' + s + ' — own reaches the model; own-DELETED unchanged; FOREIGN 404 === missing 404, model never called', async function() {
                var body = method === 'POST' ? { rois: [1, 2], validation: 1 } : undefined;
                var own = await req(method, '/project/10' + prefix + '/50' + s, body);
                expect(touched(50).length, 'own reached the model').to.be.above(0);
                if (s.indexOf('/audio/') < 0) { expect(own.status, 'own').to.not.equal(404); }
                calls.length = 0;
                await req(method, '/project/10' + prefix + '/51' + s, body);
                expect(touched(51).length, 'own DELETED still reaches the model (unchanged)').to.be.above(0);
                calls.length = 0;
                var foreign = await req(method, '/project/10' + prefix + '/60' + s, body);
                var missing = await req(method, '/project/10' + prefix + '/9999' + s, body);
                var junk = await req(method, '/project/10' + prefix + '/_' + s, body);
                expect(foreign.status, 'foreign').to.equal(404);
                expect(missing.status, 'missing').to.equal(404);
                expect(junk.status, 'non-numeric').to.equal(404);
                expect(foreign.body, 'no existence oracle').to.equal(missing.body);
                expect(calls, 'foreign/missing never reach the model').to.deep.equal([]);
                // and the foreign PM IS reachable from its own project
                await req(method, '/project/20' + prefix + '/60' + s, body);
                expect(touched(60).length, 'the PM is reachable from its OWN project').to.be.above(0);
            });
        });
    }
    matrix('/pattern-matchings', PM_READS, 'GET');
    matrix('/citizen-scientist/pattern-matchings', CS_READS, 'GET');
    matrix('/citizen-scientist/pattern-matchings', CS_WRITES, 'POST');
});

/**
 * validateCSRois: a bound PM must not be a CARRIER for another PM's rois. The
 * INSERT now selects the rois FROM the PM, so an id outside it inserts nothing.
 * Asserted on the SQL the model actually sends.
 */
describe('§393 slice A: validateCSRois constrains body roi ids to the PM', function() {
    var sent = [], stubbed = [], CS;
    before(function() {
        stubbed.push(stub('app/utils/dbpool.js', {
            query: function(sql, params) {
                sent.push({ sql: sql, params: params });
                if (/SELECT P\.project_id, P\.species_id/.test(sql)) {
                    var r = Promise.resolve([{ project_id: 10, species_id: 1, songtype_id: 1 }]);
                    r.get = function(i) { return r.then(function(x) { return x[i]; }); };
                    return r;
                }
                return Promise.resolve([]);
            }
        }));
        stubbed.push(stub('app/model/pattern_matchings.js', {}));
        var p = require.resolve(path.join(ROOT, 'app/model/citizen-scientist.js')); delete require.cache[p]; stubbed.push(p);
        CS = require(p);
        CS.computeUserStatsForProjectSpeciesSongtype = function() { return Promise.resolve(); };
    });
    after(function() { stubbed.forEach(function(p) { delete require.cache[p]; }); });

    it('INSERT is SELECT … FROM pattern_matching_rois WHERE pattern_matching_id = <pm> AND roi IN (<body>)', async function() {
        sent.length = 0;
        await CS.validateCSRois(50, 7, [111, 222], 1);
        var ins = sent.filter(function(s) { return /INSERT INTO pattern_matching_validations/.test(s.sql); });
        expect(ins).to.have.length(1);
        expect(ins[0].sql).to.match(/SELECT PMR\.pattern_matching_roi_id, \?, \?, NOW\(\)\s+FROM pattern_matching_rois PMR\s+WHERE PMR\.pattern_matching_id = \?\s+AND PMR\.pattern_matching_roi_id IN \(\?\)/);
        expect(ins[0].sql).to.not.match(/VALUES/);
        expect(ins[0].params).to.deep.equal([7, 1, 50, [111, 222]]);
    });
    it('a single (non-array) roi id and empty/blank ids are handled; nothing to insert → no INSERT', async function() {
        sent.length = 0;
        await CS.validateCSRois(50, 7, 111, 0);
        var ins = sent.filter(function(s) { return /INSERT INTO/.test(s.sql); });
        expect(ins[0].params).to.deep.equal([7, 0, 50, [111]]);
        sent.length = 0;
        await CS.validateCSRois(50, 7, [], 1);
        expect(sent.filter(function(s) { return /INSERT INTO/.test(s.sql); })).to.have.length(0);
    });
});