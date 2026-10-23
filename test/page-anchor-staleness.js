/*
 * L1 staleness guard for app/utils/page-anchor.js (2026-10-23).
 *
 * The failure this pins: a checkpoint table that no longer matches the live
 * row set served WRONG PAGES with HTTP 200 and nothing in any log —
 * project 1989 for 19 days after a site move (off by up to 225,042 rows), and
 * project 6600 after a 10-21 cleanup deleted 8,400 rows (off by up to 3,300).
 *
 * The guard: both consumers (resolveForOffset and coverageFor) must refuse
 * unless max(rank) == div(N-1, INTERVAL)*INTERVAL + 1, with N and max(rank)
 * read in ONE statement. Fixtures below use the real 2026-10-23 numbers.
 */

var expect = require('chai').expect;
var pageAnchor = require('../app/utils/page-anchor');

function poolWith(rows, capture) {
    return function (sql, cb) { if (capture) { capture.sql = sql; } cb(null, rows); };
}

describe('🔴 L1 staleness guard — a stale checkpoint table must never be served', function () {

    describe('isFreshGrid (the detector\'s FRESH test)', function () {
        it('accepts the exact grid point for N', function () {
            expect(pageAnchor.isFreshGrid(4021301, 4021389)).to.be.true;   // project 35
            expect(pageAnchor.isFreshGrid(1, 1)).to.be.true;
            expect(pageAnchor.isFreshGrid(1, 100)).to.be.true;
            expect(pageAnchor.isFreshGrid(101, 101)).to.be.true;
        });

        it('🔴 refuses a SHRUNK table (rows deleted: max(rank) beyond the grid)', function () {
            // 6600 on 2026-10-23: stored_max 3,182,701, live 3,174,438
            expect(pageAnchor.isFreshGrid(3182701, 3174438)).to.be.false;
        });

        it('refuses tail growth past one interval (append owed)', function () {
            expect(pageAnchor.isFreshGrid(574401, 574501)).to.be.false;
        });

        it('refuses missing / zero / non-integer inputs (fail closed)', function () {
            expect(pageAnchor.isFreshGrid(null, 100)).to.be.false;
            expect(pageAnchor.isFreshGrid(undefined, 100)).to.be.false;
            expect(pageAnchor.isFreshGrid(1, 0)).to.be.false;
            expect(pageAnchor.isFreshGrid(0, 0)).to.be.false;
            expect(pageAnchor.isFreshGrid('1 OR 1=1', 100)).to.be.false;
        });

        it('accepts numeric strings (pg returns bigint/numeric as strings)', function () {
            expect(pageAnchor.isFreshGrid('3182701', '3182778')).to.be.true;
        });
    });

    describe('resolveForOffset', function () {
        it('🔴 REFUSES (null ⇒ OFFSET) when the project\'s checkpoints are SHRUNK', function (done) {
            // 6600, deep ASC jump. Everything else about the row is in-grid, so
            // only the staleness test can refuse it.
            pageAnchor.resolveForOffset(poolWith([{ total: 3174438, asc_rank: 2479901, rank: 2479901,
                    sort_key: '2025-07-01 00:00:00', recording_id: 304929829, max_rank: 3182701 }]),
                6600, 'datetime', 2479900, 100, false, function (err, res) {
                    expect(err).to.equal(null);
                    expect(res).to.equal(null);
                    done();
                });
        });

        it('serves when the table is on the live grid (control — must pass)', function (done) {
            pageAnchor.resolveForOffset(poolWith([{ total: 3182778, asc_rank: 2479901, rank: 2479901,
                    sort_key: '2025-07-01 00:00:00', recording_id: 304929829, max_rank: 3182701 }]),
                6600, 'datetime', 2479900, 100, false, function (err, res) {
                    expect(res).to.not.equal(null);
                    expect(res.anchor.id).to.equal(304929829);
                    expect(res.walk).to.equal(0);
                    done();
                });
        });

        it('🔴 refuses when max_rank is absent from the row (fail closed, not open)', function (done) {
            pageAnchor.resolveForOffset(poolWith([{ total: 3182778, asc_rank: 2479901, rank: 2479901,
                    sort_key: '2025-07-01 00:00:00', recording_id: 304929829 }]),
                6600, 'datetime', 2479900, 100, false, function (err, res) {
                    expect(res).to.equal(null);
                    done();
                });
        });

        it('reads max(rank) in the SAME statement as the total (one snapshot)', function () {
            var cap = {};
            pageAnchor.resolveForOffset(poolWith([], cap), 6600, 'datetime', 2479900, 100, false, function () {});
            expect(cap.sql).to.contain('sum(rec_count)');
            expect(cap.sql).to.match(/AS max_rank/);
        });
    });

    describe('coverageFor (drives the reachable-page cap)', function () {
        it('🔴 reports ZERO coverage for a SHRUNK table — the cap comes back', function (done) {
            // Without this, the pager keeps offering deep pages the resolver now
            // refuses, and they fall to OFFSET at a depth where OFFSET cancels.
            pageAnchor.coverageFor(poolWith([{ max_rank: 3182701, total: 3174438 }]), 6600, 'datetime',
                function (err, cov) {
                    expect(err).to.equal(null);
                    expect(cov.maxRank).to.equal(0);
                    done();
                });
        });

        it('reports full coverage for a fresh table (control — must pass)', function (done) {
            pageAnchor.coverageFor(poolWith([{ max_rank: 4021301, total: 4021389 }]), 35, 'datetime',
                function (err, cov) {
                    expect(cov.maxRank).to.equal(4021301);
                    done();
                });
        });

        it('🔴 reports zero when the total is missing (fail closed)', function (done) {
            pageAnchor.coverageFor(poolWith([{ max_rank: 4021301 }]), 35, 'datetime',
                function (err, cov) {
                    expect(cov.maxRank).to.equal(0);
                    done();
                });
        });

        it('reads the total in the SAME statement as max(rank)', function () {
            var cap = {};
            pageAnchor.coverageFor(poolWith([], cap), 35, 'datetime', function () {});
            expect(cap.sql).to.contain('sum(rec_count)');
            expect(cap.sql).to.contain('max(rank)');
        });
    });
});
