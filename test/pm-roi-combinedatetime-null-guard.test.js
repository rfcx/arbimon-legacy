var expect = require('chai').expect;

var PatternMatchings = require('../app/model/pattern_matchings');

/**
 * REGRESSION GUARD — the NULL denorm datetime that 500s a whole results page.
 *
 * `pattern_matching_rois.denorm_recording_datetime` is a DENORMALISED cache of
 * `recordings.datetime`. It can be NULL: the mysql2pg fold turned the legacy
 * MySQL '0000-00-00' zero-date sentinel into a real NULL (OPEN-ITEMS §216 —
 * 37,309 zero-date recordings whose sites carry an empty `timezone`).
 *
 * Before 2026-09-22 `combineDatetime()` called `.toISOString()` unconditionally,
 * so ONE null row threw
 *     TypeError: Cannot read properties of null (reading 'toISOString')
 * out of `completePMRResults()` / `exportDataFormatted()` and failed the WHOLE
 * response. The user saw "Error communicating with server" and could not view
 * their pattern-matching results at all.
 *
 * Measured on prod that day: 782 pattern_matchings / 3,826,274 ROI rows exposed;
 * a real user hit it on PM 122499 (146 of 146 rows null) at 07:14Z.
 *
 * ⚠️ THE LOAD-BEARING ASSERTION IS THE NEGATIVE ONE: a guard that simply
 * defaulted the date would also make the crash go away — while writing a
 * plausible-looking WRONG date (1970, or 0) into a scientific CSV export whose
 * columns are year/month/day/hour/minute. So this file pins BOTH halves:
 *   - a null row must NOT throw, and must NOT invent date fields
 *   - a valid row must STILL be decomposed exactly as before (no regression)
 *
 * This guard is NOT the §216 data repair. It degrades one ROW to blank date
 * columns instead of failing the whole RESPONSE.
 */
describe('pattern_matchings.combineDatetime — NULL denorm datetime guard', function () {

    var VALID = new Date(Date.UTC(2024, 2, 30, 3, 7, 0)); // 2024-03-30T03:07:00Z

    it('decomposes a valid Date exactly as before (no regression)', function () {
        var pmr = { datetime: VALID };
        PatternMatchings.combineDatetime(pmr);
        expect(pmr.year).to.equal(2024);
        expect(pmr.month).to.equal(3);
        expect(pmr.day).to.equal(30);
        expect(pmr.hour).to.equal(3);
        expect(pmr.minute).to.equal(7);
    });

    it('does not throw on a NULL datetime (the §216 production crash)', function () {
        var pmr = { datetime: null, recording: 'x.wav' };
        expect(function () { PatternMatchings.combineDatetime(pmr); }).to.not.throw();
    });

    it('does not INVENT date fields for a NULL datetime', function () {
        // The anti-default assertion: absent => empty CSV cell (honest),
        // whereas 1970/0 would be a confident wrong answer in an export.
        var pmr = { datetime: null };
        PatternMatchings.combineDatetime(pmr);
        expect(pmr).to.not.have.property('year');
        expect(pmr).to.not.have.property('month');
        expect(pmr).to.not.have.property('day');
        expect(pmr).to.not.have.property('hour');
        expect(pmr).to.not.have.property('minute');
    });

    it('does not throw on an undefined datetime', function () {
        var pmr = {};
        expect(function () { PatternMatchings.combineDatetime(pmr); }).to.not.throw();
        expect(pmr).to.not.have.property('year');
    });

    it('does not throw on an UNPARSEABLE datetime, and invents nothing', function () {
        // toISOString() throws RangeError on an Invalid Date, so the guard must
        // reject via isNaN(getTime()) BEFORE formatting.
        var pmr = { datetime: 'not-a-date' };
        expect(function () { PatternMatchings.combineDatetime(pmr); }).to.not.throw();
        expect(pmr).to.not.have.property('year');
    });

    it('still accepts a date-like STRING (driver dialect variance)', function () {
        // pg and mysql drivers do not agree on whether a timestamp arrives as a
        // Date or a string; the guard must not break the string path.
        var pmr = { datetime: '2024-03-30T03:07:00.000Z' };
        PatternMatchings.combineDatetime(pmr);
        expect(pmr.year).to.equal(2024);
        expect(pmr.minute).to.equal(7);
    });

    describe('completePMRResults — one bad row must not fail the whole response', function () {
        it('returns every row when a NULL datetime is mixed with valid ones', function () {
            var rows = [
                { datetime: VALID, recording: 'a/b/one.wav' },
                { datetime: null,  recording: 'a/b/two.wav' },   // the §216 row
                { datetime: VALID, recording: 'a/b/three.wav' }
            ];
            var out;
            expect(function () { out = PatternMatchings.completePMRResults(rows); }).to.not.throw();
            expect(out).to.have.lengthOf(3);
            // the page still renders the good rows...
            expect(out[0].year).to.equal(2024);
            expect(out[2].year).to.equal(2024);
            // ...and the bad row survives with a blank date rather than killing it
            expect(out[1]).to.not.have.property('year');
            // basename truncation still applies to every row, bad one included
            expect(out[1].recording).to.equal('two.wav');
        });
    });
});