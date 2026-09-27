/* eslint-env mocha */
/**
 * Project rename / visibility: the CORE leg must actually happen, must not be silently swallowed, and must be
 * undone when the legacy transaction fails after it.
 *
 * rfcx-local DESIGN-2026-09-26-rename-core-leg (+ OWED-2026-09-13 §1). Measured 2026-09-26: 3 of 3 renames in
 * 7 d reached core as PATCH 401 (session-less SPA call passed req.session.idToken = undefined; the model
 * swallowed the 401), 202 live projects carry a stale core name.
 * Negative control: T1/T2/T3/T5/T6 were run against unmodified master and went RED before this landed.
 */
var expect = require('chai').expect;
var path = require('path');
var Module = require('module');
var fs = require('fs');

var MODEL = path.join(__dirname, '..', 'app', 'model', 'projects.js');
var ROUTE = path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'index.js');

function harness (opts) {
    var h = { calls: [], committed: 0, rolledBack: 0, errs: [] };
    var dbpool = {
        escape: function (v) { return JSON.stringify(v); },
        escapeId: function (v) { return v; },
        query: async function (sql) {
            if (/SELECT external_id FROM projects/.test(sql)) return [{ external_id: 'core9' }];
            return [];
        },
        getConnection: async function () {
            return {
                beginTransaction: async function () {},
                commit: async function () { if (opts.commitThrows) throw new Error('commit boom'); h.committed++; },
                rollback: async function () { h.rolledBack++; },
                release: async function () {},
                query: function (q, v, cb) { (cb || v)(null, []); },
                promisedQuery: async function () { return []; }
            };
        }
    };
    var patchN = 0;
    var rp = async function (o) {
        h.calls.push({ method: o.method, url: o.url, timeout: o.timeout, auth: o.headers && o.headers.Authorization,
            body: typeof o.body === 'string' ? JSON.parse(o.body) : undefined });
        if (o.method === 'GET') {
            if (opts.preImageFails) return { statusCode: 401, body: {} };
            return { statusCode: 200, body: { id: 'core9', name: 'Old Name', is_public: false } };
        }
        patchN++;
        if (patchN === 1) {
            if (opts.patchTimesOut) { var e = new Error('ETIMEDOUT'); e.code = 'ETIMEDOUT'; throw e; }
            if (opts.patchStatus) return { statusCode: opts.patchStatus, body: '{}' };
            return { statusCode: 200, body: '{}' };
        }
        if (opts.compensationFails) return { statusCode: 500, body: '{}' };
        return { statusCode: 200, body: '{}' };
    };
    var util = require('util');
    var stubs = {
        '../config': function (k) { return k === 'rfcx' ? { coreAPIEnabled: true } : {}; },
        '../utils/dbpool': dbpool,
        '../utils/core-api-url': { coreApiBaseUrl: function () { return 'http://core'; } }
    };
    var origLoad = Module._load, origP = util.promisify;
    Module._load = function (request) {
        if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
        return origLoad.apply(this, arguments);
    };
    util.promisify = function (fn) { return fn === require('request') ? rp : origP(fn); };
    try {
        delete require.cache[require.resolve(MODEL)];
        h.projects = require(MODEL);
    } finally { Module._load = origLoad; util.promisify = origP; }
    // isolate the legacy UPDATE (its SQL shape is covered elsewhere)
    h.projects.update = function (d, c, cb) { if (typeof cb === 'function') cb(null); return Promise.resolve(); };
    var origErr = console.error, origLog = console.log;
    console.error = function (m) { h.errs.push(String(m)); };
    console.log = function () {};
    h.restore = function () { console.error = origErr; console.log = origLog; };
    return h;
}

async function run (opts, data) {
    var h = harness(opts);
    try { await h.projects.updateProjectInArbimonAndCoreAPI(data || { project_id: 42, name: 'New Name' }, 'jwt123'); }
    catch (e) { h.threw = e; }
    h.restore();
    h.patches = h.calls.filter(function (c) { return c.method === 'PATCH'; });
    return h;
}

describe('project rename: core leg (2026-09-26)', function () {
    it('T0 happy path: pre-image GET, one bounded PATCH with a real bearer, commit', async function () {
        var h = await run({});
        expect(h.threw).to.equal(undefined);
        expect(h.committed).to.equal(1);
        expect(h.patches).to.have.length(1);
        expect(h.patches[0].auth).to.equal('Bearer jwt123');
        expect(h.patches[0].timeout).to.be.a('number').and.at.most(10000);
    });
    it('T1 core answers 401: the rename FAILS (no silent success) and legacy is rolled back', async function () {
        var h = await run({ patchStatus: 401 });
        expect(h.threw, 'a non-2xx from core must fail the rename').to.be.instanceOf(Error);
        expect(h.committed).to.equal(0);
        expect(h.rolledBack).to.equal(1);
        expect(h.patches, 'clean rejection: nothing to compensate').to.have.length(1);
    });
    it('T2 commit fails after core committed: core restored to its pre-image', async function () {
        var h = await run({ commitThrows: true });
        expect(h.threw).to.be.instanceOf(Error);
        expect(h.patches).to.have.length(2);
        expect(h.patches[1].body).to.deep.equal({ name: 'Old Name' });
    });
    it('T3 core PATCH times out: treated as possibly committed, compensation attempted', async function () {
        var h = await run({ patchTimesOut: true });
        expect(h.threw).to.be.instanceOf(Error);
        expect(h.patches).to.have.length(2);
        expect(h.patches[1].body.name).to.equal('Old Name');
    });
    it('T4 visibility change is compensated with the original visibility', async function () {
        var h = await run({ commitThrows: true }, { project_id: 42, is_private: 0 });
        expect(h.patches).to.have.length(2);
        expect(h.patches[1].body).to.deep.equal({ is_public: false });
    });
    it('T5 core pre-image unreadable: abort before any core write', async function () {
        var h = await run({ preImageFails: true });
        expect(h.threw).to.be.instanceOf(Error);
        expect(h.patches).to.have.length(0);
        expect(h.rolledBack).to.equal(1);
    });
    it('T6 compensation fails: greppable log line, original error still thrown', async function () {
        var h = await run({ commitThrows: true, compensationFails: true });
        expect(h.threw).to.be.instanceOf(Error);
        var line = h.errs.filter(function (m) { return m.indexOf('project_update_core_compensation_failed') !== -1; });
        expect(line).to.have.length(1);
        expect(JSON.parse(line[0]).project_id).to.equal(42);
    });
});

describe('POST info/update passes a usable token for session-less (SPA) callers (2026-09-26)', function () {
    var code = fs.readFileSync(ROUTE, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    var start = code.indexOf("'/:projectUrl/info/update'");
    var body = code.slice(start, code.indexOf('router.', start + 10));
    it('R1 does not pass the bare session token straight into the model', function () {
        expect(body).to.not.match(/updateProjectInArbimonAndCoreAPI\(newProjectInfo,\s*req\.session\.idToken\)/);
    });
    it('R2 falls back to the bearer from the Authorization header, stripping the "Bearer " prefix', function () {
        expect(body).to.match(/req\.headers\.authorization/);
        expect(body).to.match(/split\(' '\)\[1\]/);
    });
});