var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

// Wiring guard for KEYSET (seek) pagination — rfcx-local OPEN-ITEMS §270.
//
// The BUILDER is unit-tested in recordings-persite-sort.test.js. What this file
// pins is the CALLER wiring in app/model/recordings.js, which those tests cannot
// see and which is where an anchor silently becomes inert:
//
//   1. the anchor is accepted by the route schema at all (joi strips unknown
//      keys, so an un-declared anchor never reaches the model — the feature
//      would look wired and do nothing)
//   2. each sortable column carries the SQL TYPE the builder validates against
//   3. a PARTIAL anchor is dropped rather than half-applied (a partial anchor
//      changes which rows the user sees — the fallback must be today's OFFSET
//      path, never an error and never a different page)
//   4. `site` deliberately has NO anchor type, so keyset is declined for it
//
// Source-level assertions: app/model/recordings.js pulls in the whole DB
// connection stack and cannot be require()d in a plain unit test (that failure
// is pre-existing and reproduces on unmodified master).
var SRC = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'model', 'recordings.js'), 'utf8');

describe('recordings — keyset anchor wiring', function () {

    it('accepts anchorId / anchorKey / anchorNull in the route schema', function () {
        // joi strips keys it does not declare. Without these three lines the
        // anchor never reaches the model and keyset mode is dead on arrival —
        // with no error anywhere to notice.
        expect(SRC).to.match(/anchorId:\s*joi\.number\(\)\.integer\(\)\.min\(0\)/);
        expect(SRC).to.match(/anchorKey:\s*joi\.string\(\)\.max\(64\)/);
        expect(SRC).to.match(/anchorNull:\s*joi\.boolean\(\)/);
    });

    it('declares the SQL type of every keyset-eligible sort column', function () {
        // The builder refuses an anchor whose value does not match this type,
        // so a missing/incorrect type silently disables keyset for that column.
        expect(SRC).to.match(/datetime:.*anchorType:\s*'timestamp'/);
        expect(SRC).to.match(/upload_time:.*anchorType:\s*'timestamp'/);
        expect(SRC).to.match(/filename:.*anchorType:\s*'text'/);
    });

    it('gives `site` NO anchor type — keyset is declined for it by design', function () {
        var siteLine = SRC.split('\n').filter(function (l) {
            return /^\s*site(_id)?:\s*\{/.test(l);
        });
        expect(siteLine.length).to.be.greaterThan(0);
        siteLine.forEach(function (l) {
            expect(l).to.not.contain('anchorType');
        });
    });

    it('forwards the anchor AND its type into the builder', function () {
        expect(SRC).to.contain('anchorType: sort.anchorType');
        expect(SRC).to.contain('anchor: keysetAnchor');
    });

    it('drops a PARTIAL anchor rather than half-applying it', function () {
        // id WITHOUT key, outside the NULL band, must yield null => the OFFSET
        // path runs and the user sees exactly what they see today.
        expect(SRC).to.match(
            /parameters\.anchorNull === true \|\| parameters\.anchorKey !== undefined/);
        // and an anchor is only built when the column HAS a type
        expect(SRC).to.match(/sort\.anchorType && anchorIdNum !== undefined/);
    });

    it('keeps the fallback chain intact (keyset failure must never 500)', function () {
        // The builder returns null for any anchor it will not honour; the caller
        // then runs the historical shape. That "return null => fall through"
        // contract is what makes this change safe to ship inert.
        expect(SRC).to.contain('per-site union sort failed, falling back to forced-index shape');
    });
});