/* eslint-env mocha */
/**
 * Site edit must not leave core changed when the legacy transaction fails.
 *
 * rfcx-local DESIGN-2026-09-26-site-edit-core-compensation; card 20260926-arbimon-app-004.
 * `updateSite` PATCHes core INSIDE an open legacy transaction; the PATCH commits immediately. Any
 * later failure used to roll back legacy only. Measured: 155 live core streams in a different project
 * from their legacy site (2021-2026).
 *
 * Behavioural: drives the SHIPPED `updateSite` with `request`, dbpool and ./projects stubbed.
 * Negative-control tested: T1 and T2 were run against unmodified master and went RED before this landed.
 */
var expect = require('chai').expect;
var path = require('path');
var Module = require('module');

var SITES = path.join(__dirname, '..', 'app', 'model', 'sites.js');

function loadSites (h) {
    var stubs = {
        'aws-sdk': { S3: function () {} },
        'request': function () {},
        'tz-lookup': function () { return 'UTC'; },
        'jsonwebtoken': {},
        '../config': function (k) { return k === 'rfcx' ? { coreAPIEnabled: true } : {}; },
        '../utils/dbpool': h.dbpool,
        './site-rec-count': {},
        './playlist-rec-count': {},
        '../utils/core-api-url': { coreApiBaseUrl: function () { return 'http://core'; } },
        './projects': h.projects
    };
    var origLoad = Module._load;
    var util = require('util');
    var origPromisify = util.promisify;
    Module._load = function (request) {
        if (Object.prototype.hasOwnProperty.call(stubs, request)) { return stubs[request]; }
        return origLoad.apply(this, arguments);
    };
    // `var rp = util.promisify(request)` is evaluated at module load: hand it the harness's rp.
    util.promisify = function (fn) { return fn === stubs.request ? h.rp : origPromisify(fn); };
    try {
        delete require.cache[require.resolve(SITES)];
        return require(SITES);
    } finally {
        Module._load = origLoad;
        util.promisify = origPromisify;
    }
}

function harness (opts) {
    var h = { calls: [], log: { committed: 0, rolledBack: 0 }, errs: [] };
    h.dbpool = {
        escape: function (v) { return JSON.stringify(v); },
        escapeId: function (v) { return v; },
        query: async function (sql) {
            if (/SELECT external_id FROM sites/.test(sql)) return [{ external_id: 'core123' }];
            return [];
        },
        getConnection: async function () {
            return {
                beginTransaction: async function () {},
                commit: async function () { if (opts.commitThrows) throw new Error('commit boom'); h.log.committed++; },
                rollback: async function () { h.log.rolledBack++; },
                release: async function () {},
                query: function (q, cb) { cb(null, { affectedRows: 1 }); },
                promisedQuery: async function () {
                    if (opts.timezoneThrows) throw new Error('timezone write-back boom');
                    return [];
                }
            };
        }
    };
    h.projects = {
        getProjectValidationsBySite: async function () { return []; },
        checkClassAsync: async function () { return [1]; },
        insertClassAsync: async function () {},
        updateProjectInAnalyses: async function () {}
    };
    var patchN = 0;
    h.rp = async function (o) {
        h.calls.push({ method: o.method, url: o.url, timeout: o.timeout, body: o.body ? JSON.parse(o.body) : undefined });
        if (o.method === 'GET') {
            if (opts.preImageFails) return { statusCode: 403, body: { message: 'no' } };
            return { statusCode: 200, body: { id: 'core123', name: 'Old', latitude: 1, longitude: 2, altitude: 3, project: { external_id: 111 } } };
        }
        patchN++;
        if (patchN === 1) {
            if (opts.patchTimesOut) { var e = new Error('ESOCKETTIMEDOUT'); e.code = 'ETIMEDOUT'; throw e; }
            if (opts.patchRejects) return { body: JSON.stringify({ message: 'bad', error: { status: 400 } }) };
            return { body: JSON.stringify({ id: 'core123', country_code: 'AU', timezone: 'Australia/Melbourne' }) };
        }
        if (opts.compensationFails) throw new Error('compensation boom');
        return { body: JSON.stringify({ id: 'core123' }) };
    };
    var origErr = console.error, origLog = console.log;
    console.error = function (m) { h.errs.push(String(m)); };
    console.log = function () {};
    h.restore = function () { console.error = origErr; console.log = origLog; };
    h.Sites = loadSites(h);
    return h;
}

