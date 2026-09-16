/* eslint-env mocha */
/**
 * Source-shape guards for project-delete ACTOR attribution (`deleted_by`).
 *
 * OPEN-ITEMS §330 item (1); operator ruling 2026-09-15 21:41. Design:
 * rfcx-local `runbooks/DESIGN-2026-09-16-project-delete-actor-deleted-by.md`.
 *
 * WHY SOURCE-SHAPE RATHER THAN BEHAVIOURAL: both defects this protects against are
 * SILENT — they produce a successful-looking delete that records NULL. By the time
 * a behavioural test can observe the row, the evidence that the value was dropped
 * is gone. Both have actually happened here, on the sibling column `archived_by`,
 * on 2026-09-09:
 *
 *   1. `q.ninvoke` appends the node-style callback LAST, so a value passed as an
 *      extra POSITIONAL argument lands in the driver's callback slot and vanishes.
 *      It must go in the PARAMETER ARRAY.
 *   2. The session user object is built by `makeUserObject`, which sets `id`
 *      (`id: user.user_id`). There is NO `user_id` field on it, so reading
 *      `req.session.user.user_id` yields undefined and every delete records NULL.
 *
 * Every assertion here was negative-control tested (break the code, watch it go
 * red) before landing.
 *
 * NOTE this file is a MOCHA suite, not a standalone script: `arbimon-legacy/test/`
 * is two populations, split by whether the file calls the process-exit API, and
 * loading a standalone script into mocha kills the run with no summary. (This
 * comment deliberately does NOT spell that call literally: the classifier is a
 * grep, so naming it here would make this suite look like a standalone script and
 * silently exclude it from the run — which is exactly what happened on the first
 * attempt, and the identical pass-count on both trees is what exposed it.)
 */
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var PROJECTS_MODEL = path.join(__dirname, '..', 'app', 'model', 'projects.js');
var PROJECT_ROUTES = path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'index.js');

var modelSrc = fs.readFileSync(PROJECTS_MODEL, 'utf-8');
var routesSrc = fs.readFileSync(PROJECT_ROUTES, 'utf-8');

