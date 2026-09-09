var expect = require('chai').expect;

var formatExportError = require('../jobs/services/export-error').formatExportError;

/**
 * REGRESSION GUARD.
 *
 * The export job recorded failures with `JSON.stringify(error)`. Error's own
 * properties are NON-ENUMERABLE, so that expression is '{}' for every Error --
 * the failure's cause was destroyed at the moment it was recorded.
 *
 * Measured on production 2026-09-09: 15 stranded rows in
 * recordings_export_parameters (6 real users, oldest 2023-10-10, newest
 * 2026-03-17) ALL carry the literal '{}'. We know those exports failed; we can
 * never know why.
 *
 * Second hazard: updateExportRecordings interpolates the value into a
 * single-quoted SQL literal WITHOUT escaping, so quotes/backslashes/newlines
 * in a message would break the UPDATE and throw again -- making the
 * error-recording path fail a second time.
 */
describe('formatExportError', function () {

    it('does NOT produce "{}" for an Error (the stranded-row bug)', function () {
        var e = new Error('EmptyObjectRejected: refusing to write a 0-byte object');
        // Prove the old implementation was broken...
        expect(JSON.stringify(e)).to.equal('{}');
        // ...and that the new one is not.
        expect(formatExportError(e)).to.not.equal('{}');
        expect(formatExportError(e)).to.contain('EmptyObjectRejected');
    });

    it('strips characters that would break the unescaped SQL literal', function () {
        var e = new Error("it's a \\ trap\nwith\nnewlines");
        var out = formatExportError(e);
        expect(out).to.not.match(/['\\\n\r]/);
        expect(out).to.equal('it s a trap with newlines');
    });

    it('collapses all whitespace to single spaces (single-line value)', function () {
        expect(formatExportError(new Error('a\t\tb\n\n  c'))).to.equal('a b c');
    });

    it('caps the value at 2000 characters', function () {
        expect(formatExportError(new Error('x'.repeat(5000))).length).to.equal(2000);
    });

    it('preserves detail for a non-Error object', function () {
        expect(formatExportError({ code: 'X', msg: 'plain object' }))
            .to.equal('{"code":"X","msg":"plain object"}');
    });

    it('handles a bare string throw', function () {
        expect(formatExportError('a bare string')).to.equal('"a bare string"');
    });

    it('degrades to a name rather than "{}" for a message-less Error', function () {
        expect(formatExportError(new Error(''))).to.equal('Error');
    });

    it('never returns undefined/null for odd inputs', function () {
        [null, undefined, 0, false].forEach(function (v) {
            expect(formatExportError(v)).to.be.a('string');
        });
    });
});