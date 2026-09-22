var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * SOURCE-SHAPE TEST: the ordinary (non-citizen-scientist) PM validation path
 * records WHO validated (rfcx-local OPEN-ITEMS 375, user-attribution slice 1).
 *
 * WHY THIS EXISTS. Measured 2026-09-22 on live PG: 32,463,698 validated ROIs
 * carried an `expert_validation_user_id` on 3,339 of them (0.010 %), because the
 * column was written ONLY by the citizen-scientist expert path
 * (citizen-scientist.js expertValidateCSRois) and CS is enabled on ~110 of
 * ~2,000 PM projects. The ordinary path (model validateRois) was a bare
 * `SET validated = ?` -- structurally unattributable for ~95 % of projects.
 *
 * The property protected here is the SHAPE of the write and of its two call
 * sites -- exactly what a source read can assert and a route test can only
 * infer (same rationale as pm-validate-authz.test.js). A regression of the
 * class that bit `archived_by` on 2026-09-09 (an argument that silently never
 * reached the model) would pass a happy-path route test and fail this one.
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

function block(src, marker, len) {
  var start = src.indexOf(marker);
  expect(start, marker + ' not found').to.be.above(-1);
  return src.slice(start, start + (len || 1800));
}

describe('PM validation records the acting user (OPEN-ITEMS 375 slice 1)', function() {

  var validateRois = block(model, 'validateRois(patternMatchingId, rois, validation, projectId, userId)');

  it('the model statement writes expert_validation_user_id alongside validated', function() {
    expect(validateRois).to.match(/SET validated = \?,/);
    expect(validateRois).to.match(/expert_validation_user_id = COALESCE\(\?, expert_validation_user_id\)/);
  });

  it('a missing user leaves existing attribution alone (COALESCE, never NULL-overwrite)', function() {
    // The actor is bound as null when absent, and the SQL is COALESCE(?, existing).
    expect(validateRois).to.match(/const actor = \(userId === undefined \|\| userId === null\) \? null : Number\(userId\)/);
    expect(validateRois).to.not.match(/expert_validation_user_id = \?\s*\n/);
  });

  it('binds the actor in BOTH the project-scoped and unscoped parameter lists, in statement order', function() {
    expect(validateRois).to.match(/\[validation, actor, patternMatchingId, projectId, rois\]/);
    expect(validateRois).to.match(/\[validation, actor, patternMatchingId, rois\]/);
  });

  it('the validate route passes req.session.user.id as the 5th argument', function() {
    var call = block(routes, 'model.patternMatchings.validateRois(', 260);
    expect(call).to.match(/validateRois\(req\.params\.patternMatching, updatedRoiIds, validation, req\.project\.project_id, req\.session\.user\.id\)/);
  });

  it('unvalidateRois forwards its userId (clearing a validation is attributed too)', function() {
    var unval = block(model, 'unvalidateRois: async function (patternMatchingId, userId, projectId)', 1200);
    expect(unval).to.match(/validateRois\(patternMatchingId, ids, null, projectId, userId\)/);
  });

  it('does NOT touch expert_validated (CS-expert rows stay distinguishable)', function() {
    expect(validateRois).to.not.match(/expert_validated\s*=/);
  });
});