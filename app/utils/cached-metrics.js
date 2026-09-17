var model = require('../model');
const moment = require('moment');
const dbpool = require('./dbpool');
const dbpoolPg = require('./dbpool-pg');

const METRICS_CACHE_TTL_MIN = 90

// COLD-KEY BOUND (P7 debt #9a, 2026-09-10). When a cache key row is ABSENT the
// original code awaited the full recalculation BEFORE res.json. Measured on the
// PG leader: `recording-count` (SELECT count(*) FROM recordings, 306 M rows)
// = 84-100 s, cancelled at the 8 s route statement_timeout on every call and
// failing open to MariaDB (16 s); `project-<id>-rec` = 18 ms for a mid-size
// project but 8.4 s for the largest (15.2 M recordings). ~1,700 of 8,295 live
// projects have no `-rec` key today. At P7 there is no MariaDB to fall open to,
// so the cold path becomes a user-facing error. Shape: race ONE recalculation
// against this bound; if it finishes, serve the truth (the common case, ms);
// if not, serve an estimate and let the SAME promise finish in the background
// (one query, one pool connection, <= the route statement_timeout, exactly as
// before -- just off the response path).
const COLD_KEY_BOUND_MS = parseInt(process.env.METRICS_COLD_BOUND_MS || '2000', 10)

// What to serve when a cold key does not finish inside the bound.
//   recording-count on PG : pg_class.reltuples (16 ms). On MariaDB
//                           information_schema TABLE_ROWS measured 4.3 % over
//                           -> NOT used.
//   ACCURACY, CORRECTED 2026-09-14 (§300 item F): an earlier version of this
//   comment claimed reltuples was accurate to three decimal places (a figure
//   170x too optimistic). RE-DERIVED against an exact
//   count of 305,018,868 on the PG leader: reltuples = 306,609,408, i.e.
//   +0.521 % -- 170x the figure once claimed here. It also counts the ~5.75 M
//   archived rows. It remains the right COLD-key fallback (the alternative is
//   a blank tile), but do NOT treat it as interchangeable with the exact
//   count: the cached value it replaces is -0.012 % off, ~43x more accurate.
//   `n_live_tup` is 0 on this instance and is NOT a usable substitute.
//   anything else         : null. The dashboard renders `{{ recsQty | number }}`
//                           and Angular's number filter passes null through as
//                           blank -- NOT 0, which would read as "my data is
//                           gone" on a rarely-visited project with real
//                           recordings. (A literal "calculating..." label is a
//                           UI change, deliberately not bundled here.)
const PG_RECORDINGS_ESTIMATE_SQL =
    "SELECT c.reltuples AS estimate FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
    "WHERE n.nspname = 'public' AND c.relname = 'recordings'"

const getColdEstimate = async function(k) {
    if (k === 'recording-count' && dbpoolPg.isPg) {        // Engine branch, NOT a translator rule: catalog SQL has no common form
        // across the two engines, and this branch disappears cleanly at P7.
        // The estimate is best-effort: if the routed read fails open to
        // MariaDB (where pg_class does not exist) or errors, serve null
        // rather than turn a slow count into a 500.
        try {
            const rows = await dbpool.query(PG_RECORDINGS_ESTIMATE_SQL)
            const est = rows && rows[0] && Number(rows[0].estimate)
            return (isFinite(est) && est > 0) ? Math.round(est) : null
        } catch (err) {
            console.error('cached-metrics: reltuples estimate failed: ' + (err && err.message || err))
            return null
        }
    }
    return null
}

// Resolve to { done: true, value } if `promise` settles within `ms`, else
// { done: false } -- the promise itself keeps running (callers attach their
// own .catch so a late rejection can never become an unhandled rejection).
const withinBound = function(promise, ms) {
    let timer
    const timeout = new Promise(function(resolve) {
        timer = setTimeout(function() { resolve({ done: false }) }, ms)
    })
    const wrapped = promise.then(
        function(value) { clearTimeout(timer); return { done: true, value: value } },
        function(err) { clearTimeout(timer); throw err }
    )
    return Promise.race([wrapped, timeout])
}

