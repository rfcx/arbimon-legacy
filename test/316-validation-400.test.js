/* jshint node:true */
'use strict';

// §316 — joi validation failures must be answered 400 with a field-level message,
// not 500 "Server error".
//
// Run: node test/316-validation-400.test.js
//
// NEGATIVE CONTROL (§IRR / the "red before green" rule): this suite is required to
// FAIL on the pre-fix tree. It does not re-implement the fix — it drives the REAL
// error-handler chain extracted from the shipped app/index.js, and asserts on the
// shipped wiring. A test that re-implements the behaviour it checks passes against
// broken code (measured: rfcx-local card 20260914-ci-cd-repo-003).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const express = require(path.join(root, 'node_modules/express'));
const joi = require(path.join(root, 'node_modules/joi'));
const APIError = require(path.join(root, 'app/utils/apierror.js'));

let pass = 0;
let fail = 0;
function eq (label, actual, expected) {
    try {
        assert.deepStrictEqual(actual, expected);
        console.log('  ok   ' + label);
        pass++;
    } catch (e) {
        console.log('  FAIL ' + label + '  (got ' + JSON.stringify(actual) +
                    ', want ' + JSON.stringify(expected) + ')');
        fail++;
    }
}

// ---------------------------------------------------------------- wiring
// Assert on the SHIPPED source: the normaliser must exist AND be registered
// before the renderer. (On the pre-fix tree both of these fail.)
console.log('W  wiring: the normaliser exists and is mounted ahead of the renderer');
const indexSrc = fs.readFileSync(path.join(root, 'app/index.js'), 'utf8');
eq('app/utils/joi-http-error.js exists',
   fs.existsSync(path.join(root, 'app/utils/joi-http-error.js')), true);
eq('app/index.js requires it', /require\('\.\/utils\/joi-http-error'\)/.test(indexSrc), true);
eq('it is mounted with app.use', /app\.use\(joiHttpError\)/.test(indexSrc), true);
const posNormaliser = indexSrc.indexOf('app.use(joiHttpError)');
const posRenderer = indexSrc.indexOf('app.use(function(err, req, res, next)');
eq('the normaliser is mounted BEFORE the renderer',
   posNormaliser !== -1 && posRenderer !== -1 && posNormaliser < posRenderer, true);
// The renderer itself must be UNCHANGED — the whole safety argument is that
// non-joi errors keep their existing path.
eq('the renderer still keys on err.status || 500',
   /res\.status\(err\.status \|\| 500\)/.test(indexSrc), true);
eq('the renderer still special-cases APIError',
   /err instanceof APIError/.test(indexSrc), true);

// ---------------------------------------------------------------- unit
console.log('U  message rendering from joi details[]');
// Load the module under test WITHOUT crashing when it is absent: on the pre-fix
// tree the negative control must still reach the BEHAVIOURAL assertions below
// (400-vs-500, body shape) and report them as failures. A suite that dies at
// require() proves only that a file is missing -- it never demonstrates that it
// can detect the defect itself.
let joiHttpError;
try {
    joiHttpError = require(path.join(root, 'app/utils/joi-http-error.js'));
} catch (e) {
    console.log('  !! app/utils/joi-http-error.js is ABSENT -- running as NEGATIVE CONTROL');
    joiHttpError = function (err, req, res, next) { return next(err); };  // pre-fix behaviour
    joiHttpError.cleanMessage = function (err) { return err && err.message; };
    joiHttpError.isJoiValidationError = function () { return false; };
}

function msgFor (schema, value) {
    let out = null;
    joi.validate(value, schema, { abortEarly: false }, function (e) {
        out = e ? joiHttpError.cleanMessage(e) : null;
    });
    return out;
}
eq('nested params.N', msgFor({ params: joi.object().keys({ N: joi.number().required() }) },
                             { params: { N: '' } }), 'params.N: must be a number');
eq('top-level number', msgFor({ patternMatching: joi.number().required() },
                              { patternMatching: 'abc' }), 'patternMatching: must be a number');
