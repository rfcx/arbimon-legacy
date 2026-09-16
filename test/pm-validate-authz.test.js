var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * STRUCTURAL GUARANTEE (2026-09-16, rfcx-local OPEN-ITEMS §333):
 * `POST /pattern-matchings/:patternMatching/validate` must be permission-gated
 * server-side, and its write must be bound to the project in the URL.
 *
 * WHY THIS SUITE EXISTS. Until this change the route had NO `haveAccess` call
 * and no `router.use` gate, while its siblings `/remove` and `/new` in the SAME
 * file both gated on 'manage pattern matchings'. The permission
 * 'validate pattern matchings' already existed in the DB (held by
 * Admin/Owner/Expert) and was enforced ONLY in the legacy Angular client
 * (assets/app/app/analysis/patternmatching/index.js). A check implemented
 * client-side and never server-side is not a check: anything not going through
 * that UI (curl, devtools, the ported SPA control) was unconstrained.
 *
 * WHICH PERMISSION, AND WHY IT IS SAFE. 30 d of production traffic
 * (2,621 successful calls, 100 % parse) attributed to roles showed 2,610
 * (99.58 %) of callers ALREADY hold 'validate pattern matchings'
 * (Admin 1,553 / Expert 726 / Owner 331), and that User/Guest/Data Entry made
 * ZERO calls -- so gating on 'validate pattern matchings' and on
 * 'manage pattern matchings' refuse exactly the same calls, and the semantic
 * choice is free. Measured worst case: 3 refused calls in 30 days, both from an
 * Owner whose project slug did not resolve. Evidence:
 * rfcx-local runbooks/evidence/s7-validate-role-attribution-20260916.md
 *
 * WHY SOURCE-SHAPE AND NOT A ROUTE TEST. `haveAccess` is installed by router
 * middleware onto a live session (Auth0 + a Redis session to exercise
 * end-to-end). The property being protected is the SHAPE of the guard and of
 * the model's WHERE clause -- exactly what a source read can assert and a route
 * test can only infer. Same rationale as test/project-delete-owner-only.test.js.
 */

var pmRoutesSrc = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'pattern_matchings.js'), 'utf8');
var pmModelSrc = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'model', 'pattern_matchings.js'), 'utf8');

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

var routes = stripComments(pmRoutesSrc);
var model = stripComments(pmModelSrc);

// Slice out just the /validate handler: from its router.post to the next router.post.
function routeBlock(src, marker) {
  var start = src.indexOf(marker);
  expect(start, 'route ' + marker + ' not found').to.be.above(-1);
  var next = src.indexOf('router.post(', start + marker.length);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

describe('PM validate route is authorised server-side (OPEN-ITEMS §333)', function() {

  var validateBlock = routeBlock(routes, "router.post('/:patternMatching/validate'");

  it('gates on the validate pattern matchings permission', function() {
    // The permission the legacy Angular client already enforces, and the one
    // that exists in the DB for exactly this action.
    expect(validateBlock).to.match(/haveAccess\([^)]*["']validate pattern matchings["']\)/);
  });

  it('refuses rather than proceeding when the permission is absent', function() {
    // A gate that computes a boolean and ignores it is not a gate: the block
    // must actually stop the request (throw/next/return a 4xx).
    expect(validateBlock).to.match(/if\s*\(\s*!\s*req\.haveAccess/);
  });

  it('the rename route is gated too', function() {
    // /update was ungated by the same omission -- it renames a PM job.
    var updateBlock = routeBlock(routes, "router.post('/:patternMatching/update'");
    expect(updateBlock).to.match(/haveAccess\(/);
  });

  it('the sibling gates that already existed are still present', function() {
    // Negative control on my own edit: if this fails, I broke /remove or /new
    // rather than adding a gate.
    expect(routeBlock(routes, "router.post('/:patternMatching/remove'"))
      .to.match(/haveAccess\([^)]*["']manage pattern matchings["']\)/);
    expect(routeBlock(routes, "router.post('/new'"))
      .to.match(/haveAccess\([^)]*["']manage pattern matchings["']\)/);
  });
});

describe('PM validate write is bound to the project (the §291/§292 class)', function() {

  it('getRoi constrains rows to the project, not just the pattern matching id', function() {
    // Before: getRoi took projectId and passed it ONLY to getRoiUrl() for URL
    // building, so the project in the URL was decorative. Measured live: a
    // request naming a NON-EXISTENT slug still returned 200 and wrote.
    var start = model.indexOf('getRoi(patternMatchingId, roisId, projectId)');
    expect(start, 'getRoi signature not found').to.be.above(-1);
    var body = model.slice(start, start + 1400);
    // The project must appear in the SQL predicate, not merely in the args.
    expect(body).to.match(/WHERE[\s\S]*project_id\s*=\s*\?/);
  });

  it('validateRois carries a project predicate on the UPDATE itself', function() {
    // Defence in depth at the layer that mutates: a route guard alone is
    // bypassed by the next caller that forgets it (the #1841 lesson).
    var start = model.indexOf('validateRois(patternMatchingId, rois, validation');
    expect(start, 'validateRois signature not found').to.be.above(-1);
    var body = model.slice(start, start + 1200);
    expect(body).to.match(/UPDATE pattern_matching_rois/);
    expect(body).to.match(/project_id/);
  });
});