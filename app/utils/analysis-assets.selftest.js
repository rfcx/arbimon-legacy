/* jshint node:true */
"use strict";
/**
 * Self-test for app/utils/analysis-assets.js (the §295 vector proxy client).
 * Run:  node app/utils/analysis-assets.selftest.js
 *
 * Guards the two properties the P1 change must hold:
 *   1. the flags default OFF (unset/empty/'off' => the routes keep direct S3);
 *   2. the response mapping preserves the legacy contract, in particular the
 *      404 {err:'vector-not-found'} string the Angular client branches on.
 */
const assert = require('assert');
const A = require('./analysis-assets');

let n = 0;
function t (name, fn) { fn(); n++; console.log('ok - ' + name); }

t('flags default OFF', function () {
    assert.strictEqual(A.enabled('classification', {}), false);
    assert.strictEqual(A.enabled('training', {}), false);
    ['', 'off', '0', 'false', 'no', 'OFF', ' '].forEach(function (v) {
        assert.strictEqual(A.enabled('classification', { ANALYSIS_ASSETS_CLASSIFICATION_VECTOR: v }), false, v);
    });
});

t('flags turn on per route, independently', function () {
    const env = { ANALYSIS_ASSETS_CLASSIFICATION_VECTOR: 'on' };
    assert.strictEqual(A.enabled('classification', env), true);
    assert.strictEqual(A.enabled('training', env), false);
    ['on', 'ON', '1', 'true', 'yes'].forEach(function (v) {
        assert.strictEqual(A.enabled('training', { ANALYSIS_ASSETS_TRAINING_VECTOR: v }), true, v);
    });
});

t('paths match the service namespace', function () {
    assert.strictEqual(A.classificationPath(141257, 268330714), '/classifications/141257/recordings/268330714/vector');
    assert.strictEqual(A.trainingPath('3451', '9'), '/models/3451/training-vectors/9');
    assert.strictEqual(A.baseUrl({}), 'http://analysis-assets-api.apps-prod.svc.cluster.local');
    assert.strictEqual(A.baseUrl({ ANALYSIS_ASSETS_URL: 'http://x:8080/' }), 'http://x:8080');
});

t('200 passes the vector through (only the vector key)', function () {
    const out = A.mapResponse(null, 200, { vector: [0.1, 0.5], extra: 1 });
    assert.deepStrictEqual(out, { status: 200, body: { vector: [0.1, 0.5] } });
});

t('404 keeps the vector-not-found UI contract, reason is additive', function () {
    const out = A.mapResponse(null, 404, { err: 'vector-not-found', reason: 'model-retrained-after-job', detail: 'x' });
    assert.deepStrictEqual(out, { status: 404, body: { err: 'vector-not-found', reason: 'model-retrained-after-job' } });
    assert.deepStrictEqual(A.mapResponse(null, 404, '{"err":"vector-not-found"}'),
        { status: 404, body: { err: 'vector-not-found' } });
});

t('anything else is an error for next(), never a fake vector', function () {
    assert.ok(A.mapResponse(new Error('ECONNREFUSED'), undefined, undefined).error);
    assert.ok(A.mapResponse(null, 500, { err: 'internal' }).error);
    assert.ok(A.mapResponse(null, 504, { err: 'derive-timeout' }).error);
    assert.ok(A.mapResponse(null, 404, { err: 'no-such-route' }).error);
    assert.ok(A.mapResponse(null, 200, 'not json').error);
});

t('fetchVector calls the service URL and maps the result', function () {
    let seen;
    const deps = {
        env: { ANALYSIS_ASSETS_URL: 'http://svc' },
        get: function (opts, cb) { seen = opts; cb(null, { statusCode: 200 }, { vector: [1] }); },
    };
    let got;
    A.fetchVector('/models/1/training-vectors/2', function (out) { got = out; }, deps);
    assert.strictEqual(seen.url, 'http://svc/models/1/training-vectors/2');
    assert.strictEqual(seen.json, true);
    assert.ok(seen.timeout >= 120000);
    assert.deepStrictEqual(got, { status: 200, body: { vector: [1] } });
});

t('respond() sends mapped result or calls next(err)', function () {
    const sent = {};
    const res = { status: function (s) { sent.s = s; return this; }, json: function (b) { sent.b = b; } };
    A.respond(res, function () { throw new Error('no'); })({ status: 404, body: { err: 'vector-not-found' } });
    assert.deepStrictEqual(sent, { s: 404, b: { err: 'vector-not-found' } });
    let passed;
    A.respond(res, function (e) { passed = e; })({ error: new Error('boom') });
    assert.strictEqual(passed.message, 'boom');
});

console.log('analysis-assets selftest: ' + n + ' passed');