eq('required missing', msgFor({ params: joi.object().keys({ areaThreshold: joi.number().required() }) },
                              { params: {} }), 'params.areaThreshold: is required');
eq('string type', msgFor({ species: joi.string().required() },
                         { species: 123 }), 'species: must be a string');
eq('no nested joi prose remains',
   /fails because/.test(msgFor({ params: joi.object().keys({ N: joi.number().required() }) },
                               { params: { N: '' } })), false);

console.log('U  discrimination: only joi errors are converted');
eq('a plain Error is not a joi error', joiHttpError.isJoiValidationError(new Error('x')), false);
eq('null is not', joiHttpError.isJoiValidationError(null), false);
eq('an APIError is not', joiHttpError.isJoiValidationError(new APIError('x', 404)), false);
// @rfcx/http-utils ValidationError shares the NAME but not isJoi — deliberately
// out of scope, and this pins that decision so a later widening is explicit.
eq('a name-only ValidationError is NOT converted',
   joiHttpError.isJoiValidationError({ name: 'ValidationError', message: 'x' }), false);

// ---------------------------------------------------------------- integration
// Drive the REAL renderer, extracted from the shipped app/index.js.
console.log('I  end-to-end through the REAL shipped error handler');
const m = indexSrc.match(/\/\/ error handler\n(app\.use\(function\(err, req, res, next\) \{[\s\S]*?\n\}\);)/);
eq('the real renderer could be extracted from app/index.js', !!m, true);

function buildApp () {
    const handlerSrc = m[1].replace(/^app\.use\(/, '(').replace(/\);$/, ')');
    // eslint-disable-next-line no-new-func
    const renderer = new Function('APIError', 'app', 'return ' + handlerSrc)(
        APIError, { get: function () { return 'production'; } });
    const a = express();
    a.get('/joi', function (req, res, next) {
        res.type('json');
        joi.validate({ params: { N: '' } },
            { params: joi.object().keys({ N: joi.number().required() }) },
            function (e) { next(e); });
    });
    a.get('/nonjoi', function (req, res, next) {
        res.type('json'); next(new Error('some other failure'));
    });
    a.get('/apierr', function (req, res, next) {
        res.type('json'); next(new APIError({ error: 'project not found' }, 404));
    });
    a.get('/apierr-str', function (req, res, next) {
        res.type('json'); next(new APIError('Playlist name in use'));
    });
    a.use(joiHttpError);   // the module under test
    a.use(renderer);       // the real, unmodified renderer
    return a;
}

function get (app, p, cb) {
    const srv = http.createServer(app).listen(0, '127.0.0.1', function () {
        http.get({ host: '127.0.0.1', port: srv.address().port, path: p }, function (res) {
            let b = '';
            res.on('data', function (d) { b += d; });
            res.on('end', function () {
                let j = null;
                try { j = JSON.parse(b); } catch (e) { /* non-json body */ }
                srv.close();
                cb({ status: res.statusCode, raw: b, json: j });
            });
        });
    });
}

