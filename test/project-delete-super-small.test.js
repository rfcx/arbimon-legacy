var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * SUPER-USER SOFT DELETE OF A SMALL PROJECT (2026-09-28, operator goifirr 08:53).
 * Source-shape suite, same reasoning as project-delete-owner-only.test.js (the
 * gates run on a live Auth0+Redis session). It ratchets that the narrowing is
 * EXACTLY: bare super + count < 100 + fail-closed, on both soft-remove and
 * soft-restore -- and that the 09-15 owner-only shape of haveAccess is untouched.
 */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
var src = stripComments(fs.readFileSync(path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'index.js'), 'utf8'));
var login = stripComments(fs.readFileSync(path.join(__dirname, '..', 'app', 'routes', 'login.js'), 'utf8'));
var helper = src.slice(src.indexOf('function superMaySoftDelete'), src.indexOf("router.post('/:projectUrl/soft-remove'"));

function routeBlock(name) {
  var i = src.indexOf("router.post('/:projectUrl/" + name + "'");
  expect(i).to.be.above(-1);
  return src.slice(i, i + 1200);
}

describe('super-user soft delete of a SMALL project', function() {
  it('the threshold is 100 and the comparison is strict (< 100)', function() {
    expect(src).to.match(/const SUPER_DELETE_MAX_RECORDINGS = 100;/);
    expect(helper).to.match(/n < SUPER_DELETE_MAX_RECORDINGS/);
  });

  it('only a BARE super qualifies (isSuper === 1; masquerade pins it to 0)', function() {
    expect(helper).to.match(/req\.session\.user\.isSuper === 1/);
    expect(login).to.match(/session\.user\.isSuper = 0/);
  });

  it('fails CLOSED: a count error or a non-number is a refusal', function() {
    expect(helper).to.match(/\.catch\(function\(\) \{ return false; \}\)/);
    expect(helper).to.match(/Number\.isFinite\(n\)/);
  });

  it('soft-remove and soft-restore BOTH use owner path OR the super predicate', function() {
    ['soft-remove', 'soft-restore'].forEach(function(name) {
      var b = routeBlock(name);
      expect(b).to.match(/haveAccess\([^)]*'delete project'\)/);
      expect(b).to.match(/superMaySoftDelete\(req\)/);
      expect(b).to.match(/if\(!allowed\)/);
    });
  });

  it('haveAccess keeps the 09-15 shape (no blanket super bypass for delete)', function() {
    var body = login.slice(login.indexOf('req.haveAccess = function'));
    expect(body).to.match(/isSuper === 1\s*&&\s*permission_name !== 'delete project'/);
  });
});
