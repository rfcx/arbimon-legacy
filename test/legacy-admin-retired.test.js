var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * The legacy AngularJS admin was RETIRED 2026-09-28 (operator goifirr 11:04;
 * rfcx-local OPEN-ITEMS §52). This ratchets that it stays gone: no /admin
 * mount, no admin model, no admin views/frontend, and the super nav link
 * points at the modern SPA admin (/admin/projects, served by arbimon-web).
 */
var root = path.join(__dirname, '..');
function exists(p) { return fs.existsSync(path.join(root, p)); }
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('legacy AngularJS admin is retired', function() {
  it('app/index.js no longer mounts /admin', function() {
    var src = stripComments(read('app/index.js'));
    expect(src).to.not.match(/require\(['"]\.\/routes\/admin['"]\)/);
    expect(src).to.not.match(/app\.use\(['"]\/admin['"]/);
  });

  it('the admin routes, view, model and frontend tree are deleted', function() {
    ['app/routes/admin', 'app/views/admin.ejs', 'app/model/admin-plots.js',
     'assets/app/admin.js', 'assets/app/admin'].forEach(function(p) {
      expect(exists(p), p).to.equal(false);
    });
    expect(stripComments(read('app/model/index.js'))).to.not.match(/admin-plots/);
  });

  it('nothing in the legacy frontend still references the a2.admin modules', function() {
    // (the whole assets/app tree is concatenated into ONE bundle; a dangling
    // module dependency would break every legacy page, not just admin)
    function walk(dir, out) {
      fs.readdirSync(dir).forEach(function(f) {
        var p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, out); else if (/\.(js|html|ejs)$/.test(f)) out.push(p);
      });
      return out;
    }
    var hits = walk(path.join(root, 'assets', 'app'), []).concat(walk(path.join(root, 'app', 'views'), []))
      .filter(function(p) { return /['"]a2\.admin(\.|['"])/.test(fs.readFileSync(p, 'utf8')); });
    expect(hits).to.deep.equal([]);
  });

  it('the super nav link points at the modern SPA admin', function() {
    var nav = read('app/views/fragments/home-nav.ejs');
    expect(nav).to.match(/href="\/admin\/projects"/);
    expect(nav).to.not.match(/href="\/admin\/"/);
  });
});
