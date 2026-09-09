var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — tags.addTo must be IDEMPOTENT on the recording_tags
 * unique key (recording_id, tag_id, user_id).
 *
 * Live bug (rfcx-local OPEN-ITEMS §292 follow-up, prompt
 * TAG-WRITE-DUPLICATE-KEY-2026-09-09.md): before the fix, a user re-adding a
 * tag they had ALREADY placed on the same recording got an unhandled
 * ER_DUP_ENTRY and a 500 — 21 user-facing failures in 7 d across 4 users
 * (one user 6x on one recording in 39 s). The retries "succeeded" only
 * because the row was already there. A duplicate is the DESIRED end state,
 * so it must resolve, not 500.
 *
 * Verified by executing the REAL model function against a scratch
 * MariaDB 11.4 (same major as prod) with the verbatim prod constraints:
 *   - pre-fix:  second identical add -> REJECTED ER_DUP_ENTRY (the 500)
 *   - post-fix: second identical add -> RESOLVED, echo id = EXISTING row's pk
 *   - 8 concurrent identical adds -> 8 resolved, exactly 1 durable row
 *   - positive controls: new tag by id and by text still create rows
 *   - first-write-wins: the original t0/f0/t1/f1 box survives later adds
 *
 * These guards pin the SHAPE that makes that behaviour possible. Note they
 * are source-shape assertions: the behavioural proof lives in the harness
 * run recorded in the PR (card 20260909-method-testing-002: a source-shape
 * test cannot see SQL problems — if you change the query, execute it).
 */

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

var SRC = read('app/model/tags.js');

function addToInsert() {
    var i = SRC.indexOf('INSERT INTO recording_tags(');
    expect(i, 'the recording_tags INSERT must exist').to.be.greaterThan(-1);
    // Bound by the closing of the query string, not a character count.
    var end = SRC.indexOf('].\n', i);
    if (end < 0 || end - i > 4000) end = i + 4000;
    return { raw: SRC.slice(i, end), clean: stripComments(SRC.slice(i, end)) };
}

describe('tags.addTo — duplicate-key idempotence', function() {

    it('the recording_tags INSERT carries ON DUPLICATE KEY UPDATE', function() {
        var q = addToInsert();
        expect(q.clean).to.contain('ON DUPLICATE KEY UPDATE');
    });

    it('the duplicate branch reports the EXISTING row pk via LAST_INSERT_ID', function() {
        var q = addToInsert();
        // Without the LAST_INSERT_ID(recording_tag_id) idiom, the duplicate
        // branch's OkPacket has insertId 0 and the created-row echo below the
        // INSERT would reject with 'Failed to create recording tag' — turning
        // the fix back into a user-facing error.
        expect(q.clean).to.contain('LAST_INSERT_ID(recording_tag_id)');
    });

    it('the duplicate branch is a NO-OP: it overwrites nothing (first-write-wins)', function() {
        var q = addToInsert();
        var upd = q.clean.slice(q.clean.indexOf('ON DUPLICATE KEY UPDATE'));
        // The only assignment allowed in the duplicate branch is the pk
        // self-assignment that carries LAST_INSERT_ID. Updating t0/f0/t1/f1
        // or datetime would silently REPLACE a user's earlier annotation box
        // on a re-click — the original annotation must win.
        ['t0 =', 'f0 =', 't1 =', 'f1 =', 'datetime =', 'site_id =', 'user_id ='].forEach(function(col) {
            expect(upd, 'duplicate branch must not overwrite ' + col).to.not.contain(col);
        });
    });

    it('the echo path still rejects when insertId is absent (a real failure cannot masquerade)', function() {
        var i = SRC.indexOf("'Failed to create recording tag'");
        expect(i, 'the insertId guard must remain').to.be.greaterThan(-1);
        expect(stripComments(SRC.slice(Math.max(0, i - 600), i))).to.contain('insertId');
    });

});
