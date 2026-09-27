/* jshint node:true */
"use strict";
/**
 * analysis-assets-api client for the two legacy vector routes
 * (rfcx-local OPEN-ITEMS §295; design runbooks/DESIGN-2026-09-09-analysis-assets-api.md).
 *
 * P1 (this change): wired but OFF. Each route asks `enabled(<route>)`; with the
 * flags unset the routes take their EXISTING direct-S3 path byte-for-byte.
 * P2 flips one flag at a time:
 *
 *     ANALYSIS_ASSETS_CLASSIFICATION_VECTOR=on   -> /:classiId/vector/:recId
 *     ANALYSIS_ASSETS_TRAINING_VECTOR=on         -> /:modelId/training-vector/:recId
 *     ANALYSIS_ASSETS_URL (default http://analysis-assets-api.apps-prod.svc.cluster.local)
 *
 * Contract preserved: 200 {vector:[...]} ; 404 {err:'vector-not-found'} (the
 * Angular client branches on exactly that string). The service's extra
 * `reason` field is passed through on 404s — additive, the client ignores it.
 * Project gates stay in the route ABOVE this call (the service is
 * cluster-internal and unauthenticated by design).
 *
 * Rollback = unset the flag (no deploy of the service needed).
 */
const request = require('request');

const DEFAULT_URL = 'http://analysis-assets-api.apps-prod.svc.cluster.local';
const FLAGS = {
    classification: 'ANALYSIS_ASSETS_CLASSIFICATION_VECTOR',
    training: 'ANALYSIS_ASSETS_TRAINING_VECTOR',
};
const ON = ['on', '1', 'true', 'yes'];
// Cold derive of a ~2-min recording measured 10.7-17.3 s (2026-09-27); the
// service's own derive timeout is 120 s, so allow a little more on the wire.
const TIMEOUT_MS = 130000;

function enabled (route, env) {
    env = env || process.env;
    const v = String(env[FLAGS[route]] || '').trim().toLowerCase();
    return ON.indexOf(v) !== -1;
}

function baseUrl (env) {
    env = env || process.env;
    return (env.ANALYSIS_ASSETS_URL || DEFAULT_URL).replace(/\/+$/, '');
}

function classificationPath (classiId, recId) {
    return '/classifications/' + encodeURIComponent(classiId) + '/recordings/' + encodeURIComponent(recId) + '/vector';
}

function trainingPath (modelId, recId) {
    return '/models/' + encodeURIComponent(modelId) + '/training-vectors/' + encodeURIComponent(recId);
}

/**
 * Map a service response onto the legacy route's response.
 * Returns {status, body} for the route to send, or {error} for next(err).
 */
function mapResponse (err, statusCode, body) {
    if (err) {
        return { error: err };
    }
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { return { error: new Error('analysis-assets-api: non-JSON body (status ' + statusCode + ')') }; }
    }
    if (statusCode === 200 && body && Array.isArray(body.vector)) {
        return { status: 200, body: { vector: body.vector } };
    }
    if (statusCode === 404 && body && body.err === 'vector-not-found') {
        const out = { err: 'vector-not-found' };
        if (body.reason) { out.reason = body.reason; }
        return { status: 404, body: out };
    }
    return { error: new Error('analysis-assets-api: unexpected status ' + statusCode + ' ' + JSON.stringify(body).slice(0, 200)) };
}

function fetchVector (path, callback, deps) {
    deps = deps || {};
    const get = deps.get || request.get;
    get({ url: baseUrl(deps.env) + path, json: true, timeout: TIMEOUT_MS }, function (err, resp, body) {
        callback(mapResponse(err, resp && resp.statusCode, body));
    });
}

/** Send the mapped result on `res`, or pass an error to `next`. */
function respond (res, next) {
    return function (out) {
        if (out.error) { return next(out.error); }
        return res.status(out.status).json(out.body);
    };
}

module.exports = {
    enabled: enabled,
    baseUrl: baseUrl,
    classificationPath: classificationPath,
    trainingPath: trainingPath,
    mapResponse: mapResponse,
    fetchVector: fetchVector,
    respond: respond,
    FLAGS: FLAGS,
};