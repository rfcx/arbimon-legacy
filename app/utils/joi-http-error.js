/* jshint node:true */
'use strict';

// §316 (rfcx-local OPEN-ITEMS) -- joi validation failures were answered
// `500 "Server error"`, never `400`.
//
// WHY THIS IS A SEPARATE MODULE AND NOT AN `if` IN THE ERROR HANDLER:
// `app/index.js`'s handler already has exactly one contract for "an error that
// knows its own HTTP status" -- `APIError` (app/utils/apierror.js, 49 call
// sites): it reads `err.status || 500`, and returns `err.message` as the JSON
// body only when `err instanceof APIError`. joi's ValidationError satisfies
// neither (`.status` is undefined, and it is not an APIError), which is the
// whole defect. So instead of teaching the renderer about joi, we NORMALISE a
// joi error into the shape the renderer already understands. Consequence worth
// stating: every non-joi error takes a byte-identical path by construction,
// not by careful editing of a shared branch.
//
// MEASURED BEHAVIOUR THIS PRESERVES (rfcx-local
// runbooks/FINDING-2026-09-14-316-validation-500-vs-400.md):
// the legacy Angular client has FOUR call sites doing
//   .error(function(data, status){ if (status < 500) notify.error(data.error); ... })
// on the class/add family. Returning 400 with the body left as the bare string
// "Server error" makes `data.error` undefined -- an EMPTY toast, i.e. a
// REGRESSION. That is why the status change and the body change are inseparable
// and ship together here.

var APIError = require('./apierror.js');

// joi >= 6 sets `.isJoi`; joi is pinned at ~9.0.4 in package.json. We test
// `isJoi` rather than `name === 'ValidationError'` DELIBERATELY: @rfcx/http-utils
// exports its own ValidationError (thrown in app/model/projects.js) which is a
// different class with a hand-written, user-safe message. Widening this test
// would silently change that class's status too, which is out of scope here.
function isJoiValidationError (err) {
    return !!(err && err.isJoi === true && Array.isArray(err.details));
}

// Render joi's `details[]` rather than `err.message`.
//
// `err.message` is nested prose:
//     child "params" fails because [child "N" fails because ["N" must be a number]]
// `details[]` carries the leaf path and reason separately, giving:
//     params.N: must be a number
//
// DISCLOSURE NOTE (the operator decision recorded in §316): joi messages name
// field PATHS, not submitted values -- verified in the deployed pod against
// joi 9.0.4: `details[0].context` is `{key}` only, and this codebase has ZERO
// `.regex()` schemas (the one joi rule that echoes the submitted value back).
// The `.valid()` enums that do leak an allowed set are harmless
// (present/absent, count/list/date_range/sql, 0/1).
function cleanMessage (err) {
    var parts = err.details.map(function (d) {
        var p = Array.isArray(d.path) ? d.path.join('.') : d.path;
        // d.message is '"N" must be a number' -- strip the leading quoted label,
        // which the path already states more precisely.
        var reason = String(d.message).replace(/^"[^"]*"\s*/, '');
        return p ? (p + ': ' + reason) : reason;
    });
    // De-duplicate: joi can emit the same leaf twice for alternatives schemas.
    var seen = Object.create(null);
    parts = parts.filter(function (s) {
        if (seen[s]) { return false; }
        seen[s] = true;
        return true;
    });
    return parts.join('; ');
}

// Express error middleware. Register this BEFORE the existing handler in
// app/index.js; it converts and delegates with next(err), leaving every
// non-joi error untouched. (Verified against express 4.17.1: error middleware
// chains via next(err).)
function joiHttpError (err, req, res, next) {
    if (isJoiValidationError(err)) {
        // The body is an OBJECT with `.error` because that is what the legacy
        // client's `data.error` reads, and what the existing 4xx JSON routes in
        // app/routes/data-api/project/index.js already emit.
        return next(new APIError({ error: cleanMessage(err) }, 400));
    }
    return next(err);
}

module.exports = joiHttpError;
module.exports.isJoiValidationError = isJoiValidationError;
module.exports.cleanMessage = cleanMessage;