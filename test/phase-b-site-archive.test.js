var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * PHASE B, part 2 (2026-09-09) — removing a SITE archives its recordings.
 *
 * `recordings.delete()` was converted to an archive in #1847, but site removal
 * kept its OWN destructive copy: `sites.js` hard-DELETEd `pattern_matching_rois`
 * for every recording on the site. That was the last destructive recording
 * path in the app, and it contradicts the same two rulings the recording-level
 * change rests on (§0 Premise: analysis results stay attached; and a MariaDB
 * hard delete is invisible to the PG read side, while `archived_at` is carried
 * by delta_sync mechanism 7).
 *
 * Blast radius, measured in Loki over 30 d before changing anything: the path
 * ran 3 times. Low volume — but destructive and irreversible when it does.
 *
 * SECOND DEFECT FIXED HERE (found while measuring the first): the error
 * handling destroyed its own cause. `deleteInCoreAPI` threw
 * `new Error('Failed to delete site')` and `removeSite`'s catch logged the bare
 * error then threw a FRESH Error with the SAME text — so 30 d of production
 * logs contain 20 x `err Error: Failed to delete site` with no way to tell a
 * core-API rejection from a DB failure, and the HTTP status discarded.
 */

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
var S = 'app/model/sites.js';

function body(src, startMarker, endMarker) {
    var i = src.indexOf(startMarker);
    expect(i, 'marker not found: ' + startMarker).to.be.greaterThan(-1);
    var j = src.indexOf(endMarker, i + startMarker.length);
    return src.slice(i, j > -1 ? j : src.length);
}

describe('Phase B — site removal archives instead of destroying', function() {

    var src = read(S);
    var fn = body(src, 'removeSite: async function', '\n    /**');

    it('removeSite archives the site\'s recordings', function() {
        expect(fn).to.contain('archiveRecordingsBySite');
    });

    it('removeSite no longer hard-deletes analysis results', function() {
        expect(fn).to.not.contain('this.deleteRecordingInAnalyses(');
    });

    it('the archive is idempotent and column-scoped (so mechanism 7 carries it)', function() {
        var a = body(src, 'archiveRecordingsBySite: async function', '\n    },');
        expect(a).to.contain('SET archived_at = NOW()');
        expect(a).to.contain('archived_at IS NULL');
    });

    it('archiving a site removes playlist membership (ruling C2)', function() {
        var a = body(src, 'archiveRecordingsBySite: async function', '\n    },');
        expect(a).to.contain('DELETE FROM playlist_recordings');
    });

    it('pattern_matching_rois is NOT hard-deleted by the new path', function() {
        var a = body(src, 'archiveRecordingsBySite: async function', '\n    },');
        expect(a).to.not.contain('DELETE FROM pattern_matching_rois');
    });
});

describe('Phase B — site-delete errors keep their cause', function() {

    var src = read(S);

    it('deleteInCoreAPI names the layer and carries the HTTP status', function() {
        var fn = body(src, 'deleteInCoreAPI: async function', '\n    },');
        expect(fn).to.contain('core API refused stream delete');
        expect(fn).to.contain('e.statusCode = response.statusCode');
        // the ambiguous text must be gone from this function
        expect(fn).to.not.contain("new Error('Failed to delete site')");
    });

    it('removeSite wraps the cause instead of discarding it', function() {
        var fn = body(src, 'removeSite: async function', '\n    /**');
        expect(fn).to.contain('wrapped.cause = err');
        expect(fn).to.not.contain("throw new Error('Failed to delete site')");
    });

    it('softRemoveAllSites wraps the cause too', function() {
        var fn = body(src, 'softRemoveAllSites: async function', '\n    //');
        expect(fn).to.contain('wrapped.cause = err');
        expect(fn).to.not.contain("throw new Error('Failed to delete site')");
    });

    it('no bare ambiguous throw survives anywhere in the file', function() {
        expect(src).to.not.contain("throw new Error('Failed to delete site')");
    });
});