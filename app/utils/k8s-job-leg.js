/* jshint node:true */
"use strict";

/**
 * SHARED k8s "job leg" dispatch helper — OPEN-ITEMS §300 item 2.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS FIXES
 * ─────────────────────────────────────────────────────────────────────────────
 * Every analysis-job create route enqueues work by INSERTing a `jobs` row with
 * state='waiting' (model/jobs.js newJob → the row's DB default is 'waiting').
 * THAT INSERT IS THE ENQUEUE: in rfcx-local the in-cluster jobqueue-dispatcher
 * polls `state='waiting'` and runs the worker. The job runs and completes.
 *
 * AFTER that successful enqueue, three routes ALSO issued a Kubernetes Job POST
 * (the original AWS-EKS execution path) and treated ITS failure as a CREATE
 * failure:
 *
 *   POST …/soundscape/single-batch   → 200 {"err":"Could not create soundscape job"}
 *   POST …/models/new                → 200 {"err":"Could not create training job"}
 *   POST …/classifications/new       → 200 {"err":"Could not create classification job"}
 *
 * …while jobs 169872 / 169894 / 169895 were created, ran, and reached
 * `completed`. Measured four times across three routes during the 2026-09-11/12
 * traffic exercise (runbooks/evidence/p7-traffic-B-20260911.md finding 2;
 * …B-residual3-20260912.md §anomalies 1).
 *
 * In rfcx-local that POST is dead BY CONSTRUCTION, re-derived live 2026-09-13:
 *   - K8S_NAMESPACE=arbimon-jobs-production            → namespace NotFound
 *   - pod SA system:serviceaccount:apps-prod:default   → 403 on jobs.batch
 *   - K8S_*IMAGEPATH point at an ECR registry this cluster does not use
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS REUSES `ANALYSIS_DISPATCH` RATHER THAN A NEW FLAG
 * ─────────────────────────────────────────────────────────────────────────────
 * The switch already exists and is already live. `ANALYSIS_DISPATCH=jobqueue`
 * (or config('lambdas').dispatch === 'jobqueue') is the established rfcx-local
 * gate for "the in-cluster dispatcher owns dispatch, do not use the AWS path".
 * It is honoured today by:
 *
 *   - model/pattern_matchings.js              (lambda.invoke  → enqueue)
 *   - model/audio-event-detections-clustering.js (lambda.invoke → enqueue)
 *   - model/clustering-jobs.js                 (`if (useJobqueue) return;`
 *                                               skipping THIS VERY k8s POST)
 *
 * clustering-jobs.js is the precedent: same mechanism, same skip, already
 * shipped. Adding a second, differently-named flag for the same decision would
 * leave one mechanism with two switches that can disagree. So this helper
 * exports that one predicate and the three remaining legs call it.
 *
 * THE UPSTREAM (AWS EKS) DEPLOYMENT IS PRESERVED. Nothing is deleted: with
 * ANALYSIS_DISPATCH unset (the upstream default — config/lambdas.json ships no
 * `dispatch` key) `jobLegEnabled()` is false→ the POST runs exactly as today.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SECOND HALF: AN ENABLED LEG THAT FAILS IS STILL NOT A CREATE FAILURE
 * ─────────────────────────────────────────────────────────────────────────────
 * Even where the leg IS enabled, the `jobs` row is already committed and a
 * dispatcher (or the EKS controller) will claim it. Reporting the POST's error
 * as "Could not create … job" tells the user their work was lost when it was
 * not. `dispatchJobLeg` therefore RESOLVES on a leg failure and reports it
 * through `warning`, so the route can answer `{ ok: … }` and still surface that
 * the scheduler leg degraded.
 */

const config = require('../config');

/**
 * Is the direct Kubernetes Job POST leg the execution path in THIS deployment?
 *
 * false  ⇒ an in-cluster job queue owns dispatch; the `jobs` row IS the enqueue
 *          and the POST must not run (and must never be reported to the user).
 * true   ⇒ upstream/AWS-EKS shape: the POST is the execution path, run it.
 *
 * Read at call time (not module load) so tests and a config reload both see it.
 */
function jobLegEnabled() {
    const lambdas = config('lambdas');
    const viaConfig = !!(lambdas && lambdas.dispatch === 'jobqueue');
    const viaEnv = process.env.ANALYSIS_DISPATCH === 'jobqueue';
    return !(viaConfig || viaEnv);
}

let announced = false;

/**
 * Run the k8s Job POST leg if this deployment uses it, and NEVER let its
 * outcome be mistaken for a failure to create the job.
 *
 * @param {Object}   opts
 * @param {String}   opts.jobType  human label for logs ('classification', …)
 * @param {Number|String} opts.jobId  the already-created jobs.job_id
 * @param {Function} opts.post     () => Promise — issues the k8s jobs.post
 * @returns {Promise<{dispatched: Boolean, warning: String|null}>}
 *          Resolves in every case. Rejects only on a programming error
 *          (a missing `post`), never on a leg failure.
 */
function dispatchJobLeg(opts) {
    const jobType = (opts && opts.jobType) || 'analysis';
    const jobId = opts && opts.jobId;

    if (!jobLegEnabled()) {
        if (!announced) {
            announced = true;
            console.log('[k8s-job-leg] k8s job leg disabled (ANALYSIS_DISPATCH=jobqueue); ' +
                        'the jobs row IS the enqueue — the dispatcher claims waiting rows');
        }
        return Promise.resolve({ dispatched: false, warning: null });
    }

    return Promise.resolve()
        .then(() => opts.post())
        .then(() => ({ dispatched: true, warning: null }))
        .catch((err) => {
            // The jobs row exists and will be claimed. Do NOT surface this as a
            // create failure — log it loudly, hand back a warning, resolve.
            console.error('[k8s-job-leg] scheduler leg FAILED for ' + jobType +
                          ' job ' + jobId + ' — the job row exists and will be ' +
                          'claimed; NOT reporting a create failure:',
                          (err && err.message) || err);
            return { dispatched: false, warning: 'scheduler leg failed' };
        });
}

/** Test-only: reset the once-per-process startup log latch. */
function _resetAnnouncedForTests() {
    announced = false;
}

module.exports = { jobLegEnabled, dispatchJobLeg, _resetAnnouncedForTests };
