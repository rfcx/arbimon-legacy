var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * STRUCTURAL GUARANTEE (2026-09-15): project deletion is OWNER-ONLY, and a
 * super user does not get to bypass that.
 *
 * Operator ruling 2026-09-15 23:34: "project deletion should only be allowed
 * by a project's owner. If a super user wants to delete a project, they must
 * masquerade as the project owner." In this app the masquerade swap
 * (app/routes/login.js) presents the TARGET as `req.session.user` with
 * `isSuper` hard-pinned to 0 and the target's real permissions, so the ordinary
 * permission check already yields the right answer for a masquerading super.
 * The only thing standing in the way was `req.haveAccess`'s blanket
 * `isSuper === 1 -> true`, which short-circuited every permission including
 * 'delete project'. This suite ratchets its narrowing.
 *
 * WHY THIS IS SOURCE-SHAPE AND NOT A ROUTE TEST. `haveAccess` is installed by
 * router middleware on a live session; exercising it end-to-end needs Auth0 and
 * a Redis session. The property being protected is the SHAPE of one conditional
 * -- exactly what a source read can assert and a route test can only infer.
 *
 * WHAT IS DELIBERATELY ALLOWED: the super bypass for EVERY OTHER permission.
 * The ruling is about delete. Widening the narrowing to other permissions
 * would silently strip supers of legacy capabilities the operator did not ask
 * to remove, so the suite asserts the bypass still EXISTS for the general case.
 */

var loginSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'routes', 'login.js'), 'utf8');
var projectRoutesSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'index.js'), 'utf8');

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

var login = stripComments(loginSrc);
var haveAccessBody = login.slice(login.indexOf('req.haveAccess = function'));

describe('project delete is owner-only (super must masquerade)', function() {

  it('haveAccess still grants supers every permission EXCEPT delete project', function() {
    // The narrowed bypass must exist -- not be removed wholesale.
    expect(haveAccessBody).to.match(/isSuper === 1\s*&&\s*permission_name !== 'delete project'/);
  });

  it('haveAccess has NO unconditional super bypass', function() {
    // The old line was `if(req.session.user.isSuper === 1) return true;` with
    // no permission qualifier. Its presence would re-open the door.
    expect(haveAccessBody).to.not.match(/isSuper === 1\)\s*\n?\s*return true/);
  });

  it('the LIVE project delete route still gates on delete project', function() {
    // UPDATED 2026-09-16: this asserted BOTH routes. `/remove` was RETIRED that
    // day (410 Gone, rfcx-local OPEN-ITEMS §330 (6)) and no longer deletes
    // anything, so it correctly has no authz check left to make — there is
    // nothing behind it to protect.
    //
    // The invariant this test exists for is unchanged and still enforced on the
    // one route that CAN delete: /soft-remove, the SPA's legacy leg.
    var softRemove = projectRoutesSrc.indexOf("'/:projectUrl/soft-remove'");
    expect(softRemove).to.be.above(-1);
    var softBlock = projectRoutesSrc.slice(softRemove, softRemove + 900);
    expect(softBlock).to.match(/haveAccess\([^)]*["']delete project["']\)/);
  });

  it('the retired /remove route deletes nothing (so needing no gate is SAFE)', function() {
    // The pairing that makes the relaxation above honest: a route with no authz
    // check is only acceptable while it also has no delete. If someone restores
    // the delete without restoring the gate, THIS fails.
    var remove = projectRoutesSrc.indexOf("'/:projectUrl/remove'");
    var softRemove = projectRoutesSrc.indexOf("'/:projectUrl/soft-remove'");
    expect(remove).to.be.above(-1);
    var removeBlock = projectRoutesSrc.slice(remove, softRemove);
    expect(removeBlock).to.not.match(/removeProject/);
    expect(removeBlock).to.match(/410/);
  });

  it('the masquerade swap still hard-pins isSuper to 0 (so a masquerading super uses the owner path)', function() {
    // This is the property that makes "supers must masquerade" work without
    // any delete-specific masquerade code: once swapped, the request IS the
    // owner as far as haveAccess is concerned.
    expect(login).to.match(/session\.user\.isSuper = 0/);
  });
});