// Strip comments so a guard can never be satisfied by PROSE that happens to use
// the same words as the code it is asserting about.
function stripComments(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

var modelCode = stripComments(modelSrc);
var routesCode = stripComments(routesSrc);

// Slice out one function body by brace-independent means: from its key to the
// start of the next top-level key. Good enough for these single-statement
// functions and avoids depending on a JS parser in this old toolchain.
function sliceFn(src, name) {
    var start = src.indexOf(name + ':');
    expect(start, name + ' not found in source').to.be.greaterThan(-1);
    var rest = src.slice(start + name.length);
    var end = rest.search(/\n    [a-zA-Z_$][a-zA-Z0-9_$]*: (function|async function)/);
    return end === -1 ? rest : rest.slice(0, end);
}

describe('project delete: actor attribution (deleted_by)', function () {

    describe('the statement', function () {
        var deleteLegacy = sliceFn(modelCode, 'deleteLegacy');

        it('deleteLegacy SETS deleted_by in the UPDATE', function () {
            expect(deleteLegacy, 'deleteLegacy must write deleted_by alongside deleted_at')
                .to.match(/UPDATE projects SET deleted_at = NOW\(\), deleted_by = \?/);
        });

        it('deleteLegacy accepts the actor as a PARAMETER (not a hard-coded value)', function () {
            // NB: sliceFn() returns the body starting AFTER the function name, so
            // the pattern must not expect `deleteLegacy:` to be present. (My first
            // version did, and failed against correct source — a harness defect,
            // fixed in the harness rather than in the code under test.)
            expect(deleteLegacy, 'deleteLegacy must take deleted_by as its third argument')
                .to.match(/async function\s*\(\s*project_id\s*,\s*db\s*,\s*deleted_by\s*\)/);
        });

        /**
         * THE q.ninvoke TRAP. The actor must appear INSIDE the bracketed parameter
         * array, before the closing `]`. If it were passed as a further argument to
         * q.ninvoke instead, the callback would take its place and the column would
         * silently be NULL.
         */
        it('the actor rides the PARAMETER ARRAY, not a trailing q.ninvoke argument', function () {
            var arrayStart = deleteLegacy.indexOf('[');
            var arrayEnd = deleteLegacy.indexOf(']');
            expect(arrayStart, 'no parameter array found').to.be.greaterThan(-1);
            expect(arrayEnd, 'unterminated parameter array').to.be.greaterThan(arrayStart);

            var params = deleteLegacy.slice(arrayStart, arrayEnd);
            expect(params, 'deleted_by must be bound inside the parameter array (q.ninvoke appends the callback LAST)')
                .to.match(/deleted_by/);
            expect(params, 'project_id must still be bound in the parameter array')
                .to.match(/project_id/);
        });

        it('binds the actor BEFORE project_id, matching the placeholder order', function () {
            var params = deleteLegacy.slice(deleteLegacy.indexOf('['), deleteLegacy.indexOf(']'));
            expect(params.indexOf('deleted_by'), 'placeholder order is (deleted_by, project_id) — a swap writes the ids into the wrong columns')
                .to.be.lessThan(params.indexOf('project_id'));
        });

        it('normalises undefined to NULL rather than letting undefined reach the driver', function () {
            expect(deleteLegacy, 'an undefined actor must become an explicit null')
                .to.match(/deleted_by === undefined \? null : deleted_by/);
        });
    });

    describe('the callers', function () {
        it('removeProject passes the actor through to deleteLegacy', function () {
            var fn = sliceFn(modelCode, 'removeProject');
            expect(fn, 'removeProject must forward options.deleted_by')
                .to.match(/deleteLegacy\(options\.project_id,\s*db,\s*options\.deleted_by\)/);
        });

        it('removeLegacyProject passes the actor through to deleteLegacy', function () {
            var fn = sliceFn(modelCode, 'removeLegacyProject');
            expect(fn, 'removeLegacyProject must forward options.deleted_by')
                .to.match(/deleteLegacy\(options\.project_id,\s*db,\s*options\.deleted_by\)/);
        });
    });

    describe('the routes (THE user.id vs user_id TRAP)', function () {
        /**
         * `makeUserObject` (app/model/users.js) builds the session user with
         * `id: user.user_id`. There is NO `user_id` key on it. Reading `user_id`
         * here is undefined => every delete records NULL, and nothing fails loudly.
         */
        it('/remove reads req.session.user.id', function () {
            expect(routesCode, '/remove must source the actor from session.user.id')
                .to.match(/deleted_by:\s*req\.session\.user && req\.session\.user\.id/);
        });

        it('every SURVIVING delete route supplies deleted_by', function () {
            // UPDATED 2026-09-16: this asserted exactly 2 (both /remove and
            // /soft-remove). `/remove` was RETIRED the same day — 410 Gone, it
            // deletes nothing — so only ONE delete route remains and only it can
            // record an actor. See rfcx-local OPEN-ITEMS §330 (6).
            //
            // Asserting the COUNT rather than ">= 1" is deliberate: it is what
            // caught the seal in the first place, and it will catch a future
            // route that deletes without recording the actor.
            var occurrences = routesCode.match(/deleted_by:\s*req\.session\.user/g) || [];
            expect(occurrences.length, '/soft-remove is the one remaining legacy delete route and must record the actor')
                .to.equal(1);
        });

        it('the retired /remove route no longer records an actor (because it no longer deletes)', function () {
            var remove = routesCode.indexOf("'/:projectUrl/remove'");
            var softRemove = routesCode.indexOf("'/:projectUrl/soft-remove'");
            expect(remove).to.be.above(-1);
            var removeBlock = routesCode.slice(remove, softRemove);
            expect(removeBlock, 'a sealed route must not still be wired to the delete model')
                .to.not.match(/removeProject/);
            expect(removeBlock, 'and it must not pretend to attribute an actor')
                .to.not.match(/deleted_by/);
        });

        it('NO delete route reads the non-existent session field user_id', function () {
            expect(routesCode, 'session.user has no user_id field — reading it writes NULL silently')
                .to.not.match(/deleted_by:\s*req\.session\.user\.user_id/);
        });

        /**
         * POSITIVE CONTROL on the regex above: prove this suite can actually SEE
         * the field it claims is absent. Without this, a typo in the pattern would
         * make the absence assertion vacuously true.
         */
        it('control: the absence check is not vacuous', function () {
            var sample = 'deleted_by: req.session.user.user_id';
            expect(sample, 'the pattern used for the absence assertion must match a real instance')
                .to.match(/deleted_by:\s*req\.session\.user\.user_id/);
        });
    });
});