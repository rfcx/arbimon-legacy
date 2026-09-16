var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * STEP 6 (2026-09-16) — the user-facing RESTORE of archived recordings.
 *
 * PLAN-delete-to-archive-post-flip-2026-09-05.md §2 step 6, kicked off from
 * ARCHIVE-UI-CONTINUATION-2026-09-09.md. The backend archived instead of
 * deleting since 09-09 (#1847) but nothing reached `restoreRecordingsInArbimon`
 * over HTTP; the dialog told users to "contact support".
 *
 * SOURCE guards (no DB) for the decisions that would regress silently:
 *
 *  1. Restore is gated by the SAME permission as the archive it undoes.
 *  2. Eligibility is enforced in the MODEL, on two axes: the recording's
 *     OWNING project (mirrors getDeletedRecordingData — an importing project
 *     cannot restore a shared site's rows) and `archived_by IS NOT NULL`.
 *     The second axis is the load-bearing one: rows with a NULL actor are
 *     SYSTEM archives — the L0/L1 ghost retro-archive, whose core segments
 *     were trashed + sha1-scrambled by the old delete (PLAN step 7 un-trash
 *     not started), and the 09-09 removed-site backfill. Measured on the
 *     replica 2026-09-16: 5,715,607 + 30,917 system rows vs 1,888 user rows.
 *     Restoring a ghost lists a recording with no playable audio.
 *  3. There is NO bare `/archive` route: `/delete` IS the archive, and it
 *     also drops playlist membership (C2) and writes the R2 tombstone. A
 *     second route calling `archiveRecordingsInArbimon` alone would skip
 *     both.
 *  4. Restore does not touch playlists (C2: "restore does not re-add") and
 *     does not delete the tombstone (R2) — operator rulings, not omissions.
 *  5. The list projection exposes `archived_at`/`archived_by` so the SPA can
 *     tell a restorable row from a ghost without a second round-trip.
 */

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
var M = 'app/model/';
var R = 'app/routes/data-api/project/';

function body(src, startMarker, endMarker) {
    var i = src.indexOf(startMarker);
    expect(i, 'marker not found: ' + startMarker).to.be.greaterThan(-1);
    var j = src.indexOf(endMarker, i + startMarker.length);
    return src.slice(i, j > -1 ? j : src.length);
}

describe('Step 6 — the /restore route', function() {

    var routes = read(R + 'recordings.js');

    it('exists and is a POST', function() {
        expect(routes).to.contain("router.post('/restore'");
    });

    it('is gated by the SAME permission as /delete', function() {
        var del = body(routes, "router.post('/delete'", "\n});");
        var res = body(routes, "router.post('/restore'", "\n});");
        var gate = 'req.haveAccess(req.project.project_id, "manage project recordings")';
        expect(del).to.contain(gate);
        expect(res).to.contain(gate);
    });

    it('rejects an empty id list before touching the model', function() {
        var res = body(routes, "router.post('/restore'", "\n});");
        expect(res).to.contain("missing arguments");
        expect(res.indexOf('missing arguments')).to.be.lessThan(res.indexOf('model.recordings.restore('));
    });

    it('does NOT add a bare /archive route (delete IS the archive: C2 + R2 ride on it)', function() {
        expect(routes).to.not.contain("router.post('/archive'");
        expect(routes).to.not.contain('archiveRecordingsInArbimon(');
    });
});

describe('Step 6 — restore eligibility lives in the model', function() {

    var src = read(M + 'recordings.js');

    it('getRestorableRecordingIds scopes to the OWNING project and to user-archived rows', function() {
        var fn = body(src, 'getRestorableRecordingIds: async function', '\n    },');
        expect(fn).to.contain('s.project_id = ${project_id}');
        expect(fn).to.contain('archived_at IS NOT NULL');
        expect(fn).to.contain('archived_by IS NOT NULL');
    });

    it('getRestorableRecordingIds guards the empty IN () (a syntax error on both engines)', function() {
        var fn = body(src, 'getRestorableRecordingIds: async function', '\n    },');
        expect(fn).to.contain('recIds.length === 0');
    });

    it('restore() flips ONLY the eligible subset, inside one transaction', function() {
        var fn = body(src, '    restore: async function', '\n    },');
        expect(fn).to.contain('beginTransaction');
        expect(fn).to.contain('getRestorableRecordingIds(');
        expect(fn).to.contain('restoreRecordingsInArbimon(eligible');
        expect(fn).to.contain('db.commit()');
        expect(fn).to.contain('db.rollback()');
    });

    it('restore() reports what it skipped (honest partial-batch response)', function() {
        var fn = body(src, '    restore: async function', '\n    },');
        expect(fn).to.contain('restored: eligible');
        expect(fn).to.contain('skipped: skipped');
    });

    it('restore() does not touch playlists (C2) or the tombstone (R2)', function() {
        var fn = body(src, '    restore: async function', '\n    },');
        expect(fn).to.not.contain('playlist');
        expect(fn).to.not.contain('recordings_deleted');
    });

    it('the underlying statement is still idempotent (archived_at IS NOT NULL)', function() {
        var fn = body(src, 'restoreRecordingsInArbimon: async function', '\n    },');
        expect(fn).to.contain('SET archived_at = NULL');
        expect(fn).to.contain('archived_at IS NOT NULL');
    });
});

describe('Step 6 — the list projection carries the archive columns', function() {

    it('findProjectRecordings list rows include archived_at and archived_by', function() {
        var src = read(M + 'recordings.js');
        var fn = body(src, 'const orderedIds = results[listIndex][0].map', 'ORDER BY FIELD(r.recording_id');
        expect(fn).to.contain('r.archived_at');
        expect(fn).to.contain('r.archived_by');
    });
});