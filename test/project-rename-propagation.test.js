/* jshint node:true */
'use strict';

/**
 * REGRESSION GUARD — POST /:projectUrl/info/update must answer AFTER the transaction,
 * and must answer NON-2xx {success:false} when that transaction fails.
 *
 * Measured on live prod 2026-09-12 (rfcx-local OPEN-ITEMS §300 item 10,
 * runbooks/FINDING-2026-09-12-spa-rename-no-legacy-propagation.md):
 *
 *   - The route's last waterfall step called
 *     `model.projects.updateProjectInArbimonAndCoreAPI(...)` WITHOUT awaiting it and
 *     immediately answered `{success:true}`. That model call opens a transaction (the
 *     arbimon `projects` UPDATE + the core PATCH) whose catch ROLLS BACK and throws
 *     into nothing, because the response has already been sent.
 *   - So ANY failure of either leg left the legacy/PG plane unchanged behind a 200
 *     `{success:true}`. The SPA (biodiversity-api `project-profile-bll`) then wrote
 *     `insights.location_project` unconditionally, and the three planes diverged with
 *     no error anywhere user-visible: every legacy `/p/<new-slug>/*` panel 404'd
 *     while the SPA shell rendered fine.
 *   - Two real user cases: project 9806 (renamed 2026-08-26, broken 17 days) and
 *     9809 (renamed mid-flip 2026-09-12, arbimon leg failed 42501).
 *
 * These are BEHAVIOURAL guards: they drive the SHIPPED route handler (loaded out of
 * app/routes/data-api/project/index.js with the model stubbed through require.cache)
 * with a fake req/res, so a regression in the real file fails the test. The first two
 * assertions FAIL against the unfixed route, which answered 200 {success:true}
 * regardless of what the model did.
 */

var expect = require('chai').expect;
var path = require('path');
var Module = require('module');

var ROOT = path.join(__dirname, '..');

// ---- stub the model BEFORE the route module is required -------------------
// The route does `var model = require('../../../model')` at load time, so the stub
// has to be in require.cache first. The stub object is mutable: each test swaps
// `updateBehaviour` to choose the leg's outcome.
var modelPath = require.resolve(path.join(ROOT, 'app', 'model', 'index.js'));

var calls;
var updateBehaviour;

var modelStub = {
    projects: {
        updateProjectInArbimonAndCoreAPI: function(data, token) {
            calls.update.push({ data: data, token: token });
            return updateBehaviour();
        },
        findByName: function(name, cb) {
            calls.findByName.push(name);
            cb(null, calls.findByNameRows);
        },
        findByUrl: function(url, cb) {
            calls.findByUrl.push(url);
            cb(null, calls.findByUrlRows);
        }
    }
};

var stubModule = new Module(modelPath, null);
stubModule.filename = modelPath;
stubModule.loaded = true;
stubModule.exports = modelStub;
require.cache[modelPath] = stubModule;

var router = require(path.join(ROOT, 'app', 'routes', 'data-api', 'project', 'index.js'));

/** Pull the SHIPPED handler for this route out of the router stack. */
function infoUpdateHandler() {
    var layer = router.stack.filter(function(l) {
        return l.route && l.route.path === '/:projectUrl/info/update' && l.route.methods.post;
    })[0];
    if (!layer) { throw new Error('POST /:projectUrl/info/update not found on the router'); }
    return layer.route.stack[0].handle;
}

/** Minimal req/res doubles that record what the route answered. */
function drive(opts, done) {
    var answered = { status: 200, body: undefined, count: 0 };
    var req = {
        body: { project: opts.project },
        project: opts.currentProject,
        session: { idToken: 'test-id-token' },
        haveAccess: function() { return opts.haveAccess !== false; }
    };
    var res = {
        headersSent: false,
        type: function() { return res; },
        status: function(code) { answered.status = code; return res; },
        json: function(body) {
            answered.count++;
            answered.body = body;
            res.headersSent = true;
            // Let the route's promise chain settle before asserting.
            setImmediate(function() { done(answered); });
            return res;
        }
    };
    infoUpdateHandler()(req, res, function next(err) {
        answered.nextErr = err === undefined ? null : err;
        answered.count++;
        setImmediate(function() { done(answered); });
    });
    return answered;
}