const getCountForSelectedMetric = async function(key, projectId) {
    let count
    switch (key) {
        case 'project-count':
            count = await model.projects.countAllProjects()
            break;
        case 'job-count':
            count = await model.jobs.countAnalysesExecuted()
            break;
        case 'species-count':
            count = await model.species.countAllSpecies()
            break;
        case 'recording-count':
            count = await model.recordings.countAllRecordings()
            break;
        case 'recording-minutes':
            // Minutes of audio across the whole corpus (Option-1, §315, ruled
            // 2026-09-17). The SAME unfiltered set as recording-count. The sum
            // is a 4-worker parallel scan measured at ~55 s on the prod leader
            // — it is UNWINNABLE in the request path (see
            // UNWINNABLE_WARM_REFRESH_KEYS + getColdEstimate) and is refreshed
            // out-of-band only.
            count = await model.recordings.sumAllRecordingMinutes()
            break;
        case 'project-species-count':
            count = await model.species.countProjectSpecies(projectId)
            break;
        case 'project-recording-count':
            count = await model.projects.totalRecordings(projectId)
            break;
        case 'project-site-count':
            count = await model.sites.countProjectSites(projectId)
            break;
        case 'project-playlist-count':
            count = await model.playlists.countProjectPlaylists(projectId)
            break;
        case 'project-pm-sp-count':
            count = await model.patternMatchings.totalPMSpeciesDetected(projectId)
            break;
        case 'project-pm-t-count':
            count = await model.patternMatchings.totalPMTemplates(projectId)
            break;
        case 'project-rfm-classif-job-count':
            count = await model.classifications.totalRfmClassificationJobs(projectId)
            break;
        case 'project-rfm-sp-count':
            count = await model.classifications.totalRfmSpeciesDetected(projectId)
            break;
        case 'project-rfm-training-job-count':
            count = await model.trainingSets.totalRfmTrainingJobs(projectId)
            break;
        case 'project-aed-job-count':
            count = await model.AudioEventDetectionsClustering.totalAedJobs(projectId)
            break;
        case 'project-clustering-job-count':
            count = await model.ClusteringJobs.totalClusteringJobs(projectId)
            break;
        case 'project-clustering-sp-count':
            count = await model.ClusteringJobs.totalClusteringSpeciesDetected(projectId)
            break;
        case 'project-soundscape-job-count':
            count = await model.soundscapes.totalSoundscapeJobs(projectId)
            break;
    }
    return count || 0
}

const getRandomMin = function(max, min) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// cached_metrics.key is varchar(20) on BOTH engines. On MariaDB (sql_mode
// empty) an over-long key was silently TRUNCATED on INSERT for years, so the
// table holds rows like 'project-10005-aed-jo' -- and the SELECT by the full
// key never matched them, making every long-key request a cold refresh. On
// PostgreSQL the same INSERT fails (22001: value too long for type character
// varying(20)) and the cold path 500s -- measured post-flip 2026-09-12 on
// `project-<id>-aed-job` / `-cl-job` / `-soundsc`, the three 21-char shapes
// on 5-digit project ids. Bounding the key at this single choke point keeps
// SELECT/INSERT/UPDATE consistent with the rows that already exist (the
// maria-truncated forms), so caching RESUMES for those keys instead of
// erroring. Collision analysis (suffix budget = 20 - len('project-<id>-')):
// all 13 suffixes stay unique through 6-digit ids; only at 7 digits would
// the rfm-cl/rfm-sp/rfm-tr triple share one key -- current max legacy
// project id is ~10153, so that horizon is not realistic.
const CACHE_KEY_MAX_LEN = 20
const boundCacheKey = function (v) {
    return (typeof v === 'string' && v.length > CACHE_KEY_MAX_LEN) ? v.slice(0, CACHE_KEY_MAX_LEN) : v
}

// WARM-PATH REFRESH SUPPRESSION (§300 item F, 2026-09-14).
//
// getCachedMetrics answers from cached_metrics FIRST and only then fires a
// refresh, so a refresh that dies is invisible to callers -- which is exactly
// why this ran unnoticed for days. Measured on the PG leader:
//
//   `recording-count` = SELECT count(*) FROM recordings (~305 M rows) takes
//   69-74 s. The routed read path pins statement_timeout=8000 (dbpool-pg.js,
//   `BEGIN READ ONLY; SET LOCAL statement_timeout=...`), so EVERY attempt is
//   cancelled at 8 s. There were ZERO successful `UPDATE ... recording-count`
//   in 3 days of leader log, and 20 of 20 cancels in the 4.9 h window
//   2026-09-14T04:55-09:50Z were this single statement (64 of 100 on 09-13).
//
// Each attempt first takes a 3-minute lock by pushing expires_at forward, then
// dies, so the next caller past the lock retries forever: ~40 cancels/day,
// ~5 min/day of 4-worker parallel leader scan that no user is waiting on.
//
// WHY SUPPRESS RATHER THAN "FIX" IT:
//   * Serving pg_class.reltuples instead would be WORSE: +0.521 % vs the
//     frozen cached value's -0.012 % (~43x less accurate). See getColdEstimate.
//   * No index helps. The cost is heap visits with the visibility map at
//     47.8 % coverage; the composite index the shape suggests already exists
//     and the planner does not choose it.
//   * Making the refresh completable needs a per-statement timeout override in
//     the SHARED read path (TIMEOUT_MS is module-global in dbpool-pg.js). That
//     is a different risk tier and is tracked as its own design item.
//
// So this is deliberately the SMALL change: stop scheduling work that provably
// cannot succeed, and keep serving the value we already serve.
//
// SCOPED TO THE PROVEN CASE ONLY. Verified live 2026-09-14 09:5xZ: of the
// non-project keys, only `recording-count` is stuck (expires_at in the past
// and unchanged across hours); `job-count`, `species-count` and `project-count`
// all refresh normally with positive TTLs, so they are untouched. This is NOT
// a blanket "skip slow refreshes" switch -- adding a key here is a claim that
// its refresh CANNOT complete, and needs the same measurement.
//
// CONSEQUENCE, ACCEPTED AND STATED: the served figure now drifts. The table
// grows ~618 k rows/30 d (~0.2 %/month), so the public tile reads slightly low
// and increasingly so over time. It was ALREADY frozen before this change --
// this makes the freeze honest and cheap instead of hidden and expensive. The
// durable fix is the escape-hatch item above.
const UNWINNABLE_WARM_REFRESH_KEYS = { 'recording-count': true, 'recording-minutes': true }

