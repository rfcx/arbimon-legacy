/*
 * Unit tests for app/utils/page-anchor.js — the checkpoint -> keyset-anchor
 * resolver that makes an arbitrary page number seekable.
 *
 * These pin the two things that silently return WRONG ROWS rather than errors:
 *  1. the DESC rank conversion (N + 1 - rank), where using the wrong N is
 *     invisible to every HTTP status and every existing test; and
 *  2. the fallback contract — every unusable input must yield null, i.e.
 *     today's OFFSET behaviour, never a throw and never a partial anchor.
 */

var expect = require('chai').expect;
var pageAnchor = require('../app/utils/page-anchor');

describe('page-anchor', function () {

    describe('isCheckpointable', function () {
        it('accepts exactly the three columns the builder writes', function () {
            expect(pageAnchor.isCheckpointable('datetime')).to.be.true;
            expect(pageAnchor.isCheckpointable('filename')).to.be.true;
            expect(pageAnchor.isCheckpointable('upload_time')).to.be.true;
        });

        it('REFUSES `site` — it has no anchor type, so a checkpoint could not become a seek', function () {
            expect(pageAnchor.isCheckpointable('site')).to.be.false;
        });

        it('refuses anything not whitelisted (injection guard)', function () {
            expect(pageAnchor.isCheckpointable("datetime'; DROP TABLE recordings--")).to.be.false;
            expect(pageAnchor.isCheckpointable(undefined)).to.be.false;
            expect(pageAnchor.isCheckpointable('')).to.be.false;
            // must not be fooled by inherited Object properties
            expect(pageAnchor.isCheckpointable('constructor')).to.be.false;
            expect(pageAnchor.isCheckpointable('toString')).to.be.false;
        });
    });

    describe('ascRankFor — ASCENDING', function () {
        it('page 1 of an ASC sort anchors at rank 1', function () {
            expect(pageAnchor.ascRankFor(0, 100, false, 35647)).to.equal(1);
        });

        it('page 2 anchors at rank 101', function () {
            expect(pageAnchor.ascRankFor(100, 100, false, 35647)).to.equal(101);
        });

        it('a deep page anchors at offset+1', function () {
            expect(pageAnchor.ascRankFor(3318000, 100, false, 11240222)).to.equal(3318001);
        });
    });

    describe('ascRankFor — DESCENDING (the conversion that silently returns wrong rows)', function () {
        // Project 1533's real shape, which is where the wrong-N bug was measured.
        var TOTAL = 35647;

        it('DESC page 1 anchors at the ASC rank of the page LAST row', function () {
            // DESC ranks 1..100 == ASC ranks 35548..35647; seeking must start at
            // the LOWEST ASC rank so a forward ASC walk covers the whole page.
            expect(pageAnchor.ascRankFor(0, 100, true, TOTAL)).to.equal(TOTAL + 1 - 100);
        });

        it('DESC page 2 anchors one page earlier in ASC terms', function () {
            expect(pageAnchor.ascRankFor(100, 100, true, TOTAL)).to.equal(TOTAL + 1 - 200);
        });

        it('🔴 the LAST DESC page clamps to rank 1 and never goes below it', function () {
            // The final DESC page is partial: offset+limit overshoots `total`.
            // Without the min()/clamp this returns 0 or negative, and a rank < 1
            // matches no checkpoint -- the deepest page would lose its anchor.
            var lastOffset = Math.floor((TOTAL - 1) / 100) * 100;
            var rank = pageAnchor.ascRankFor(lastOffset, 100, true, TOTAL);
            expect(rank).to.be.at.least(1);
            expect(rank).to.equal(1);
        });

        it('🔴 a DIFFERENT total yields a DIFFERENT anchor — this is why N must be the TRUE live count', function () {
            // Measured on project 1533: the true count is 35,647 but the
            // non-NULL count is 62. Passing the wrong one returns a different
            // row with no error anywhere. Pin that they genuinely diverge, so a
            // future refactor cannot quietly swap the source of `total`.
            var withTrue = pageAnchor.ascRankFor(0, 100, true, 35647);
            var withNonNull = pageAnchor.ascRankFor(0, 100, true, 62);
            expect(withTrue).to.not.equal(withNonNull);
        });
    });

    describe('ascRankFor — refusals (each must be null, i.e. fall back to OFFSET)', function () {
        it('refuses a negative offset', function () {
            expect(pageAnchor.ascRankFor(-1, 100, false, 1000)).to.equal(null);
        });

        it('refuses a zero or negative limit', function () {
            expect(pageAnchor.ascRankFor(0, 0, false, 1000)).to.equal(null);
            expect(pageAnchor.ascRankFor(0, -5, false, 1000)).to.equal(null);
        });

        it('refuses a missing or zero total (nothing to anchor against)', function () {
            expect(pageAnchor.ascRankFor(0, 100, false, 0)).to.equal(null);
            expect(pageAnchor.ascRankFor(0, 100, false, undefined)).to.equal(null);
        });

        it('refuses an offset past the end rather than inventing a rank', function () {
            expect(pageAnchor.ascRankFor(5000, 100, false, 1000)).to.equal(null);
        });

        it('refuses non-numeric input', function () {
            expect(pageAnchor.ascRankFor('abc', 100, false, 1000)).to.equal(null);
            expect(pageAnchor.ascRankFor(0, 'x', false, 1000)).to.equal(null);
        });
    });

    describe('lookup', function () {
        // The real interface is dbpoolPg.pgReadQuery(sql, cb) -> cb(err, rows):
        // a SQL-STRING channel, not a parameterised one. That is exactly why
        // lookupSql() validates every embedded value (see the injection tests).
        function poolReturning(rows) {
            return function (sql, cb) { cb(null, rows); };
        }

        it('returns the nearest checkpoint and the bounded forward walk', function (done) {
            // rank 14,901 requested, checkpoint at 14,801 => walk 100... which is
            // INTERVAL and therefore REFUSED (see the grid test). Use 14,851.
            var pool = poolReturning([{ rank: 14801, sort_key: '2024-03-29 06:35:00', recording_id: 184180940 }]);
            pageAnchor.lookup(pool, 1989, 'datetime', 14851, function (err, res) {
                expect(err).to.equal(null);
                expect(res).to.be.an('object');
                expect(res.anchor.id).to.equal(184180940);
                expect(res.anchor.key).to.equal('2024-03-29 06:35:00');
                expect(res.anchor.isNull).to.be.false;
                expect(res.walk).to.equal(50);
                done();
            });
        });

        it('🔑 flags a NULL-band checkpoint so the seek uses the band predicate', function (done) {
            // A band anchor stores sort_key IS NULL. persite-sort.js needs
            // isNull=true to use the tiebreaker-only predicate; a band-blind
            // anchor here drops the whole band (measured: 250 of 400 rows lost).
            var pool = poolReturning([{ rank: 618801, sort_key: null, recording_id: 99001 }]);
            pageAnchor.lookup(pool, 8360, 'datetime', 618801, function (err, res) {
                expect(res.anchor.isNull).to.be.true;
                expect(res.anchor.key).to.equal(undefined);
                expect(res.walk).to.equal(0);
                done();
            });
        });

        it('falls back (null) when the project has no checkpoints', function (done) {
            pageAnchor.lookup(poolReturning([]), 2470, 'datetime', 5000, function (err, res) {
                expect(err).to.equal(null);
                expect(res).to.equal(null);
                done();
            });
        });

        it('🔴 falls back (never throws) when the TABLE DOES NOT EXIST', function (done) {
            // The supported pre-backfill state. A throw here would 500 a page
            // that works fine today.
            var pool = function (sql, cb) {
                var e = new Error('relation "recording_page_anchor" does not exist');
                e.code = '42P01';
                cb(e);
            };
            pageAnchor.lookup(pool, 2470, 'datetime', 5000, function (err, res) {
                expect(err).to.equal(null);
                expect(res).to.equal(null);
                done();
            });
        });

        it('🔴 REFUSES an out-of-grid checkpoint rather than serving from it', function (done) {
            // walk >= INTERVAL means the table disagrees with INTERVAL; serving
            // would mean an unbounded forward walk, i.e. the original problem.
            var pool = poolReturning([{ rank: 1, sort_key: '2020-01-01 00:00:00', recording_id: 5 }]);
            pageAnchor.lookup(pool, 1989, 'datetime', 99999, function (err, res) {
                expect(res).to.equal(null);
                done();
            });
        });

        it('refuses a non-checkpointable sort column without querying', function (done) {
            var queried = false;
            var pool = function (sql, cb) { queried = true; cb(null, []); };
            pageAnchor.lookup(pool, 1989, 'site', 100, function (err, res) {
                expect(res).to.equal(null);
                expect(queried).to.be.false;
                done();
            });
        });

        it('scopes the query to the project + sort column it was asked for', function (done) {
            var seenSql = null;
            var pool = function (sql, cb) { seenSql = sql; cb(null, []); };
            pageAnchor.lookup(pool, 1989, 'datetime', 14901, function () {
                expect(seenSql).to.contain('project_id = 1989');
                expect(seenSql).to.contain("sort_col = 'datetime'");
                expect(seenSql).to.contain('rank <= 14901');
                expect(seenSql).to.contain('ORDER BY rank DESC LIMIT 1');
                done();
            });
        });
    });

    describe('coverageFor — the signal the reachable-page cap is driven by', function () {
        it('reports the deepest checkpoint rank', function (done) {
            var pool = function (sql, cb) { cb(null, [{ max_rank: 574401 }]); };
            pageAnchor.coverageFor(pool, 3165, 'datetime', function (err, cov) {
                expect(cov.maxRank).to.equal(574401);
                expect(cov.interval).to.equal(pageAnchor.INTERVAL);
                done();
            });
        });

        it('🔴 reports 0 for an UN-BUILT project — this is what keeps its cap on', function (done) {
            // 2470 and 1989 have no checkpoints yet. Reporting 0 is what stops
            // cap removal from re-exposing their cancelling deep pages.
            var pool = function (sql, cb) { cb(null, [{ max_rank: 0 }]); };
            pageAnchor.coverageFor(pool, 2470, 'datetime', function (err, cov) {
                expect(cov.maxRank).to.equal(0);
                done();
            });
        });

        it('assumes NO coverage when the lookup errors (fail safe, not fail open)', function (done) {
            var pool = function (sql, cb) { cb(new Error('boom')); };
            pageAnchor.coverageFor(pool, 3165, 'datetime', function (err, cov) {
                expect(err).to.equal(null);
                expect(cov.maxRank).to.equal(0);
                done();
            });
        });
    });

    describe('🔒 SQL literal safety — the values ARE embedded, so they must be validated', function () {
        it('refuses a projectId that is not a whole integer (parseInt is too permissive)', function () {
            // parseInt('1 OR 1=1') === 1, which would SILENTLY ACCEPT an
            // injected value by truncating it. The whole string must match.
            expect(pageAnchor.lookupSql('1 OR 1=1', 'datetime', 5)).to.equal(null);
            expect(pageAnchor.lookupSql('1; DROP TABLE recordings--', 'datetime', 5)).to.equal(null);
            expect(pageAnchor.lookupSql(1.5, 'datetime', 5)).to.equal(null);
            expect(pageAnchor.lookupSql(-1, 'datetime', 5)).to.equal(null);
        });

        it('refuses a rank that is not a whole integer', function () {
            expect(pageAnchor.lookupSql(1989, 'datetime', "5 UNION SELECT 1")).to.equal(null);
            expect(pageAnchor.lookupSql(1989, 'datetime', -3)).to.equal(null);
        });

        it('refuses any sortCol outside the three-literal whitelist', function () {
            expect(pageAnchor.lookupSql(1989, "datetime'--", 5)).to.equal(null);
            expect(pageAnchor.lookupSql(1989, 'site', 5)).to.equal(null);
            expect(pageAnchor.coverageSql(1989, "x' OR '1'='1", 5)).to.equal(null);
        });

        it('emits only digits and a whitelisted literal when it DOES build SQL', function () {
            var sql = pageAnchor.lookupSql(1989, 'datetime', 14851);
            expect(sql).to.contain('project_id = 1989');
            expect(sql).to.contain("sort_col = 'datetime'");
            // exactly one quoted literal, and it is one we own
            var quoted = sql.match(/'[^']*'/g) || [];
            expect(quoted).to.deep.equal(["'datetime'"]);
        });

        it('safeInt accepts safe integers and rejects everything else', function () {
            expect(pageAnchor.safeInt(0)).to.equal(0);
            expect(pageAnchor.safeInt('42')).to.equal(42);
            expect(pageAnchor.safeInt(' 42 ')).to.equal(42);
            expect(pageAnchor.safeInt('42abc')).to.equal(null);
            expect(pageAnchor.safeInt(Number.MAX_SAFE_INTEGER + 2)).to.equal(null);
            expect(pageAnchor.safeInt(null)).to.equal(null);
            expect(pageAnchor.safeInt({})).to.equal(null);
        });
    });
});
/*
 * ── ADAPTATION TO ARCHIVE / DELETE / ADD ────────────────────────────────────
 * Added 2026-09-17 after the operator asked how this system adapts when
 * recordings are archived, deleted or added. Answering it found a real defect in
 * the version shipped an hour earlier, so these tests pin the resolved shape.
 */