// ---------------------------------------------------------------- client
// The server fix alone reaches only ONE of the 18 measured events: 5 of the 6
// routes discard the body (hardcoded text, or no error handler at all). So the
// client-side surfacing is part of the fix, and is asserted here.
console.log('C  client: humane.js surfaces a 4xx message, never a 5xx body');
let notify;
{
    const humaneSrc = fs.readFileSync(path.join(root, 'assets/app/services/humane.js'), 'utf8');
    let factoryFn = null;
    const angularStub = { module: function () {
        return { factory: function (n, f) { factoryFn = f; return this; } };
    } };
    // eslint-disable-next-line no-new-func
    new Function('angular', humaneSrc)(angularStub);
    const shown = [];
    const humaneStub = {
        spawn: function () { return function (m) { shown.push(m); }; },
        error: function (m) { shown.push(m); }
    };
    notify = factoryFn ? factoryFn({ humane: humaneStub }) : null;
    eq('humane.js factory could be loaded', !!notify, true);

    const last = function (fn) { shown.length = 0; fn(); return shown[shown.length - 1]; };

    eq('a 400 {error} body is shown to the user',
       last(function () { notify.serverError({ status: 400, data: { error: 'params.N: must be a number' } }); }),
       'params.N: must be a number');
    // The safety property: a 5xx body is an internal failure and must NOT be echoed.
    eq('a 500 body is NOT echoed',
       last(function () { notify.serverError({ status: 500, data: 'Server error' }); }),
       'Error communicating with server');
    // `.catch(notify.serverError)` passes a BARE function reference (no `this`).
    eq('works as an unbound .catch(notify.serverError) reference',
       last(function () {
           const bare = notify.serverError;
           bare({ status: 400, data: { error: 'patternMatching: must be a number' } });
       }),
       'patternMatching: must be a number');
    // Legacy zero-arg call sites must be unaffected.
    eq('a zero-argument call still works',
       last(function () { notify.serverError(); }), 'Error communicating with server');
    eq('a bare Error does not leak or crash',
       last(function () { notify.serverError(new Error('boom')); }), 'Error communicating with server');
    // apiError does not exist pre-fix; assert its ABSENCE as a failure rather than
    // letting the call crash the suite, so the negative control still reaches the
    // HTTP assertions below (that is the part which proves 500-vs-400).
    eq('notify.apiError exists', typeof notify.apiError === 'function', true);
    eq('apiError falls back to the caller text on 5xx',
       typeof notify.apiError === 'function'
           ? last(function () { notify.apiError({ status: 500, data: 'Server error' }, 'Error creating the job'); })
           : '(apiError missing)',
       'Error creating the job');

    // The pattern-matching caller must use apiError, not notify.error(err): passing
    // the whole response object to humane renders it via innerHTML.
    const pmSrc = fs.readFileSync(path.join(root, 'assets/app/app/analysis/patternmatching/index.js'), 'utf8');
    // Anchor on the call itself rather than on its distance from the .catch(:
    // an intervening comment must not break the assertion (it did once).
    eq('the pattern-matching create() catch uses notify.apiError',
       /notify\.apiError\(err,\s*'[^']+'\)/.test(pmSrc), true);
    eq('it no longer passes the raw response to notify.error',
       /self\.isSaving = false\s*\n\s*notify\.error\(err\);/.test(pmSrc), false);
}

const app = buildApp();
get(app, '/joi', function (r) {
    eq('joi failure is 400', r.status, 400);
    eq('joi body carries .error for the legacy data.error consumer',
       r.json && r.json.error, 'params.N: must be a number');
    eq('joi body is no longer the bare "Server error" string', r.raw === '"Server error"', false);

    // The regression this fix exists to avoid: 400 + an unusable body would make
    // the legacy `if (status < 500) notify.error(data.error)` show an EMPTY toast.
    const legacyShows = r.status < 500 ? (r.json && r.json.error)
                                       : 'There was a system error. Please try again.';
    eq('the legacy status<500 branch shows a real message',
       typeof legacyShows === 'string' && legacyShows.length > 0, true);

    get(app, '/nonjoi', function (r2) {
        eq('a NON-joi error is still 500', r2.status, 500);
        eq('a NON-joi error body is unchanged', r2.raw, '"Server error"');
        get(app, '/apierr', function (r3) {
            eq('an existing APIError keeps its status', r3.status, 404);
            eq('an existing APIError keeps its body', r3.json && r3.json.error, 'project not found');
            get(app, '/apierr-str', function (r4) {
                eq('a status-less APIError still defaults to 500', r4.status, 500);
                eq('a status-less APIError keeps its string body', r4.raw, '"Playlist name in use"');
                console.log('\n' + pass + ' passed, ' + fail + ' failed');
                process.exit(fail === 0 ? 0 : 1);
            });
        });
    });
});