var expect = require('chai').expect;
var path = require('path');

/**
 * REGRESSION GUARD — OPEN-ITEMS §300 item 2:
 * "every analysis-job create reports 'Could not create … job' while the job runs".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * Measured four times across three routes in the 2026-09-11/12 traffic exercise:
 *
 *   POST …/soundscape/single-batch  → 200 {"err":"Could not create soundscape job"}
 *                                     …job 169872 created, ran, `completed`
 *   POST …/models/new               → 200 {"err":"Could not create training job"}
 *                                     …job 169894 `completed`
 *   POST …/classifications/new      → 200 {"err":"Could not create classification job"}
 *                                     …job 169895 `completed`
 *
 * The `jobs` INSERT (state='waiting') IS the enqueue — the in-cluster
 * jobqueue-dispatcher claims it. The k8s Job POST that followed is the upstream
 * AWS-EKS execution path, dead by construction in rfcx-local (K8S_NAMESPACE
 * `arbimon-jobs-production` does not exist; the pod SA gets 403 on jobs.batch;
 * the image paths are ECR). Its failure was answered as a create failure.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THESE TESTS ARE A REAL NEGATIVE CONTROL
 * ─────────────────────────────────────────────────────────────────────────────
 * Group 1 exercises the shipped helper directly (unit).
 * Group 2 is the one that would have caught the production defect: it stubs
 * `k8sClient…jobs.post` to REJECT and asserts each of the three model functions
 * still resolves — i.e. the route can answer `ok`. Against the pre-fix tree
 * these fail, because the pre-fix functions propagate the rejection
 * (`return await k8sClient…jobs.post(...)` inside the `.then`, `.nodeify(cb)`),
 * which is exactly what drove the `{err: 'Could not create … job'}` response.
 * Group 3 pins the disabled-flag path: `jobs.post` must NEVER be called.
 * Group 4 is a SOURCE guard: the three routes must not answer `err` on the
 * job-leg callback path (source-level, so it survives a refactor that keeps the
 * behaviour but moves it).
 */

var HELPER = path.resolve(__dirname, '../app/utils/k8s-job-leg.js');

// ─────────────────────────────────────────────────────────────────────────────
// HARNESS SHIM, and why it is here (not a workaround for this change).
//
// `app/model/models.js` transitively requires jsonwebtoken → jwa →
// buffer-equal-constant-time, which reads `require('buffer').SlowBuffer`.
// SlowBuffer was REMOVED in modern Node; on node 26 that module throws
// `Cannot read properties of undefined (reading 'prototype')` at load.
//
// This is PRE-EXISTING and unrelated to §300.2: verified by stashing this
// change and running `node -e "require('./app/model/models.js')"` on clean
// origin/master @ 85add9d4 — identical throw. Production runs the node-16
// image, where SlowBuffer exists, so the app is unaffected.
//
// Restoring the alias lets the models.js assertions actually run instead of
// being silently skipped — a skipped negative control is not a control.
if (typeof require('buffer').SlowBuffer === 'undefined') {
    require('buffer').SlowBuffer = require('buffer').Buffer;
}

function freshHelper(env) {
    delete require.cache[require.resolve(HELPER)];
    var prev = process.env.ANALYSIS_DISPATCH;
    if (env === undefined) { delete process.env.ANALYSIS_DISPATCH; }
    else { process.env.ANALYSIS_DISPATCH = env; }
    var mod = require(HELPER);
    mod._restoreEnv = function () {
        if (prev === undefined) { delete process.env.ANALYSIS_DISPATCH; }
        else { process.env.ANALYSIS_DISPATCH = prev; }
    };
    return mod;
}

