/* jshint node:true */
'use strict';

/**
 * REGRESSION GUARD — MySQL session-variable SQL (`@var := ...`) is a hard
 * PARSE error on PostgreSQL, so any statement carrying it 500s on every call
 * under DB_ENGINE=pg.
 *
 * Measured in prod 2026-09-14 (rfcx-local
 * runbooks/evidence/irr-ledger-2026-09-14-ordinary-user-impact.md):
 *
 *     GET /legacy-api/project/<slug>/playlists/<id>/<rec>/next   -> HTTP 500
 *     pg_code 42601 — syntax error at or near ":="
 *
 *     SELECT @rownum:=@rownum+1 row, PLR.*
 *       FROM playlist_recordings PLR, (SELECT @rownum:=0) r
 *      WHERE PLR.playlist_id = ?
 *
 * Two call sites in app/model/playlists.js carried the identical statement —
 * fetchRecordingsAround() (which backs /next and /prev) and
 * fetchRecordingPosition(). 30 playlist 5xx over 14 days across 5 distinct
 * real users, first seen 2026-09-09 (the Phase 7 write flip).
 *
 * The portable replacement is a window function:
 *     ROW_NUMBER() OVER (ORDER BY PLR.recording_id)
 *
 * GUARD 1 is a source-shape guard over the whole model layer: `@x :=` must not
 * reappear anywhere, in any file — this is the class, not the instance.
 *
 * GUARD 2 pins the specific correctness pairing this fix depends on: the row
 * number produced by fetchRecordingPosition/fetchRecordingsAround is used as
 * the OFFSET of fetchData()'s LIMIT/OFFSET paging query. An unordered
 * LIMIT/OFFSET scan is PLAN-DEPENDENT in PostgreSQL, so if any one of the
 * three loses its ORDER BY they can silently disagree and the route returns
 * the WRONG "next" recording — a correctness bug that no parse-level fix and
 * no HTTP-status check would catch.
 */

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var MODEL_DIR = path.join(ROOT, 'app', 'model');

function stripCommentsAndStrings(src) {
    // drop line comments and block comments so guard hits are real SQL, not prose
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

describe('MySQL session variables must not appear in SQL (PostgreSQL 42601)', function () {

    it('no model file uses the `@var :=` idiom', function () {
        var offenders = [];

        fs.readdirSync(MODEL_DIR).forEach(function (f) {
            if (!/\.js$/.test(f)) { return; }
            var src = stripCommentsAndStrings(
                fs.readFileSync(path.join(MODEL_DIR, f), 'utf8'));
            // @rownum:=, @x := , @foo:=@foo+1 ...
            var re = /@[A-Za-z_][A-Za-z0-9_]*\s*:=/g;
            var m = re.exec(src);
            while (m) {
                offenders.push(f + ' -> ' + m[0]);
                m = re.exec(src);
            }
        });

        expect(offenders,
            'MySQL session-variable SQL is a parse error on PostgreSQL (42601); ' +
            'use ROW_NUMBER() OVER (ORDER BY ...) instead').to.deep.equal([]);
    });

    it('playlists.js numbering and paging share an explicit ORDER BY', function () {
        var src = fs.readFileSync(path.join(MODEL_DIR, 'playlists.js'), 'utf8');

        // the two row-numbering queries
        var rownum = src.match(/ROW_NUMBER\(\)\s+OVER\s+\(ORDER BY PLR\.recording_id\)/g) || [];
        expect(rownum.length,
            'both fetchRecordingsAround and fetchRecordingPosition must number rows ' +
            'with ROW_NUMBER() OVER (ORDER BY PLR.recording_id)').to.equal(2);

        // the paging query that CONSUMES those row numbers as its OFFSET
        expect(src,
            'fetchData() pages with LIMIT/OFFSET and must order by the same column, ' +
            'or the row numbers above address the wrong rows')
            .to.match(/ORDER BY PLR\.recording_id["\s]*\+?\s*limit_clause/);
    });
});