describe('POST project/:projectUrl/info/update — rename must not report success on a failed write', function() {

    beforeEach(function() {
        calls = { update: [], findByName: [], findByUrl: [], findByNameRows: [], findByUrlRows: [] };
        updateBehaviour = function() { return Promise.resolve(); };
    });

    // ---- the defect ------------------------------------------------------
    // FAILS on the unfixed route: it answered 200 {success:true} because the model
    // call was never awaited.
    it('answers NON-2xx {success:false} when the arbimon/core transaction rejects', function(done) {
        updateBehaviour = function() {
            return Promise.reject(new Error('permission denied for table projects'));
        };

        drive({
            currentProject: { project_id: 9806, name: 'Granja das capelas', url: 'z1z58xephny8-granja-das-capelas' },
            project: { name: 'Turvo 2022', url: 'z1z58xephny8-turvo202021' }
        }, function(answered) {
            expect(answered.count).to.equal(1);                 // never answers twice
            expect(answered.status).to.be.at.least(400);        // an HONEST error status
            expect(answered.body).to.have.property('success', false);
            expect(answered.body).to.have.property('error');
            done();
        });
    });

    // FAILS on the unfixed route for the same reason.
    it('does not answer before the transaction settles', function(done) {
        var settle;
        updateBehaviour = function() {
            return new Promise(function(_resolve, reject) { settle = reject; });
        };

        var answered = drive({
            currentProject: { project_id: 9809, name: 'Anuros', url: 'anuros' },
            project: { name: 'Anuros na Granja', url: 'anuros-granja-das-capelas' }
        }, function(finalAnswer) {
            expect(finalAnswer.status).to.be.at.least(400);
            expect(finalAnswer.body).to.have.property('success', false);
            done();
        });

        // The model call has been made, but the transaction has NOT settled yet:
        // nothing may have been answered at this point.
        expect(calls.update).to.have.length(1);
        expect(answered.count).to.equal(0);
        settle(new Error('core PATCH rejected'));
    });

    // ---- the success path is unchanged -----------------------------------
    it('still answers {success:true, url} after a successful commit when the url changed', function(done) {
        drive({
            currentProject: { project_id: 1234, name: 'Old name', url: 'old-slug' },
            project: { name: 'New name', url: 'new-slug' }
        }, function(answered) {
            expect(answered.count).to.equal(1);
            expect(answered.status).to.equal(200);
            expect(answered.body).to.deep.equal({ success: true, url: 'new-slug' });
            expect(calls.update).to.have.length(1);
            expect(calls.update[0].token).to.equal('test-id-token');
            done();
        });
    });

    it('still answers {success:true, url:undefined} when the url did not change', function(done) {
        drive({
            currentProject: { project_id: 1234, name: 'Old name', url: 'same-slug' },
            project: { name: 'New name', url: 'same-slug' }
        }, function(answered) {
            expect(answered.status).to.equal(200);
            expect(answered.body).to.have.property('success', true);
            expect(answered.body.url).to.equal(undefined);
            done();
        });
    });

    // ---- the pre-existing early-return shape must be preserved -----------
    // verifyName/verifyUrl answer and deliberately never call `callback`, so the
    // waterfall stops there. The model must NOT be called, and there must be exactly
    // one response (a second would be ERR_HTTP_HEADERS_SENT).
    it('name collision: answers {success:false} once and never touches the model', function(done) {
        calls.findByNameRows = [{ project_id: 4321 }];

        drive({
            currentProject: { project_id: 1234, name: 'Old name', url: 'old-slug' },
            project: { name: 'Taken name', url: 'old-slug' }
        }, function(answered) {
            expect(answered.count).to.equal(1);
            expect(answered.body).to.have.property('success', false);
            expect(answered.body.error).to.match(/not available/);
            expect(calls.update).to.have.length(0);
            done();
        });
    });

    it('url collision: answers {success:false} once and never touches the model', function(done) {
        calls.findByUrlRows = [{ project_id: 4321 }];

        drive({
            currentProject: { project_id: 1234, name: 'Same name', url: 'old-slug' },
            project: { name: 'Same name', url: 'taken-slug' }
        }, function(answered) {
            expect(answered.count).to.equal(1);
            expect(answered.body).to.have.property('success', false);
            // The SPA keys its duplicate-slug message off this "URL ..." prefix.
            expect(answered.body.error).to.match(/^URL /);
            expect(calls.update).to.have.length(0);
            done();
        });
    });
});