describe('§300.2 k8s-job-leg helper', function () {

    it('is DISABLED when the in-cluster dispatcher owns dispatch', function () {
        var h = freshHelper('jobqueue');
        expect(h.jobLegEnabled()).to.equal(false);
        h._restoreEnv();
    });

    it('is ENABLED by default (the upstream AWS-EKS deployment is preserved)', function () {
        var h = freshHelper(undefined);
        // config/lambdas.json ships no `dispatch` key upstream.
        expect(h.jobLegEnabled()).to.equal(true);
        h._restoreEnv();
    });

    it('when DISABLED it never calls post(), and reports no warning', function () {
        var h = freshHelper('jobqueue');
        var called = 0;
        return h.dispatchJobLeg({
            jobType: 'classification', jobId: 169895,
            post: function () { called++; return Promise.resolve(); }
        }).then(function (r) {
            expect(called).to.equal(0);
            expect(r.dispatched).to.equal(false);
            expect(r.warning).to.equal(null);
            h._restoreEnv();
        });
    });

    it('when ENABLED and post() REJECTS it RESOLVES with a warning (never rejects)', function () {
        var h = freshHelper(undefined);
        return h.dispatchJobLeg({
            jobType: 'training', jobId: 169894,
            post: function () { return Promise.reject(new Error('403 jobs.batch is forbidden')); }
        }).then(function (r) {
            expect(r.dispatched).to.equal(false);
            expect(r.warning).to.equal('scheduler leg failed');
            h._restoreEnv();
        }, function () {
            h._restoreEnv();
            throw new Error('dispatchJobLeg REJECTED — this is the §300.2 defect: a dead ' +
                            'scheduler leg must not fail the create');
        });
    });

    it('when ENABLED and post() resolves it reports dispatched, no warning', function () {
        var h = freshHelper(undefined);
        return h.dispatchJobLeg({
            jobType: 'soundscape', jobId: 169872,
            post: function () { return Promise.resolve({ statusCode: 201 }); }
        }).then(function (r) {
            expect(r.dispatched).to.equal(true);
            expect(r.warning).to.equal(null);
            h._restoreEnv();
        });
    });
});

/**
 * Group 2/3 — the model functions themselves, with the k8s client stubbed.
 * These are the tests that FAIL on the unfixed tree.
 */
describe('§300.2 model fns survive a dead k8s job leg', function () {
    var kc = require.resolve('kubernetes-client');
    var posted;
    var postImpl;
    var loaded = [];

    function loadModel(rel, env) {
        var abs = require.resolve(path.resolve(__dirname, rel));
        // Stub kubernetes-client BEFORE the model is loaded (it builds its
        // Client at module scope).
        require.cache[kc] = {
            id: kc, filename: kc, loaded: true, exports: {
                Client: function () {
                    return {
                        apis: { batch: { v1: {
                            namespaces: function () {
                                return { jobs: { post: function (body) {
                                    posted.push(body);
                                    return postImpl();
                                } } };
                            }
                        } } }
                    };
                }
            }
        };
        if (env === undefined) { delete process.env.ANALYSIS_DISPATCH; }
        else { process.env.ANALYSIS_DISPATCH = env; }
        delete require.cache[require.resolve(HELPER)];
        delete require.cache[abs];
        loaded.push(abs);
        return require(abs);
    }

    beforeEach(function () { posted = []; postImpl = function () { return Promise.resolve(); }; });

    afterEach(function () {
        delete require.cache[kc];
        loaded.forEach(function (a) { delete require.cache[a]; });
        loaded = [];
        delete require.cache[require.resolve(HELPER)];
        delete process.env.ANALYSIS_DISPATCH;
    });

    // ── the production shape: leg enabled, POST fails (403 / NotFound) ───────
    it('createClassificationJob resolves ok when jobs.post REJECTS', function () {
        postImpl = function () { return Promise.reject(new Error('namespaces "arbimon-jobs-production" not found')); };
        var m = loadModel('../app/model/classifications.js', undefined);
        return new Promise(function (resolve, reject) {
            m.createClassificationJob({ jobId: 169895 }, function (err, data) {
                if (err) {
                    return reject(new Error('§300.2 DEFECT: createClassificationJob called back ' +
                        'with an error after a dead job leg — the route answers ' +
                        '{err:"Could not create classification job"} for a job that RAN'));
                }
                expect(posted.length).to.equal(1);
                expect(data && data.warning).to.equal('scheduler leg failed');
                resolve();
            });
        });
    });

    it('createRFM resolves ok when jobs.post REJECTS', function () {
        postImpl = function () { return Promise.reject(new Error('jobs.batch is forbidden')); };
        var m = loadModel('../app/model/models.js', undefined);
        return new Promise(function (resolve, reject) {
            m.createRFM({ jobId: 169894, isRetrain: false }, function (err, data) {
                if (err) {
                    return reject(new Error('§300.2 DEFECT: createRFM called back with an error ' +
                        'after a dead job leg — the route answers {err:"Could not create training job"}'));
                }
                expect(posted.length).to.equal(1);
                expect(data && data.warning).to.equal('scheduler leg failed');
                resolve();
            });
        });
    });

    it('createSingleSoundscape resolves ok when jobs.post REJECTS', function () {
        postImpl = function () { return Promise.reject(new Error('jobs.batch is forbidden')); };
        var m = loadModel('../app/model/soundscapes.js', undefined);
        return new Promise(function (resolve, reject) {
            m.createSingleSoundscape(169872, function (err, data) {
                if (err) {
                    return reject(new Error('§300.2 DEFECT: createSingleSoundscape called back with ' +
                        'an error after a dead job leg — the waterfall aborts into ' +
                        '{err:"Could not create soundscape job"}'));
                }
                expect(posted.length).to.equal(1);
                expect(data && data.warning).to.equal('scheduler leg failed');
                resolve();
            });
        });
    });

    // ── the disabled-flag path: jobs.post must NEVER be called ──────────────
    it('ANALYSIS_DISPATCH=jobqueue: classification never calls jobs.post', function () {
        var m = loadModel('../app/model/classifications.js', 'jobqueue');
        return new Promise(function (resolve, reject) {
            m.createClassificationJob({ jobId: 1 }, function (err, data) {
                if (err) { return reject(err); }
                expect(posted.length).to.equal(0);
                expect(data.dispatched).to.equal(false);
                resolve();
            });
        });
    });

    it('ANALYSIS_DISPATCH=jobqueue: createRFM never calls jobs.post', function () {
        var m = loadModel('../app/model/models.js', 'jobqueue');
        return new Promise(function (resolve, reject) {
            m.createRFM({ jobId: 1, isRetrain: false }, function (err, data) {
                if (err) { return reject(err); }
                expect(posted.length).to.equal(0);
                expect(data.dispatched).to.equal(false);
                resolve();
            });
        });
    });

    it('ANALYSIS_DISPATCH=jobqueue: createSingleSoundscape never calls jobs.post', function () {
        var m = loadModel('../app/model/soundscapes.js', 'jobqueue');
        return new Promise(function (resolve, reject) {
            m.createSingleSoundscape(1, function (err, data) {
                if (err) { return reject(err); }
                expect(posted.length).to.equal(0);
                expect(data.dispatched).to.equal(false);
                resolve();
            });
        });
    });
});

