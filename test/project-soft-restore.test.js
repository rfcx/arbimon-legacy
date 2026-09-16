/* jshint node:true */
'use strict';

/**
 * `POST /project/:projectUrl/soft-restore` + `model.projects.restoreLegacy`
 * (2026-09-16, rfcx-local OPEN-ITEMS §330 item (6);
 * design runbooks/DESIGN-2026-09-16-project-delete-one-path.md §3).
 *
 * This is the COMPENSATION surface of the bio-api-owned delete chain: legacy's
 * soft-delete is leg 2 of an ordered chain (legacy -> core -> insights-commit),
 * and if leg 3 or 4 fails bio-api must be able to undo it over HTTP. Every leg
 * being a reversible SOFT delete is the premise compensate-backwards stands on;
 * without this route the premise was true in the schema and false over HTTP.
 *
 * GUARD 1/2 are behavioural: they drive the SHIPPED model function against a
 * stubbed pool and assert the statement, its parameters, and the affected-row
 * semantics (1 = a delete was undone; 0 = already live, a true no-op — the
 * desired end state for a compensation call, reported not errored).
 * GUARD 3 is a source-shape guard so the route cannot silently lose its
 * permission gate (it must be the SAME gate as the delete: 'delete project').
 */

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var dbpool = require(path.join(ROOT, 'app', 'utils', 'dbpool.js'));
var projects = require(path.join(ROOT, 'app', 'model', 'projects.js'));

describe('projects.restoreLegacy (compensation counterpart of deleteLegacy)', function () {
    var realQuery, captured;

    beforeEach(function () {
        captured = [];
        realQuery = dbpool.query;
        dbpool.query = function (sql, values) {
            captured.push({ sql: String(sql), values: values });
            return Promise.resolve({ affectedRows: 1 });
        };
    });
    afterEach(function () {
        dbpool.query = realQuery;
    });

    it('SENDS the restore UPDATE, targeting the row and only a deleted one', function () {
        return projects.restoreLegacy(9888).then(function (n) {
            expect(captured, 'no statement reached the pool').to.have.length(1);
            expect(captured[0].sql).to.match(/UPDATE projects SET deleted_at = NULL, deleted_by = NULL/i);
            // The no-op guard: without this the statement would write NULL->NULL
            // on a live project and the count would be meaningless.
            expect(captured[0].sql).to.match(/deleted_at IS NOT NULL/i);
            expect(captured[0].values).to.contain(9888);
            expect(n, 'affectedRows not propagated').to.equal(1);
        });
    });

    it('reports 0 (not an error) when the project was not deleted', function () {
        dbpool.query = function () { return Promise.resolve({ affectedRows: 0 }); };
        return projects.restoreLegacy(9888).then(function (n) {
            expect(n).to.equal(0);
        });
    });

    it('never falls back to a raw affected-rows-less packet', function () {
        dbpool.query = function () { return Promise.resolve(undefined); };
        return projects.restoreLegacy(9888).then(function (n) {
            expect(n, 'undefined packet must read as 0, not crash or truthy').to.equal(0);
        });
    });
});

describe('the /soft-restore route shape', function () {
    it('exists, is gated by the SAME permission as the delete, and calls restoreLegacy', function () {
        var src = fs.readFileSync(path.join(ROOT, 'app', 'routes', 'data-api', 'project', 'index.js'), 'utf8');
        var r = src.slice(src.indexOf("router.post('/:projectUrl/soft-restore'"));
        expect(r, 'route missing').to.have.length.above(0);
        r = r.slice(0, r.indexOf('});'));
        expect(r, 'the restore must be gated by the SAME permission as the delete')
            .to.contain("haveAccess(req.project.project_id, 'delete project')");
        expect(r, 'route does not reach the model').to.contain('model.projects.restoreLegacy');
    });

    it('restoreLegacy goes through the pool-level promise API (never a callback-less connection query)', function () {
        var src = fs.readFileSync(path.join(ROOT, 'app', 'model', 'projects.js'), 'utf8');
        var rl = src.slice(src.indexOf('restoreLegacy:'));
        rl = rl.slice(0, rl.indexOf('\n    },'));
        expect(rl, 'restoreLegacy must use dbpool.query (the promisified pool API)')
            .to.contain('dbpool.query(');
        expect(rl, 'restoreLegacy must not use a bare connection handle')
            .to.not.contain("q.ninvoke(db, 'query'");
    });
});
