var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * STRUCTURAL GUARANTEE (2026-09-09): a recording cannot be hard-deleted
 * through the application.
 *
 * The Delete → Archive arc converted every destructive recording path to an
 * archive (arbimon-legacy #1847 recordings, #1851 sites). This suite is the
 * ratchet that keeps it that way: it scans the WHOLE app tree, so a new
 * `DELETE FROM recordings` in a file nobody thought to review fails CI rather
 * than shipping.
 *
 * WHY A TREE SCAN AND NOT A UNIT TEST. The original defect was never a single
 * bad function -- it was that destruction lived in several places at once
 * (recordings.js, sites.js, an ingest route), so fixing the obvious one left
 * the class armed. Enumeration is the only honest test of "impossible".
 *
 * WHAT IS DELIBERATELY ALLOWED:
 *  - `DELETE FROM playlist_recordings` -- ruling C2: archiving REMOVES
 *    playlist membership. It is not the recording.
 *  - `DELETE FROM recordings_deleted`  -- the TOMBSTONE table (jobs/ retention),
 *    not the recordings table. Matching on prefix alone would flag it, which is
 *    exactly the false positive this suite must not produce.
 *  - `scripts/admin/` -- operator-run tooling, not reachable from the API.
 *    Excluded on purpose and asserted separately below so the exclusion cannot
 *    silently widen.
 */

var ROOT = path.join(__dirname, '..');

function walk(dir, acc) {
    acc = acc || [];
    var entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return acc; }
    entries.forEach(function (e) {
        var full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (['node_modules', '.git', 'coverage', 'dist', 'public'].indexOf(e.name) !== -1) return;
            walk(full, acc);
        } else if (e.name.endsWith('.js')) {
            acc.push(full);
        }
    });
    return acc;
}

// `DELETE FROM recordings` but NOT `recordings_deleted` / `playlist_recordings`
// (negative lookahead on the suffix, and a guard on the preceding token).
var HARD_DELETE = /DELETE\s+FROM\s+`?recordings`?(?!\s*_)(?!_)/i;

function offenders(files) {
    return files.filter(function (f) {
        var src = fs.readFileSync(f, 'utf8');
        return src.split('\n').some(function (line) {
            if (!HARD_DELETE.test(line)) return false;
            // ignore prose: comment lines describing the removed behaviour
            var t = line.trim();
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
            return true;
        });
    }).map(function (f) { return path.relative(ROOT, f); });
}

describe('a recording cannot be hard-deleted through the app', function () {

    it('no `DELETE FROM recordings` anywhere under app/', function () {
        var found = offenders(walk(path.join(ROOT, 'app')));
        expect(found, 'destructive SQL found in: ' + found.join(', ')).to.deep.equal([]);
    });

    it('no `DELETE FROM recordings` under jobs/ or bin/', function () {
        var found = offenders(walk(path.join(ROOT, 'jobs')).concat(walk(path.join(ROOT, 'bin'))));
        expect(found, 'destructive SQL found in: ' + found.join(', ')).to.deep.equal([]);
    });

    it('the destructive helpers are GONE, not merely uncalled', function () {
        // Keeping a callerless destructive helper is how the behaviour comes
        // back: one call site restores it. They must not exist.
        var rec = fs.readFileSync(path.join(ROOT, 'app/model/recordings.js'), 'utf8');
        var sites = fs.readFileSync(path.join(ROOT, 'app/model/sites.js'), 'utf8');
        expect(rec).to.not.contain('deleteRecordingsFromArbimon:');
        expect(rec).to.not.contain('deleteRecordingsInCoreAPI:');
        expect(rec).to.not.contain('deleteRecordingsFromS3:');
        expect(rec).to.not.contain('deleteRecordingInAnalyses:');
        expect(sites).to.not.contain('deleteRecordingInAnalyses:');
    });

    it('the three API entry points still resolve to an ARCHIVE', function () {
        var rec = fs.readFileSync(path.join(ROOT, 'app/model/recordings.js'), 'utf8');
        var sites = fs.readFileSync(path.join(ROOT, 'app/model/sites.js'), 'utf8');
        var ingest = fs.readFileSync(path.join(ROOT, 'app/routes/data-api/ingest.js'), 'utf8');
        // POST /:projectUrl/recordings/delete and /delete-matching
        expect(rec).to.contain('archiveRecordingsInArbimon');
        // POST /ingest/recordings/delete
        expect(ingest).to.contain('archiveBySiteAndUris');
        // site removal
        expect(sites).to.contain('archiveRecordingsBySite');
    });

    it('the tombstone and playlist deletes are still allowed (no false positive)', function () {
        // Positive control for the REGEX itself: if these were flagged, the
        // guard would be over-broad and someone would weaken it.
        expect(HARD_DELETE.test('DELETE FROM playlist_recordings WHERE recording_id IN (1)')).to.equal(false);
        expect(HARD_DELETE.test('DELETE FROM recordings_deleted WHERE x')).to.equal(false);
        // ...and it DOES catch the real thing:
        expect(HARD_DELETE.test('DELETE FROM recordings WHERE recording_id IN (1)')).to.equal(true);
        expect(HARD_DELETE.test('DELETE FROM `recordings` WHERE site_id = ?')).to.equal(true);
    });

    it('the one surviving hard delete is operator-only tooling, not API-reachable', function () {
        // scripts/admin/verify-recs.js still hard-deletes rows whose S3 object
        // is missing. It is deliberately out of scope: not required by any
        // route, job or manifest. This test pins BOTH facts -- that it is the
        // only one, and that nothing wires it up -- so the exclusion cannot
        // quietly widen into the API surface.
        var scripts = offenders(walk(path.join(ROOT, 'scripts')));
        expect(scripts).to.deep.equal(['scripts/admin/verify-recs.js']);

        var appFiles = walk(path.join(ROOT, 'app')).concat(walk(path.join(ROOT, 'jobs')));
        var wired = appFiles.filter(function (f) {
            return fs.readFileSync(f, 'utf8').indexOf('verify-recs') !== -1;
        });
        expect(wired, 'verify-recs is referenced by: ' + wired.join(', ')).to.deep.equal([]);
    });
});