/**
 * Group 4 — SOURCE guards. Behavioural tests above prove the models; these pin
 * the ROUTE shape, which has no cheap unit harness (express + async.waterfall +
 * a live dbpool). They are deliberately narrow: each asserts that the job-leg
 * callback no longer answers `err`.
 */
describe('§300.2 route sources no longer answer err on the job-leg callback', function () {
    var fs = require('fs');

    function src(rel) {
        return fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
    }

    it('classifications/new: createClassificationJob callback answers ok, not err', function () {
        var s = src('../app/routes/data-api/project/classifications.js');
        var i = s.indexOf('createClassificationJob({');
        expect(i).to.be.greaterThan(-1);
        var tail = s.slice(i);
        expect(tail).to.not.match(/if\s*\(err\)\s*\{?\s*return res\.json\(\{\s*err:/,
            '§300.2 DEFECT: the k8s-leg callback still answers {err:"Could not create classification job"}');
    });

    it('models/new: createRFM callback answers ok, not err', function () {
        var s = src('../app/routes/data-api/project/models.js'); // §394: moved
        var i = s.indexOf('createRFM({');
        expect(i).to.be.greaterThan(-1);
        var tail = s.slice(i, i + 900);
        expect(tail).to.not.match(/if\s*\(err\)\s*return res\.json\(\{\s*err:/,
            '§300.2 DEFECT: the k8s-leg callback still answers {err:"Could not create training job"}');
    });

    it('soundscape/single-batch: the leg no longer aborts the waterfall via next(err)', function () {
        var s = src('../app/routes/data-api/project/index.js'); // §394: moved
        var i = s.indexOf('createSingleSoundscape(job_id');
        expect(i).to.be.greaterThan(-1);
        var tail = s.slice(i, i + 700);
        expect(tail).to.not.match(/if\s*\(err\)\s*return next\(err\)/,
            '§300.2 DEFECT: a failed k8s leg still aborts into {err:"Could not create soundscape job"}');
    });
});