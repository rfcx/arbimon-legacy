var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * R-DEL (2026-10-23; rfcx-local DESIGN-2026-10-23-deleted-project-browse-and-step8-completion.md):
 * a SOFT-DELETED project is visible to REAL supers only, read-only; everyone else gets 404.
 *
 * Measured in prod before this change: the owner of deleted private project 2494 read
 * /legacy-api/project/pr-backup/info, /sites (24) and /recordings/count (226,412).
 *
 * Two layers: (1) behaviour of the pure gate (app/utils/deleted-project-access.js), and
 * (2) source-shape ratchets proving each entry point CALLS it before the cached-permissions
 * branch (a route test needs Auth0 + Redis; the property is the ORDER of two statements).
 */
var dpa = require('../app/utils/deleted-project-access');

function req(opts) {
    opts = opts || {};
    var perms = {};
    return {
        path: opts.path || '/pr-backup/info',
        session: { user: { id: 7, isSuper: opts.isSuper ? 1 : 0, permissions: perms } },
        haveAccess: function(pid, name) {
            if (opts.isSuper && name !== 'delete project') return true;
            return (opts.roles || []).indexOf(name) !== -1;
        }
    };
}
var LIVE = { project_id: 2494, deleted_at: null };
var DELETED = { project_id: 2494, deleted_at: '2023-05-16 19:10:07' };

describe('R-DEL: deleted-project gate (behaviour)', function() {
    it('control: a live project is allowed for anyone (gate does not interfere)', function() {
        expect(dpa.gate(req({}), LIVE)).to.equal('allow');
        expect(dpa.gate(req({ isSuper: true }), LIVE)).to.equal('allow');
    });
    it('a deleted project is NOT FOUND for its owner (non-super)', function() {
        expect(dpa.gate(req({ roles: ['view project', 'manage project sites', 'delete project'] }), DELETED)).to.equal('not-found');
    });
    it('a deleted project is NOT FOUND for a masquerading super (isSuper pinned to 0)', function() {
        expect(dpa.gate(req({ isSuper: false }), DELETED)).to.equal('not-found');
    });
    it('a deleted project is READ-ONLY for a real super', function() {
        expect(dpa.gate(req({ isSuper: true }), DELETED)).to.equal('allow-read-only');
    });
    it('the restore path stays open on a deleted project (delete-chain compensation)', function() {
        expect(dpa.gate(req({ path: '/pr-backup/soft-restore' }), DELETED)).to.equal('allow');
    });
    it('capHaveAccess: super keeps only view project on that project; others unaffected', function() {
        var r = req({ isSuper: true });
        dpa.capHaveAccess(r, 2494);
        expect(r.haveAccess(2494, 'view project')).to.equal(true);
        expect(r.haveAccess(2494, 'manage project sites')).to.equal(false);
        expect(r.haveAccess(2494, 'manage project recordings')).to.equal(false);
        expect(r.haveAccess(2494, 'use citizen scientist interface')).to.equal(false);
        expect(r.haveAccess(2494, 'delete project')).to.equal(false);
        expect(r.haveAccess(9999, 'manage project sites')).to.equal(true); // other projects: super bypass intact
        expect(r.projectDeletedReadOnly).to.equal(true);
    });
});

function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }
var root = path.join(__dirname, '..', 'app');
var projectIdx = strip(fs.readFileSync(path.join(root, 'routes', 'data-api', 'project', 'index.js'), 'utf8'));
var projectPage = strip(fs.readFileSync(path.join(root, 'routes', 'project.js'), 'utf8'));
var csPage = strip(fs.readFileSync(path.join(root, 'routes', 'citizen-scientist.js'), 'utf8'));
var users = strip(fs.readFileSync(path.join(root, 'model', 'users.js'), 'utf8'));

describe('R-DEL: every entry point applies the gate (source shape)', function() {
    it('data-api router.param gates BEFORE reading the cached session permissions', function() {
        var body = projectIdx.slice(projectIdx.indexOf("router.param('projectUrl'"));
        var gateAt = body.indexOf('deletedProjectAccess.gate(');
        var cacheAt = body.indexOf('sessionUser.permissions[project.project_id]');
        expect(gateAt).to.be.above(-1);
        expect(cacheAt).to.be.above(-1);
        expect(gateAt).to.be.below(cacheAt);
    });
    it('data-api router.param caps haveAccess on BOTH the fresh and the cached branch', function() {
        var body = projectIdx.slice(projectIdx.indexOf("router.param('projectUrl'"), projectIdx.indexOf("router.use('/:projectUrl/sites'"));
        expect(body.match(/deletedProjectAccess\.capHaveAccess\(/g) || []).to.have.length(2);
    });
    it('legacy HTML project page and CS page refuse deleted projects', function() {
        expect(projectPage).to.match(/deletedProjectAccess\.gate\(req, project\) === 'not-found'/);
        expect(csPage).to.match(/deletedProjectAccess\.isDeleted\(project\)/);
    });
    it('the non-super project list excludes deleted projects unconditionally', function() {
        var body = users.slice(users.indexOf('projectList: function'), users.indexOf('projectList: function') + 4000);
        expect(body).to.match(/whereExp\.push\('p\.deleted_at IS NULL'\);/);
        expect(body).to.not.match(/hasOwnProperty\('publicTemplates'\)\)\s*\{\s*whereExp\.push\('p\.deleted_at IS NULL'\)/);
    });
});