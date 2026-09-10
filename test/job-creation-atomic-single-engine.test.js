var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — job creation must be ATOMIC and SINGLE-ENGINE.
 *
 * Measured on live prod 2026-09-10: Pattern Matching jobs
 * 169766/169767/169768/169770/169778 (project 5134 "Sounds of Recovery",
 * one user, one 80-minute episode) all died at progress 0/1 with EMPTY
 * `remarks`, and the driver logged:
 *
 *     no pattern_matchings row for job 169766; marking error
 *
 * ROOT CAUSE — a cross-engine read/write split. Post-6.4 (DB_ENGINE=pg) the
 * pooled `dbpool.query()` routes eligible plain SELECTs to PostgreSQL, while
 * INSERTs still go to MariaDB (legacy owns writes until Phase 7). Both enqueue
 * paths did:
 *
 *     SELECT project_id FROM playlists WHERE playlist_id = ?   -> PostgreSQL
 *     INSERT INTO jobs ...                                     -> MariaDB
 *     INSERT INTO pattern_matchings ... playlist_id            -> MariaDB (FK)
 *
 * Delta-sync propagates no deletes intra-day, so a playlist deleted in MariaDB
 * lingers on PostgreSQL until the nightly full re-copy. Playlist 63834 was
 * exactly that: present on PG, absent on MariaDB. The guard PASSED on a row the
 * write engine did not have, and the third statement died on
 * ER_NO_REFERENCED_ROW_2 (fk_pattern_matchings_3) — leaving the already
 * committed `jobs` row as an ORPHAN, because the INSERTs were independent
 * auto-commit statements.
 *
 * THE FIX, and what these guards pin:
 *   1. both paths run inside dbpool.performTransaction => a failed second
 *      INSERT rolls the `jobs` row back instead of orphaning it;
 *   2. every statement goes through the TRANSACTION CONNECTION
 *      (`connection.promisedQuery`), and `queryWithConnHandler` issues
 *      `connection.query` directly — bypassing the 6.4 read route — so the
 *      guard SELECT reads the SAME engine that enforces the FK;
 *   3. no pooled `dbpool.query(` survives in either enqueue function, which is
 *      what reintroduces the split.
 *
 * These are SOURCE-SHAPE guards, matching the convention of
 * classification-delete-waterfall.test.js: the models need a live MySQL pool to
 * execute, so the properties are pinned by asserting the shipped control flow
 * rather than by standing up a database.
 */

var pmSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'model', 'pattern_matchings.js'), 'utf8');
var aedSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'model', 'audio-event-detections-clustering.js'), 'utf8');
var clusterSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'model', 'clustering-jobs.js'), 'utf8');

/** Extract a top-level function body from a model source by its key. */
function fnBody(src, name) {
    var start = src.indexOf('\n    ' + name + ': function');
    if (start < 0) throw new Error('function not found: ' + name);
    var next = src.indexOf('\n    },\n', start);
    if (next < 0) next = src.length;
    return src.slice(start, next);
}

/**
 * Strip comments so shape assertions test CODE, not prose.
 * (The explanatory comments deliberately NAME `dbpool.query()` as the thing
 * not to go back to; without this, that mention would fail the guard below —
 * caught by this very test on its first run.)
 */
function codeOnly(body) {
    return body
        .split('\n')
        .filter(function (l) { return l.trim().indexOf('//') !== 0; })
        .join('\n');
}

var cases = [
    {
        label: 'pattern matching (type 6)',
        body: fnBody(pmSrc, 'enqueuePatternMatchingJob'),
        code: codeOnly(fnBody(pmSrc, 'enqueuePatternMatchingJob')),
        childInsert: 'INSERT INTO `pattern_matchings`'
    },
    {
        label: 'AED clustering (type 8)',
        body: fnBody(aedSrc, 'enqueueAEDClusteringJob'),
        code: codeOnly(fnBody(aedSrc, 'enqueueAEDClusteringJob')),
        childInsert: 'INSERT INTO `job_params_audio_event_detection_clustering`'
    }
];

/**
 * Type 9 is checked SEPARATELY, not folded into `cases`, because its shape
 * legitimately differs: it builds its SQL into named vars (`jobQuery`,
 * `clusteringQuery`) rather than inlining the statements, and it has NO
 * playlist guard SELECT (its child table carries no playlist_id FK). Forcing it
 * through the shared assertions would have required loosening them for all
 * three — which would weaken the guards that matter for types 6 and 8.
 */
var clusterBody = fnBody(clusterSrc, 'requestNewClusteringJob');
var clusterCode = codeOnly(clusterBody);

