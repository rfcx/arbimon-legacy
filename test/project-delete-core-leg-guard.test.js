/* eslint-env mocha */
/**
 * Source-shape guard for the CORE leg of project delete (R2).
 *
 * OPEN-ITEMS §330 item (6). Evidence:
 * rfcx-local `runbooks/evidence/project-delete-caller-enumeration-2026-09-16.md`.
 *
 * WHAT THIS PROTECTS, AND WHY IT IS NOT HYPOTHETICAL:
 * `removeProject` is shared by BOTH legacy delete routes. `/remove` passes
 * `req.body.external_id`, so its core call is real. `/soft-remove` passes
 * NOTHING, so for years its core call was built against the literal string
 * `/projects/undefined`. Measured on Loki (14 d, positive control 1000 lines):
 * **12 such requests**, i.e. essentially every SPA project delete. §330 had
 * recorded "blast radius 0" because the original probe grepped the ARBIMON pod
 * logs, while the request is logged by CORE-API — the wrong workload.
 *
 * Worse, THREE of those 12 answered **204, not 404**: core's
 * `DELETE /projects/:id` sets `deletableBy = undefined` for a super/system-role
 * caller, skips the permission pre-check, and runs
 * `Project.destroy({where:{id:'undefined'}})` — 0 rows, no throw, `204`. The
 * status encodes the CALLER'S PRIVILEGE, not the outcome, which is why a core
 * delete against a nonexistent id has looked like success for years.
 *
 * THE GUARD: only call core when we actually have an id, and say so in the log
 * when we skip. This is a no-op for `/remove` (it has an id) and turns
 * `/soft-remove`'s ACCIDENTAL inertness into an EXPLICIT, greppable skip.
 *
 * ⚠️ It deliberately does NOT make `/soft-remove` pass a real id: the SPA deletes
 * core+insights via bio-api FIRST, so core is already soft-deleted by the time
 * this runs, and a restored id would issue a redundant 0-row delete rather than
 * repair anything. Doing that safely also requires `deleteInCoreAPI` to be able
 * to fail loudly (today `rp` resolves on ANY status and the `APIError` throw sits
 * inside `catch (e) {}`) — that is the §330 (6) consolidation, not this guard.
 *
 * Negative-control tested (revert the guard, watch these go red) before landing.
 *
 * NOTE this is a MOCHA suite, not a standalone script — same population split
 * the sibling `project-delete-actor.test.js` documents.
 */
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var PROJECTS_MODEL = path.join(__dirname, '..', 'app', 'model', 'projects.js');
var modelSrc = fs.readFileSync(PROJECTS_MODEL, 'utf-8');

// Strip comments so a guard can never be satisfied by PROSE that happens to use
// the same words as the code it asserts about — this file's own long comment
// above would otherwise satisfy several of these.
function stripComments (s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
var modelCode = stripComments(modelSrc);

function sliceFn (src, name) {
    var start = src.indexOf(name + ':');
    expect(start, name + ' not found in source').to.be.greaterThan(-1);
    var rest = src.slice(start + name.length);
    var end = rest.search(/\n    [a-zA-Z_$][a-zA-Z0-9_$]*: (function|async function)/);
    return end === -1 ? rest : rest.slice(0, end);
}

describe('project delete: the core leg is only called with a real id', function () {

    var removeProject = sliceFn(modelCode, 'removeProject');

    it('guards the core call on external_id being present', function () {
        // Without this, /soft-remove builds DELETE /projects/undefined.
        expect(removeProject, 'the core call must be guarded on options.external_id')
            .to.match(/if\s*\(\s*rfcxConfig\.coreAPIEnabled\s*&&\s*options\.external_id\s*\)/);
    });

    it('still calls deleteInCoreAPI when an id IS supplied', function () {
        // /remove must keep working: the guard is a narrowing, not a removal.
        expect(removeProject, 'deleteInCoreAPI must still be reachable')
            .to.match(/this\.deleteInCoreAPI\(\s*options\.external_id\s*,\s*options\.idToken\s*\)/);
    });

    it('LOGS a named event when it skips the core call', function () {
        // A silent skip is the same defect wearing a different hat: the whole
        // point is that the skip becomes visible and greppable.
        expect(removeProject, 'the skip must emit project_delete_core_leg_skipped')
            .to.match(/project_delete_core_leg_skipped/);
    });

    it('the skip log carries the project id', function () {
        // An event you cannot attribute to a project is not actionable.
        expect(removeProject, 'the skip log must include project_id')
            .to.match(/project_id:\s*options\.project_id/);
    });

    it('does not reintroduce an unguarded core call', function () {
        // Belt and braces: there must be no bare `if (rfcxConfig.coreAPIEnabled)`
        // wrapping a deleteInCoreAPI call (the pre-fix shape).
        var unguarded = /if\s*\(\s*rfcxConfig\.coreAPIEnabled\s*\)\s*\{\s*await this\.deleteInCoreAPI/;
        expect(unguarded.test(removeProject), 'found the pre-fix unguarded core call')
            .to.equal(false);
    });

    it('still soft-deletes on legacy before any core call', function () {
        // Ordering invariant: legacy first, core second. Guards against a
        // "fix" that reorders the legs.
        var legacyAt = removeProject.indexOf('this.deleteLegacy');
        var coreAt = removeProject.indexOf('this.deleteInCoreAPI');
        expect(legacyAt).to.be.greaterThan(-1);
        expect(coreAt).to.be.greaterThan(-1);
        expect(legacyAt).to.be.lessThan(coreAt);
    });
});