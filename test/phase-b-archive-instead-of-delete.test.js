var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * PHASE B (2026-09-09) — "Delete" is now an ARCHIVE.
 *
 * PLAN-delete-to-archive-post-flip-2026-09-05.md §2 step 4. The user-facing
 * Delete button, /delete-matching, and ingest's re-upload cleanup must all
 * ARCHIVE (set `archived_at`) rather than destroy rows.
 *
 * WHY THIS IS MORE THAN COSMETIC — the measurement that motivated it
 * (2026-09-09, live): `recordings` is append-synced to PostgreSQL by
 * recording_id and is in NO delete-capture mechanism, so a MariaDB
 * `DELETE FROM recordings` is PERMANENTLY INVISIBLE to PG. Post-6.4 every
 * recording list is PG-served. Measured that day: all 328 recordings deleted
 * by users were GONE from MariaDB but STILL PRESENT and unarchived on PG,
 * across 3 real projects (132/100/96 rows) — i.e. users deleted recordings
 * and they did not disappear. An `UPDATE ... archived_at` IS carried to PG,
 * by delta_sync mechanism 7 (COLUMN_UPDATE_CAPTURE), so archiving fixes the
 * stranding BY CONSTRUCTION rather than by adding a second delete path.
 *
 * These are SOURCE guards (no DB): they pin the decisions that are easy to
 * regress silently.
 */

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
var M = 'app/model/';
var R = 'app/routes/data-api/';

function body(src, startMarker, endMarker) {
    var i = src.indexOf(startMarker);
    expect(i, 'marker not found: ' + startMarker).to.be.greaterThan(-1);
    var j = src.indexOf(endMarker, i + startMarker.length);
    return src.slice(i, j > -1 ? j : src.length);
}

describe('Phase B — the delete transaction archives instead of destroying', function() {

    var src = read(M + 'recordings.js');
    var tx = body(src, 'delete: async function', '\n};');

    it('sets archived_at instead of DELETEing the recordings row', function() {
        expect(tx).to.contain('archiveRecordingsInArbimon');
        expect(tx).to.not.contain('deleteRecordingsFromArbimon');
    });

    it('does NOT touch the core API (ruling R1 — the one-way door)', function() {
        // The core trash move overwrites stream_source_files.sha1_checksum with
        // md5(random()) and has no untrash path. Archive must never call it.
        expect(tx).to.not.contain('this.deleteRecordingsInCoreAPI(');
    });

    it('does NOT delete the audio from S3 (the audio is what we preserve)', function() {
        expect(tx).to.not.contain('this.deleteRecordingsFromS3(');
    });

    it('does NOT destroy analysis results (§0 Premise — they stay attached)', function() {
        expect(tx).to.not.contain('this.deleteRecordingInAnalyses(');
    });

    it('still writes the recordings_deleted tombstone (ruling R2)', function() {
        expect(tx).to.contain('insertToRecordingsDeleted');
    });

    it('removes playlist membership explicitly (ruling C2)', function() {
        // The FK cascade used to do this as a side effect of the row delete.
        // With the row surviving, it must be an explicit DELETE.
        expect(tx).to.contain('removeArchivedFromPlaylists');
    });
});

describe('Phase B — the archive/restore statements', function() {

    var src = read(M + 'recordings.js');

    it('archive is idempotent (guarded by archived_at IS NULL)', function() {
        var fn = body(src, 'archiveRecordingsInArbimon: async function', '\n    },');
        expect(fn).to.contain('SET archived_at = NOW()');
        expect(fn).to.contain('archived_at IS NULL');
    });

    it('restore is idempotent (guarded by archived_at IS NOT NULL)', function() {
        var fn = body(src, 'restoreRecordingsInArbimon: async function', '\n    },');
        expect(fn).to.contain('SET archived_at = NULL');
        expect(fn).to.contain('archived_at IS NOT NULL');
    });

    it('archived_by is coerced to a number or NULL (no string interpolation of user input)', function() {
        var fn = body(src, 'archiveRecordingsInArbimon: async function', '\n    },');
        expect(fn).to.contain('Number(archivedBy)');
    });

    it('ingest re-upload cleanup archives rather than hard-deletes', function() {
        var fn = body(src, 'archiveBySiteAndUris: async function', '\n    },');
        expect(fn).to.contain('UPDATE recordings SET archived_at');
        expect(fn).to.contain('archived_at IS NULL');
        expect(src).to.not.contain('deleteBySiteAndUris: async function');
    });
});

describe('Phase B — archived_by actually reaches the model', function() {

    it('deleteMatching does NOT use Q.ninvoke to call delete', function() {
        // Q.ninvoke appends the node callback as the LAST argument, so it lands
        // in delete()'s 4th slot and a 5th positional arg is silently dropped
        // (verified empirically against the deployed image). That would make
        // every bulk archive record archived_by = NULL.
        var src = read(M + 'recordings.js');
        var fn = body(src, 'deleteMatching: function', '\n    },');
        expect(fn).to.not.contain("Q.ninvoke(Recordings, 'delete'");
        expect(fn).to.contain('archivedBy');
    });

    it('the routes pass the acting user id using the app-wide session shape', function() {
        var src = read(R + 'project/recordings.js');
        // The convention in this codebase is req.session.user.id (NOT
        // req.session.user_id, which is undefined and would silently store NULL).
        expect(src).to.contain('req.session.user && req.session.user.id');
        expect(src).to.not.contain('req.session.user_id');
    });

    it('the ingest route calls the archive method', function() {
        var src = read(R + 'ingest.js');
        expect(src).to.contain('archiveBySiteAndUris');
        expect(src).to.not.contain('deleteBySiteAndUris');
    });
});