var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — per-recording reads/writes must honour the ARCHIVE scope.
 *
 * Found by IRR on OPEN-ITEMS §292 (the fix I had just shipped left this gap).
 *
 * `tags.getForType` — the project-wide tag view — applies
 * `recordingArchiveScope('r','active')`: Phase A "hide-by-parent", which
 * deliberately hides tags on ARCHIVED recordings. The per-recording reads did
 * not, so the two views disagreed about the same rows.
 *
 * Not hypothetical since the L1 retro-archive (2026-09-08): 32,473 recordings
 * are archived, of which 4 carry tags and 2 carry 5 annotations.
 *
 * The WRITE paths mattered more than the reads: a user could ADD a tag or an
 * annotation to an archived recording and then never see it again, because
 * every aggregate view hides it. Scoping the read alone would have created a
 * write-only black hole.
 *
 * Verified on live data (in the PR): archived recording 1 -> 0 rows under the
 * new shape, while an active recording with 214 tags returns 214 unchanged.
 */

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
var M = 'app/model/';
var R = 'app/routes/data-api/project/';

describe('archive scope — per-recording READS', function() {

    it('tags.getFor joins recordings and applies the active scope', function() {
        var src = read(M + 'tags.js');
        var i = src.indexOf('getFor: async function');
        expect(i).to.be.greaterThan(-1);
        var fn = src.slice(i, i + 2000);
        expect(fn, 'must join recordings to reach archived_at')
            .to.contain('JOIN recordings r ON r.recording_id = RT.recording_id');
        expect(fn, 'must apply the shared archive scope helper')
            .to.contain("recordingArchiveScope('r', 'active')");
    });

    it('getAnnotationsFor applies the active scope', function() {
        var src = read(M + 'soundscape-composition.js');
        var i = src.indexOf('getAnnotationsFor: function');
        var fn = src.slice(i, i + 2000);
        expect(fn).to.contain("recordingArchiveScope('r', 'active')");
    });

    it('both reads use the SHARED helper, not a hand-rolled predicate', function() {
        // A hand-rolled "archived_at IS NULL" would drift from the helper if
        // the archive semantics ever change (e.g. an 'all' mode for admins).
        var t = read(M + 'tags.js');
        var s = read(M + 'soundscape-composition.js');
        var iT = t.indexOf('getFor: async function');
        var iS = s.indexOf('getAnnotationsFor: function');
        expect(t.slice(iT, iT + 2000)).to.not.contain('archived_at IS NULL');
        expect(s.slice(iS, iS + 2000)).to.not.contain('archived_at IS NULL');
    });
});

describe('archive scope — per-recording WRITES must refuse archived rows', function() {

    it('the tag PUT route refuses an archived recording', function() {
        var src = read(R + 'tags.js');
        var i = src.indexOf("router.put('/:resource/:id'");
        expect(i).to.be.greaterThan(-1);
        var fn = src.slice(i, i + 1600);
        expect(fn, 'findByIdAsync is unscoped, so the route must check')
            .to.contain('recording[0].archived_at');
        var checkIdx = fn.indexOf('recording[0].archived_at');
        var writeIdx = fn.indexOf('addTagTo');
        expect(checkIdx, 'the guard must precede the write').to.be.lessThan(writeIdx);
    });

    it('annotate refuses an archived recording in its ownership check', function() {
        var src = read(M + 'soundscape-composition.js');
        var i = src.indexOf('annotate: function');
        var fn = src.slice(i, i + 1800);
        expect(fn).to.contain("recordingArchiveScope('r', 'active')");
        var scopeIdx = fn.indexOf("recordingArchiveScope('r', 'active')");
        var schemaIdx = fn.indexOf('annotateSchema');
        expect(scopeIdx, 'the guard must precede the write path')
            .to.be.lessThan(schemaIdx);
    });

    it('the §292 project scoping is still present (no regression)', function() {
        // This commit edits the same functions; make sure the previous fix
        // was not clobbered while adding the archive scope.
        var t = read(M + 'tags.js');
        var s = read(M + 'soundscape-composition.js');
        expect(t).to.contain('requires projectId');
        expect(t).to.contain('RT.site_id IN');
        expect(s).to.contain('requires options.project');
        expect(s).to.contain('s.project_id = ?');
    });
});