const isUnwinnableRefresh = function(k) {
    return UNWINNABLE_WARM_REFRESH_KEYS[k] === true
}

const recalculateMetrics = async function(k, v, params, isInsert) {
    // we don't want several Pods to refresh the same value at the same time,
    // so we'll extend expiration of an existing record for the time of our own calculation
    if (!isInsert) {
        const lockExpiresAt = moment.utc().add(3, 'minutes').format('YYYY-MM-DD HH:mm:ss')
        await model.projects.updateExpirationDate({ key: v, expiresAt: lockExpiresAt })
    }

    const value = await getCountForSelectedMetric(k, params)
    const expiresAt = moment.utc().add(METRICS_CACHE_TTL_MIN, 'minutes').add(getRandomMin(0, 60), 'seconds').format('YYYY-MM-DD HH:mm:ss')
    // insertCachedMetrics swallows a duplicate key (a sibling pod won the race
    // to create this cold key -- sqlutil.isDuplicateKeyError, both dialects).
    isInsert ? await model.projects.insertCachedMetrics({ key: v, value, expiresAt }) : await model.projects.updateCachedMetrics({ key: v, value, expiresAt })
    return value
}

const getCachedMetrics = async function(req, res, key, params, next) {
    const k = Object.keys(key)[0]
    const v = boundCacheKey(Object.values(key)[0])
    model.projects.getCachedMetrics(v).then(async function(results) {
        if (!results.length) {
            // COLD KEY: bounded wait, then estimate. See COLD_KEY_BOUND_MS.
            // §297: an unwinnable key (a 55 s leader scan) must NOT be
            // launched from the request path even as a backgrounded promise —
            // the bounded wait still starts the work. Serve the estimate and
            // leave the compute to the out-of-band refresh.
            if (isUnwinnableRefresh(k)) {
                const estimate = await getColdEstimate(k)
                console.log('cached-metrics: cold key ' + v + ' is unwinnable in-request; served ' +
                    (estimate === null ? 'null' : 'estimate ' + estimate) + ', refresh left to out-of-band')
                return res.json(estimate)
            }
            const recalc = recalculateMetrics(k, v, params, true)
            // Attach the background handler FIRST so a rejection after the
            // bound expires is never unhandled (node >= 15 would exit).
            recalc.catch(function(err) {
                console.error('cached-metrics: cold refresh failed for ' + v + ': ' + (err && err.message || err))
            })
            const outcome = await withinBound(recalc, COLD_KEY_BOUND_MS)
            if (!outcome.done) {
                const estimate = await getColdEstimate(k)
                console.log('cached-metrics: cold key ' + v + ' exceeded ' + COLD_KEY_BOUND_MS + ' ms; served ' +
                    (estimate === null ? 'null' : 'estimate ' + estimate) + ', refresh continues')
                return res.json(estimate)
            }
            // Finished inside the bound: serve the truth we just computed.
            // (Do not re-read the row -- a sibling pod's insert may have won
            // and its row can already be reaped; the value is in hand.)
            return res.json(outcome.value)
        }
        const [result] = results
        // The insert above may have lost a race to a sibling pod (handled as a
        // no-op in model.projects.insertCachedMetrics), and the re-read can
        // still come back empty if the freshly-written row expired and was
        // reaped in between. Compute the value directly rather than
        // dereferencing undefined -- without this guard the duplicate-key fix
        // merely moves the 500 from ER_DUP_ENTRY to a TypeError.
        const count = result ? result.value : await getCountForSelectedMetric(k, params)

        res.json(count)

        if (!result) { return null }

        const dateNow = moment.utc().valueOf()
        const dateIndb = moment.utc(result.expires_at).valueOf()
        const isExpiresAtNotValid = !moment.utc(result.expires_at).isValid()
        // Recalculate metrics each day or if the expires_at data not valid, and save the results in the db
        if (isExpiresAtNotValid || (dateNow > dateIndb)) {
            if (isUnwinnableRefresh(k)) {
                // See UNWINNABLE_WARM_REFRESH_KEYS. Serving the cached value
                // above is the whole response; this branch only decides
                // whether to ALSO burn the leader on a refresh that cannot
                // finish. For these keys it cannot, so we skip it.
                return null
            }
            await recalculateMetrics(k, v, params)
        }
    }).catch(next);
}

const getMetrics = async function(req, res, key, params, next) {
    const k = Object.keys(key)[0]
    getCountForSelectedMetric(k, params).then(async function(value) {
        res.json(value);
    }).catch(next);
}

module.exports = {
    getCachedMetrics: getCachedMetrics,
    getMetrics: getMetrics
}