var SITE = { site_id: 555, name: 'New', lat: 5, lon: 6, alt: 7, project_id: 222 };
var OPTS = { originalProjectId: 111, projectExternalId: 'abc' };

async function run (opts) {
    var h = harness(opts);
    var threw = null;
    try { await h.Sites.updateSite(Object.assign({}, SITE), OPTS, 'tok'); } catch (e) { threw = e; }
    h.restore();
    h.threw = threw;
    h.patches = h.calls.filter(function (c) { return c.method === 'PATCH'; });
    return h;
}

describe('site edit: core compensation (2026-09-26)', function () {
    it('T4 happy path: one GET, one PATCH (bounded), commit, no compensation', async function () {
        var h = await run({});
        expect(h.threw).to.equal(null);
        expect(h.log.committed).to.equal(1);
        expect(h.patches).to.have.length(1);
        expect(h.patches[0].timeout, 'core PATCH must be bounded').to.be.a('number').and.to.be.at.most(10000);
        expect(h.patches[0].body.project_external_id).to.equal(222);
    });

    it('T1 later failure (timezone write-back) after core committed: rolls back legacy AND restores core', async function () {
        var h = await run({ timezoneThrows: true });
        expect(h.threw).to.be.an('error');
        expect(h.log.rolledBack).to.equal(1);
        expect(h.patches, 'forward PATCH + compensation PATCH').to.have.length(2);
        var back = h.patches[1].body;
        expect(back.project_external_id, 'project restored to core pre-image').to.equal(111);
        expect(back.name).to.equal('Old');
        expect(back.latitude).to.equal(1);
        expect(back.longitude).to.equal(2);
        expect(back.altitude).to.equal(3);
    });

    it('T1b commit failure after core committed: restores core', async function () {
        var h = await run({ commitThrows: true });
        expect(h.threw).to.be.an('error');
        expect(h.patches).to.have.length(2);
        expect(h.patches[1].body.project_external_id).to.equal(111);
    });

    it('T2 ambiguous core failure (timeout): compensation still attempted', async function () {
        var h = await run({ patchTimesOut: true });
        expect(h.threw).to.be.an('error');
        expect(h.log.rolledBack).to.equal(1);
        expect(h.patches, 'timed-out PATCH may have committed → compensate').to.have.length(2);
        expect(h.patches[1].body.project_external_id).to.equal(111);
    });

    it('T3 clean core rejection: nothing committed in core, NO compensation', async function () {
        var h = await run({ patchRejects: true });
        expect(h.threw).to.be.an('error');
        expect(h.log.rolledBack).to.equal(1);
        expect(h.patches).to.have.length(1);
    });

    it('T5 compensation fails: structured log line, original error still thrown', async function () {
        var h = await run({ timezoneThrows: true, compensationFails: true });
        expect(h.threw).to.be.an('error');
        var line = h.errs.filter(function (m) { return m.indexOf('site_update_core_compensation_failed') !== -1; });
        expect(line, 'greppable failure line').to.have.length(1);
        expect(JSON.parse(line[0]).site_id).to.equal(555);
    });

    it('T6 cannot read core pre-image: abort BEFORE any core write (fail-safe)', async function () {
        var h = await run({ preImageFails: true });
        expect(h.threw).to.be.an('error');
        expect(h.patches, 'no PATCH may be sent without a pre-image').to.have.length(0);
        expect(h.log.rolledBack).to.equal(1);
    });

    it('T7 compensation only restores the fields that were sent', async function () {
        var h = harness({ timezoneThrows: true });
        try { await h.Sites.updateSite({ site_id: 555, name: 'OnlyName' }, OPTS, 'tok'); } catch (e) { /* expected */ }
        h.restore();
        var p = h.calls.filter(function (c) { return c.method === 'PATCH'; });
        expect(p).to.have.length(2);
        expect(p[1].body).to.deep.equal({ name: 'Old' });
    });
});
describe('site edit: core body still sees update() normalisation (2026-09-26 regression guard)', function () {
    it('T8 caller sends `id` + empty coordinates: PATCH carries site_id and nulls, as before the fix', async function () {
        var h = harness({});
        await h.Sites.updateSite({ id: 555, name: 'N', lat: '', lon: '' }, OPTS, 'tok');
        h.restore();
        var p = h.calls.filter(function (c) { return c.method === 'PATCH'; });
        expect(p).to.have.length(1);
        expect(p[0].url).to.match(/\/streams\/555$/);
        expect(p[0].body.latitude).to.equal(null);
        expect(p[0].body.longitude).to.equal(null);
    });
});
