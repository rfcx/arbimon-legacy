/* jshint node:true */
'use strict';

/**
 * REGRESSION GUARDS — a CONNECTION-scoped `query()` must always pass a callback.
 *
 * Measured on the demo tier 2026-09-13 against the real P7 PG write adapter
 * (rfcx-local OPEN-ITEMS §300 item 10,
 * runbooks/FINDING-2026-09-12-spa-rename-no-legacy-propagation.md):
 *
 *   `app/utils/dbpool-pg.js` makeWriteConnAdapter defines
 *
 *       conn.query = function (sql, values, cb) {
 *           ...
 *           if (!cb) { return makeStreamQuery(conn, sql, values); }
 *
 *   i.e. WITHOUT a callback it returns a LAZY `{stream}` object and the
 *   statement is NEVER SENT. `mysql@2.18`'s Connection.query, by contrast,
 *   `_enqueue`s the query object whether or not a callback was given
 *   (lib/Connection.js:196-198).
 *
 *   So `model.projects.update`'s old two-arg form
 *       (db ? db.query : dbpool.query)(sql, vals)
 *   worked for years on MariaDB and became a SILENT NO-OP at the DB_ENGINE=pg
 *   flip: the UPDATE never ran, `q.all` resolved on the stub, the surrounding
 *   transaction committed EMPTY, and the route honestly reported success.
 *   Every SPA project rename diverged the planes with no error anywhere
 *   (project 9806 broken 17 days; 9809 broken mid-flip).
 *
 *   `projects.deleteLegacy` carried the identical shape — project soft-delete
 *   did nothing under PG (confirmed in-pod: deleted_at null -> null).
 *
 * GUARD 1 is behavioural: it drives the SHIPPED model function against a fake
 * connection that reproduces the adapter's contract (no callback => lazy stub,
 * nothing executed) and asserts the statement really reached the connection.
 * GUARD 2 is a source-shape guard over every connection-scoped call site.
 */

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var projects = require(path.join(ROOT, 'app', 'model', 'projects.js'));

/**
 * A stand-in for the P7 write adapter that enforces its ACTUAL contract:
 * a query WITHOUT a callback is not executed — it yields the lazy stub.
 */
function fakeConn() {
    var conn = { executed: [], stubbed: 0 };
    conn.query = function (sql, values, cb) {
        if (typeof values === 'function') { cb = values; values = undefined; }
        if (!cb) {
            // exactly what dbpool-pg.js does: nothing runs until .stream()
            conn.stubbed++;
            return { stream: function () { throw new Error('stream() not expected here'); } };
        }
        conn.executed.push({ sql: String(sql), values: values });
        setImmediate(function () { cb(null, { affectedRows: 1 }, []); });
    };
    return conn;
}

describe('connection-scoped queries must pass a callback (PG adapter contract)', function () {

    it('projects.update SENDS the UPDATE when given a connection', function () {
        var conn = fakeConn();

        return projects.update({ project_id: 9888, name: 'New Name', url: 'new-slug' }, conn)
            .then(function () {
                // The defect: zero executed statements and one lazy stub.
                expect(conn.stubbed, 'query() was called without a callback (lazy stub, never sent)').to.equal(0);
                expect(conn.executed, 'no statement reached the connection').to.have.length(1);
                expect(conn.executed[0].sql).to.match(/UPDATE projects/i);
                // the row must actually be targeted
                expect(conn.executed[0].values).to.contain(9888);
            });
    });

    it('projects.deleteLegacy SENDS the soft-delete UPDATE', function () {
        var conn = fakeConn();

        return projects.deleteLegacy(9888, conn).then(function () {
            expect(conn.stubbed, 'deleteLegacy queried without a callback (lazy stub, never sent)').to.equal(0);
            expect(conn.executed).to.have.length(1);
            expect(conn.executed[0].sql).to.match(/UPDATE projects SET deleted_at/i);
            expect(conn.executed[0].values).to.contain(9888);
        });
    });

    // ---- source-shape guard: catch the class, not just these two instances ----
    it('no connection-scoped query() in projects.js omits its callback', function () {
        var src = fs.readFileSync(path.join(ROOT, 'app', 'model', 'projects.js'), 'utf8');

        // The exact two-arg extract-and-call shape that caused this defect.
        expect(src, 'the unbound `(db? db.query : dbpool.query)(...)` extract is back')
            .to.not.contain('(db? db.query : dbpool.query)(');
        expect(src, 'the unbound `(db ? db.query : dbpool.query)(...)` extract is back')
            .to.not.contain('(db ? db.query : dbpool.query)(');

        // deleteLegacy must not go back to a bare `db.query(` call.
        var dl = src.slice(src.indexOf('deleteLegacy:'));
        dl = dl.slice(0, dl.indexOf('\n    },'));
        expect(dl, 'deleteLegacy must send its statement via q.ninvoke(db, \'query\', ...)')
            .to.contain("q.ninvoke(db, 'query'");
    });

    it('the adapter contract this guard encodes is still the real one', function () {
        // If dbpool-pg ever starts executing callback-less queries, this guard's
        // premise changes and the fake above would be lying. Pin the branch.
        var pg = fs.readFileSync(path.join(ROOT, 'app', 'utils', 'dbpool-pg.js'), 'utf8');
        expect(pg, 'makeWriteConnAdapter no longer returns a lazy stub without a callback')
            .to.contain('if (!cb) { return makeStreamQuery(conn, sql, values); }');
    });
});