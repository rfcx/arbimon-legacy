var expect = require('chai').expect;
var fs = require('fs');
var os = require('os');
var path = require('path');

var isEmptyExportFile = require('../jobs/services/export-error').isEmptyExportFile;

/**
 * REGRESSION GUARD — the empty-export silence.
 *
 * An export whose filters match 0 recordings produces a 0-BYTE file: the CSV
 * header is written inside writeChunk(), which never runs when there are no
 * chunks. Uploading that hit the s3-proxy zero-byte write guard
 * (EmptyObjectRejected — correct, a 0-byte object is definitionally corrupt),
 * which crashed the consumer ~12x/day for 8 days; and after the crash was fixed
 * the user was still left with SILENCE — the row went terminal and no mail was
 * ever sent.
 *
 * Measured instance: project 10073 'projeto teste'. The request was VALID —
 * filter 78453 is a real project_class in that project (Bufo hololius / Common
 * Song) — against a project with 0 recordings. The user asked once on
 * 2026-09-01, got nothing, and never tried again.
 *
 * "0 results" is a successful outcome: email the user, mark the row processed.
 *
 * ⚠️ The most important case here is the NEGATIVE one: a missing/unstattable
 * file must NOT report as "empty", or an unrelated fs fault would be silently
 * reported to the user as "no matching recordings" — turning a real failure
 * into a false, confident answer.
 */
describe('isEmptyExportFile', function () {

    var dir;
    before(function () {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-empty-'));
    });
    after(function () {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    });

    function write (name, content) {
        var p = path.join(dir, name);
        fs.writeFileSync(p, content);
        return p;
    }

    it('reports a 0-byte file as empty (the real empty-export shape)', function () {
        expect(isEmptyExportFile(write('empty.csv', ''))).to.equal(true);
    });

    it('does NOT report a header-only file as empty', function () {
        expect(isEmptyExportFile(write('header.csv', 'filename,site,day\n'))).to.equal(false);
    });

    it('does NOT report a populated file as empty', function () {
        expect(isEmptyExportFile(write('rows.csv', 'filename,site,day\na.wav,s1,2026-01-01\n'))).to.equal(false);
    });

    it('does NOT report a MISSING file as empty (an fs fault is not a 0-row result)', function () {
        expect(isEmptyExportFile(path.join(dir, 'nope.csv'))).to.equal(false);
    });

    it('does NOT report an undefined/null/empty path as empty', function () {
        // collectData passes filePath=undefined on early failures; that is an
        // ERROR path and must never be answered with "no matching recordings".
        expect(isEmptyExportFile(undefined)).to.equal(false);
        expect(isEmptyExportFile(null)).to.equal(false);
        expect(isEmptyExportFile('')).to.equal(false);
    });

    /**
     * PINS THE EARLY RETURN ITSELF.
     *
     * The three assertions above pass EITHER WAY -- with the `if (!filePath)`
     * guard, or without it, because fs.statSync(undefined) throws and the
     * catch already yields false. That was proven by mutation test on
     * 2026-09-09: deleting the guard left all five tests green, i.e. the guard
     * was real code that no test could see. A line whose own comment has to say
     * "do not read this as a behaviour the tests pin" is an invitation for
     * someone to delete it during a refactor and lose the intent.
     *
     * This pins it on the OBSERVABLE difference: with the guard, a falsy path
     * never reaches the filesystem at all. Without it, statSync is called (and
     * throws). Asserting "we do not touch the fs for input we already know is
     * invalid" is the actual contract -- cheap, and it makes the mutant die.
     */
    it('short-circuits BEFORE touching the filesystem for a falsy path', function () {
        var calls = [];
        var realStatSync = fs.statSync;
        fs.statSync = function (p) { calls.push(p); return realStatSync.apply(fs, arguments); };
        try {
            expect(isEmptyExportFile(undefined)).to.equal(false);
            expect(isEmptyExportFile(null)).to.equal(false);
            expect(isEmptyExportFile('')).to.equal(false);
            expect(calls).to.deep.equal([]);   // the guard did the work, not the catch

            // Positive control: a REAL path must still reach statSync, or this
            // test would also pass against a function that does nothing at all.
            isEmptyExportFile(write('control.csv', ''));
            expect(calls.length).to.equal(1);
        } finally {
            fs.statSync = realStatSync;
        }
    });
});