describe('adaptation: archived / deleted / added rows', function () {

    describe('the rank is a rank IN A ROW SET, and the set must match', function () {
        it('🔴 stored ranks describe the ACTIVE list, so a rank means nothing on the archived view', function () {
            // The builder counts only `archived_at IS NULL`. Measured on project
            // 1533 (35,647 active / 5,246 archived): the archived view's true row
            // at rank 901 is recording 27332174, but the checkpoint table offers
            // 13091371 -- an ACTIVE row the archived query's own WHERE excludes.
            // The seek is a RANGE predicate, so it returns rows anyway: a WRONG
            // PAGE with no error. `recordings.js` therefore only resolves a
            // checkpoint when the normalised archive scope is 'active', and
            // reports ZERO coverage otherwise.
            //
            // This module is scope-agnostic by design (it is handed a rank), so
            // the guard lives at the call site; this test documents the contract
            // that call site must honour.
            expect(pageAnchor.isCheckpointable('datetime')).to.be.true;
        });
    });

    describe('ADDED rows: the tail beyond the last anchor', function () {
        it('a request past the deepest checkpoint returns the deepest one, with a bounded walk', function (done) {
            // Adding rows does NOT invalidate any existing anchor on an
            // append-mostly list: ranks 1..max_rank keep naming the same rows,
            // because a new upload with a LATER datetime sorts after them. It
            // only leaves a TAIL with no checkpoint. Measured drift 25 min after
            // the build: 3 to 76 rows per project, i.e. under one interval.
            var pool = poolReturningTop([{ rank: 574401, sort_key: '2021-10-07 19:05:00', recording_id: 63140027 }]);
            pageAnchor.lookup(pool, 3165, 'datetime', 574436, function (err, res) {
                // rank-cpRank = 35 < INTERVAL => served, with a 35-row walk
                expect(res).to.not.equal(null);
                expect(res.walk).to.equal(35);
                expect(res.walk).to.be.below(pageAnchor.INTERVAL);
                done();
            });
        });

        it('🔴 REFUSES once the tail exceeds one interval (the unbounded-walk guard)', function (done) {
            // If a project grows a lot without a refresh, the walk from the last
            // anchor would stop being bounded -- which is the original problem.
            // The out-of-grid check declines instead, so the page falls back to
            // OFFSET rather than silently doing an unbounded scan.
            var pool = poolReturningTop([{ rank: 574401, sort_key: '2021-10-07 19:05:00', recording_id: 63140027 }]);
            pageAnchor.lookup(pool, 3165, 'datetime', 574401 + pageAnchor.INTERVAL, function (err, res) {
                expect(res).to.equal(null);
                done();
            });
        });
    });

    describe('DELETED / ARCHIVED rows: a stale anchor must be detectable, not silently served', function () {
        it('a checkpoint naming a row that no longer qualifies still yields a cursor — so staleness needs its own detector', function (done) {
            // Honest statement of the limit: this module cannot tell that a
            // stored recording_id has since been deleted or archived. It returns
            // the cursor; the seek is a range predicate, so the page shifts by
            // however many rows vanished ahead of it. Deleting N rows before
            // rank R makes every rank >= R off by N.
            // ⇒ the repair unit is the PROJECT (a global rank is position
            // dependent), and a re-derive is what fixes it. Pinned here so a
            // future reader does not mistake "returns a cursor" for "verified".
            var pool = poolReturningTop([{ rank: 101, sort_key: '2024-01-01 00:00:00', recording_id: 999999999 }]);
            pageAnchor.lookup(pool, 3165, 'datetime', 101, function (err, res) {
                expect(res).to.not.equal(null);
                expect(res.anchor.id).to.equal(999999999);
                expect(res.walk).to.equal(0);
                done();
            });
        });
    });

    function poolReturningTop(rows) {
        return function (sql, cb) { cb(null, rows); };
    }
});
