/* eslint-env mocha */
/**
 * PATCH /integration/projects/:externalId accepts `is_private` (2026-09-27, rfcx-local
 * DESIGN-2026-09-27-visibility-propagation). bio-api propagates the SPA's publish/hide choice through this route so
 * legacy access follows it. Absent = unchanged (the route used to PIN is_private to its current value).
 * Behavioural: drives the shipped router with the model + auth middleware stubbed.
 * Negative control: V1/V2 RED on master (is_private was pinned).
 */
var expect = require('chai').expect;
var path = require('path');
var Module = require('module');
var ROUTE = path.join(__dirname, '..', 'app', 'routes', 'data-api', 'integration.js');

function load (state) {
    var model = {
        users: { ensureUserExistFromAuth0: async function () { return { user_id: 7 }; } },
        projects: {
            find: function () { return { get: function () { return Promise.resolve(state.project); } }; },
            userHasPermission: async function () { return state.allowed; },
            updateAsync: async function (p) { state.updated = p; }
        }
    };
    var stubs = {
        '../../model': model,
        '../../middleware/jwt': { verifyToken: function () { return function (q, r, n) { n(); }; }, hasRole: function () { return function (q, r, n) { n(); }; } },
        './integration-project-response': { formatCreatedProjectResponse: function () { return {}; } }
    };
    var orig = Module._load;
    Module._load = function (request) {
        if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
        return orig.apply(this, arguments);
    };
    try { delete require.cache[require.resolve(ROUTE)]; return require(ROUTE); } finally { Module._load = orig; }
}

function patch (router, body) {
    return new Promise(function (resolve) {
        var layer = router.stack.find(function (l) { return l.route && l.route.path === '/projects/:externalId' && l.route.methods.patch; });
        var handlers = layer.route.stack.map(function (s) { return s.handle; });
        var req = { params: { externalId: '9' }, body: body, user: {}, headers: {} };
        var res = { statusCode: 200, sendStatus: function (c) { this.statusCode = c; resolve(this); },
                    status: function (c) { this.statusCode = c; return this; }, json: function () { resolve(this); }, send: function () { resolve(this); } };
        var i = 0;
        (function next () { var h = handlers[i++]; if (h) h(req, res, next); })();
    });
}

describe('integration PATCH /projects/:externalId — is_private (2026-09-27)', function () {
    it('V1 is_private=true sets 1', async function () {
        var st = { project: { project_id: 42, name: 'N', url: 'u', is_private: 0 }, allowed: true };
        var r = await patch(load(st), { is_private: true });
        expect(r.statusCode).to.equal(200);
        expect(st.updated.is_private).to.equal(1);
    });
    it('V2 is_private=false sets 0', async function () {
        var st = { project: { project_id: 42, name: 'N', url: 'u', is_private: 1 }, allowed: true };
        await patch(load(st), { is_private: false });
        expect(st.updated.is_private).to.equal(0);
    });
    it('V3 absent is_private leaves it unchanged (name-only call from core keeps working)', async function () {
        var st = { project: { project_id: 42, name: 'N', url: 'u', is_private: 1 }, allowed: true };
        await patch(load(st), { name: 'New' });
        expect(st.updated.is_private).to.equal(1);
        expect(st.updated.name).to.equal('New');
    });
    it('V4 no permission: no write', async function () {
        var st = { project: { project_id: 42, name: 'N', url: 'u', is_private: 1 }, allowed: false };
        var r = await patch(load(st), { is_private: false });
        expect(st.updated).to.equal(undefined);
        expect(r.statusCode).to.not.equal(200);
    });
});