describe('job creation: atomic + single-engine (cross-engine FK class)', function () {

    // POSITIVE CONTROL: the extractor really found the functions. Without this
    // an empty/renamed body would make every assertion below vacuously pass.
    it('positive control: both enqueue bodies were extracted and are non-trivial', function () {
        cases.forEach(function (c) {
            expect(c.body, c.label).to.be.a('string');
            expect(c.body.length, c.label + ' body length').to.be.greaterThan(400);
            expect(c.body, c.label).to.contain('INSERT INTO `jobs`');
            expect(c.body, c.label).to.contain(c.childInsert);
            // the comment stripper must not have eaten the statements
            expect(c.code, c.label + ' code').to.contain('INSERT INTO `jobs`');
            expect(c.code, c.label + ' code').to.contain('txq(');
        });
    });

    cases.forEach(function (c) {
        describe(c.label, function () {

            it('wraps creation in a single transaction', function () {
                expect(c.body).to.contain('dbpool.performTransaction');
            });

            it('routes every statement through the transaction connection', function () {
                // the helper is bound from the tx connection...
                expect(c.body).to.contain('tx.connection.promisedQuery');
                // ...and is what the statements actually use
                expect(c.body).to.contain('txq(');
            });

            it('does NOT use the pooled dbpool.query (the 6.4 read route)', function () {
                // This is the assertion that fails if someone "optimises" the
                // guard SELECT back onto the pool: the read would then be served
                // by PostgreSQL while the INSERT is enforced on MariaDB.
                // Comments are stripped so the warning text itself cannot pass
                // or fail this guard.
                expect(c.code).to.not.contain('dbpool.query(');
            });

            it('validates the playlist INSIDE the transaction, before inserting', function () {
                var guard = c.body.indexOf('FROM playlists WHERE playlist_id');
                var jobIns = c.body.indexOf('INSERT INTO `jobs`');
                var childIns = c.body.indexOf(c.childInsert);
                expect(guard, 'guard SELECT present').to.be.greaterThan(-1);
                expect(guard, 'guard precedes the jobs INSERT').to.be.lessThan(jobIns);
                expect(jobIns, 'jobs INSERT precedes the child INSERT').to.be.lessThan(childIns);
                expect(c.body).to.contain("throw new Error('Playlist not found')");
            });

            it('keeps the child INSERT inside the same transaction as the jobs INSERT', function () {
                // Both INSERTs must be issued via the tx helper. If either used a
                // pooled/auto-commit path the rollback guarantee is void.
                var tail = c.body.slice(c.body.indexOf('dbpool.performTransaction'));
                expect(tail).to.contain('INSERT INTO `jobs`');
                expect(tail).to.contain(c.childInsert);
            });
        });
    });

    it('documents the measured production incident so the guard is not "cleaned up"', function () {
        expect(pmSrc).to.contain('ER_NO_REFERENCED_ROW_2');
        expect(pmSrc).to.contain('169766');
        expect(aedSrc).to.contain('BYTE-IDENTICAL');
    });

    describe('AED clustering (type 9) — clustering-jobs.js', function () {

        it('positive control: the body was extracted and is non-trivial', function () {
            expect(clusterBody).to.be.a('string');
            expect(clusterBody.length).to.be.greaterThan(400);
            expect(clusterCode).to.contain('INSERT INTO jobs');
            expect(clusterCode).to.contain('INSERT INTO job_params_audio_event_clustering');
        });

        it('wraps both INSERTs in a single transaction', function () {
            expect(clusterCode).to.contain('dbpool.performTransaction');
            expect(clusterCode).to.contain('tx.connection.promisedQuery');
        });

        it('issues BOTH INSERTs through the transaction helper', function () {
            // jobQuery + clusteringQuery are the two statement vars; each must
            // be executed via txq(), not the pooled dbpool.query().
            expect(clusterCode).to.match(/txq\(\s*jobQuery/);
            expect(clusterCode).to.match(/txq\(\s*clusteringQuery/);
        });

        it('does NOT create the job through the pooled dbpool.query', function () {
            // Other helpers in this file legitimately use the pool; scope the
            // assertion to the creation function only.
            expect(clusterCode).to.not.contain('dbpool.query(');
        });

        it('🔑 keeps the k8s network POST OUTSIDE the transaction', function () {
            // Holding a pooled DB connection across a network call is a
            // pool-exhaustion hazard. The dispatch step must sit after the
            // transaction closes, never inside its callback.
            var txStart = clusterCode.indexOf('dbpool.performTransaction');
            var txEnd = clusterCode.indexOf('}))', txStart);
            var k8s = clusterCode.indexOf('k8sClient.apis.batch');
            expect(txStart, 'transaction present').to.be.greaterThan(-1);
            expect(txEnd, 'transaction closes').to.be.greaterThan(txStart);
            expect(k8s, 'k8s post present').to.be.greaterThan(-1);
            expect(k8s, 'k8s POST must be AFTER the transaction closes')
                .to.be.greaterThan(txEnd);
        });

        it('records the measured orphan so the guard is not "cleaned up"', function () {
            expect(clusterSrc).to.contain('169816');
            expect(clusterSrc).to.contain('job_params_aud_ev_cl_ifbk_2');
        });
    });
});