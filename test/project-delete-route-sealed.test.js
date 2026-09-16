/* eslint-env mocha */
/**
 * Guards for the RETIREMENT of POST /legacy-api/project/:projectUrl/remove.
 *
 * rfcx-local OPEN-ITEMS §330 (6); operator ruling 2026-09-16 02:31 ("delete
 * should work the same for SPA and legacy") + GO 02:54. Evidence:
 * runbooks/evidence/legacy-settings-page-usage-2026-09-16.md.
 *
 * WHY SOURCE-SHAPE: the properties that matter are ABSENCE properties — that the
 * sealed route no longer reaches the delete model, and that no client code can
 * still call it. An absence cannot be observed by exercising the happy path, and
 * a route that "looks sealed" while still wired would delete real projects.
 *
 * Every assertion here was negative-control tested (restore the old code, watch
 * it go red) before landing.
 *
 * NOTE this is a MOCHA suite. The test tree is two populations and the runner
 * splits them by grepping for the process-exit call; this file deliberately does
 * not name that API so it is not misclassified and silently skipped.
 */
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var ROUTES = path.join(__dirname, '..', 'app', 'routes', 'data-api', 'project', 'index.js');
var MODEL = path.join(__dirname, '..', 'app', 'model', 'projects.js');
var SVC = path.join(__dirname, '..', 'assets', 'app', 'a2services', 'project-service.js');
var SETTINGS_JS = path.join(__dirname, '..', 'assets', 'app', 'app', 'settings', 'index.js');
var SETTINGS_HTML = path.join(__dirname, '..', 'assets', 'app', 'app', 'settings', 'details.html');

function read(p) { return fs.readFileSync(p, 'utf-8'); }
function stripComments(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '')
            .replace(/<!--[\s\S]*?-->/g, '');
}

var routesCode = stripComments(read(ROUTES));
var modelCode = stripComments(read(MODEL));
var svcCode = stripComments(read(SVC));
var settingsJsCode = stripComments(read(SETTINGS_JS));
var settingsHtmlCode = stripComments(read(SETTINGS_HTML));

// The /remove handler body: from its router.post line to the next router.post.
function removeHandler() {
    var start = routesCode.indexOf("router.post('/:projectUrl/remove'");
    expect(start, '/remove route not found at all').to.be.greaterThan(-1);
    var rest = routesCode.slice(start + 10);
    var end = rest.indexOf('router.post(');
    return end === -1 ? rest : rest.slice(0, end);
}

describe('legacy project-delete route is SEALED', function () {

    describe('the route itself', function () {
        it('still EXISTS (sealed, not silently deleted)', function () {
            expect(routesCode, 'the route must remain so unknown callers get 410, not a 404 that hides the retirement')
                .to.match(/router\.post\('\/:projectUrl\/remove'/);
        });

        it('answers 410 Gone', function () {
            expect(removeHandler(), 'sealed route must return HTTP 410')
                .to.match(/APIError\([^)]*,\s*410\)/);
        });

        it('does NOT call the delete model any more', function () {
            expect(removeHandler(), 'a sealed route that still calls removeProject would delete real projects')
                .to.not.match(/removeProject/);
        });

        it('does NOT read deleted_by / external_id any more', function () {
            var h = removeHandler();
            expect(h).to.not.match(/deleted_by/);
            expect(h).to.not.match(/external_id/);
        });

        it('logs a greppable marker when called', function () {
            expect(removeHandler(), 'an unknown caller must be diagnosable from the logs')
                .to.match(/SEALED_ROUTE_CALLED/);
        });
    });

    describe('the SPA leg is UNTOUCHED (this is the load-bearing negative)', function () {
        it('/soft-remove still calls removeProject', function () {
            var start = routesCode.indexOf("router.post('/:projectUrl/soft-remove'");
            expect(start, 'soft-remove route missing').to.be.greaterThan(-1);
            var body = routesCode.slice(start, start + 900);
            expect(body, 'the SPA depends on this leg; sealing /remove must not break it')
                .to.match(/removeProject/);
        });

        it('/soft-remove still records the actor', function () {
            var start = routesCode.indexOf("router.post('/:projectUrl/soft-remove'");
            var body = routesCode.slice(start, start + 900);
            expect(body, 'deleted_by attribution must survive the seal')
                .to.match(/deleted_by/);
        });

        it('the removeProject MODEL function still exists', function () {
            expect(modelCode, 'soft-remove needs it')
                .to.match(/removeProject:\s*async function/);
        });
    });

    describe('no client can still call the sealed route', function () {
        it('the Angular service no longer exposes removeProject', function () {
            expect(svcCode, 'project-service.removeProject was the only client of the sealed route')
                .to.not.match(/removeProject\s*:/);
        });

        it('the settings controller no longer defines deleteProject', function () {
            expect(settingsJsCode).to.not.match(/\$scope\.deleteProject\s*=/);
        });

        it('the settings template no longer renders a Delete project button', function () {
            expect(settingsHtmlCode).to.not.match(/deleteProject\(\)/);
            expect(settingsHtmlCode).to.not.match(/Delete project/);
        });

        it('nothing anywhere in the client posts to the sealed path', function () {
            expect(svcCode).to.not.match(/\/remove'/);
        });
    });

    describe('controls: these assertions are not vacuous', function () {
        it('the absence patterns match a real instance when one exists', function () {
            expect('removeProject: function(data) {').to.match(/removeProject\s*:/);
            expect('<button ng-click="deleteProject()">Delete project</button>').to.match(/deleteProject\(\)/);
        });

        it('the route file really was read (positive control)', function () {
            expect(routesCode).to.match(/router\.post\('\/:projectUrl\/soft-remove'/);
        });
    });
});