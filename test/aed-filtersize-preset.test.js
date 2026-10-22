/* jshint node:true */
'use strict';
// rfcx-local 2026-10-21 (OPEN-ITEMS §476 follow-up; FINDING-2026-10-21-aed-advanced-params-bat-evaluation).
// (A) SERVER: Filter Size < 2 is refused (joi + model). Below 2 the worker's rank filter is
//     int(fs/2) = 0 rows tall, every recording fails, and the job used to finish 'completed'
//     with 0 detections (12 on record). Fractions >= 2 (13.9, 2.5 are on record) stay valid.
// (B) FORM CONTROLLER (the real index.js, loaded with a fake angular):
//     1. advancedParamErrors() names the field and its limit (Filter Size < 2, a blank box);
//        the defaults produce no error; Duration 0.01 is accepted.
//     2. the bat/ultrasonic preset is OPT-IN: never applied on playlist change, only offered
//        when Nyquist > 24, and a no-op on an audible playlist; applying it fills every
//        preset field, sets Max = Nyquist and opens Advanced Parameters.
//     3. the form's defaults are unchanged (audible-range users see no difference).
// RED control: on the pre-fix tree (A) accepts Filter Size 1 and (B) has no
// advancedParamErrors / applyUltrasonicPreset.
// Run: node test/aed-filtersize-preset.test.js     (exit 1 on any FAIL)
const path = require('path');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function ok (label, cond, detail) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label + (detail ? '  [' + detail + ']' : '')); fail++; } }
const ROOT = path.join(__dirname, '..');
function stub (rel, exportsObj) {
    const file = require.resolve(path.join(ROOT, rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}

// ---------------- (A) server ----------------
let inserts = [];
function qPromise (v) { const p = Promise.resolve(v); p.get = (i) => Promise.resolve(Array.isArray(v) ? v[i] : (i === 0 ? v : undefined)); return p; }
stub('app/utils/dbpool.js', {
    query: (sql) => /MAX\(R\.sample_rate\)/.test(sql) ? qPromise([{ max_sr: 250000, min_sr: 250000, n_rates: 1 }]) : qPromise([]),
    escape: (v) => JSON.stringify(v),
    performTransaction: (fn) => {
        const tx = { connection: { promisedQuery: (sql, params) => {
            if (/SELECT project_id FROM playlists/.test(sql)) return Promise.resolve([{ project_id: 10005 }]);
            if (/INSERT INTO `jobs`/.test(sql)) return Promise.resolve({ insertId: 1 });
            if (/INSERT INTO `job_params_audio_event_detection_clustering`/.test(sql)) { inserts.push({ sql, params }); return Promise.resolve({ insertId: 1 }); }
            return Promise.resolve([]);
        } } };
        return Promise.resolve(fn(tx));
    }
});
stub('app/model/dispatch-hint.js', { hint: () => {} });
stub('app/model/tiering.js', { assertJobRecordingLimit: () => Promise.resolve() });
stub('app/config.js', function (k) { return k === 'lambdas' ? { dispatch: 'jobqueue' } : {}; });
const M = require(path.join(ROOT, 'app/model/audio-event-detections-clustering.js'));

function job (filterSize) {
    return { user_id: 1, name: 'fs-test', playlist_id: 64400,
        params: { areaThreshold: 0.02, amplitudeThreshold: 1, durationThreshold: 0.01, bandwidthThreshold: 3, filterSize: filterSize, minFrequency: 15, maxFrequency: 125 } };
}
function attempt (fsv) {
    inserts = [];
    return M.requestNewAudioEventDetectionClusteringJob(job(fsv))
        .then(() => ({ ok: true, n: inserts.length, stored: inserts.length ? inserts[0].params : null }), (e) => ({ ok: false, err: String(e && e.message || e) }));
}
function direct (fsv) {   // the model's own guard, without the joi pass
    inserts = [];
    return Promise.resolve().then(() => M.enqueueAEDClusteringJob(job(fsv)))
        .then(() => ({ ok: true, n: inserts.length }), (e) => ({ ok: false, err: String(e && e.message || e) }));
}

// ---------------- (B) controller ----------------
function loadController () {
    const src = fs.readFileSync(path.join(ROOT, 'assets/app/app/analysis/audio-event-detections-clustering/index.js'), 'utf8');
    const ctrls = {};
    const chain = { config: () => chain, controller: (name, fn) => { ctrls[name] = fn; return chain; }, directive: () => chain, factory: () => chain, service: () => chain };
    vm.runInNewContext(src, { angular: { module: () => chain }, console });
    return ctrls.CreateNewAudioEventDetectionClusteringCtrl;
}
function makeCtrl (nyquist) {
    const Ctor = loadController();
    const thenable = (v) => ({ then: (f) => { const r = f(v); return { catch: () => r, then: (g) => g(r) }; }, catch: () => {} });
    const ctrl = {};
    Ctor.call(ctrl,
        { close: () => {}, dismiss: () => {} },
        { playlistBand: () => thenable({ nyquist_khz: nyquist, n_rates: 1 }), create: () => thenable({}), count: () => thenable({}) },
        { getList: () => thenable([]) },
        { isRfcx: () => false, isSuper: () => false },
        { serverError: () => {} },
        { getAnalysisTieringGuard: () => thenable({ isBlocked: false }), getUrl: () => 'x' });
    return ctrl;
}

(async () => {
    console.log('(A) server');
    const r1 = await attempt(1);
    ok('joi refuses Filter Size 1', !r1.ok && /filterSize/.test(r1.err), JSON.stringify(r1));
    const r19 = await attempt(1.9);
    ok('joi refuses Filter Size 1.9', !r19.ok, JSON.stringify(r19));
    const r2 = await attempt(2);
    ok('Filter Size 2 is enqueued', r2.ok && r2.n === 1, JSON.stringify(r2));
    const r139 = await attempt(13.9);
    ok('Filter Size 13.9 (on record) is still enqueued', r139.ok && r139.n === 1, JSON.stringify(r139));
    const r10 = await attempt(10);
    ok('default Filter Size 10 unchanged', r10.ok && r10.n === 1);
    const d1 = await direct(1);
    ok('model guard (no joi) refuses Filter Size 1, naming the field', !d1.ok && /Filter Size/.test(d1.err), JSON.stringify(d1));

    console.log('(B) form controller');
    let Ctor;
    try { Ctor = loadController(); } catch (e) { Ctor = null; }
    ok('controller loads from the real index.js', typeof Ctor === 'function');
    if (Ctor) {
        const c = makeCtrl(125);
        ok('defaults unchanged (dur 0.2, bw 0.5, area 1, filter 10, amp 1)',
            c.data.params.durationThreshold === 0.2 && c.data.params.bandwidthThreshold === 0.5 && c.data.params.areaThreshold === 1 && c.data.params.filterSize === 10 && c.data.params.amplitudeThreshold === 1);
        ok('advancedParamErrors exists', typeof c.advancedParamErrors === 'function');
        if (typeof c.advancedParamErrors === 'function') {
            ok('defaults -> no errors', c.advancedParamErrors().length === 0, JSON.stringify(c.advancedParamErrors()));
            c.data.params.filterSize = 1;
            const e1 = c.advancedParamErrors();
            ok('Filter Size 1 -> one error naming "Filter Size" and 2', e1.length === 1 && /Filter Size/.test(e1[0]) && /\b2\b/.test(e1[0]), JSON.stringify(e1));
            ok('showAdvancedParamWarning true -> isJobValid false', c.showAdvancedParamWarning() === true);
            c.data.params.filterSize = 2;
            c.data.params.durationThreshold = undefined;   // what angular writes for a below-min number
            const e2 = c.advancedParamErrors();
            ok('blank Duration -> error naming "Duration Threshold"', e2.length === 1 && /Duration Threshold/.test(e2[0]), JSON.stringify(e2));
            c.data.params.durationThreshold = 0.01;
            ok('Duration 0.01 accepted', c.advancedParamErrors().length === 0);
        }

        // preset: opt-in only
        const u = makeCtrl(125);
        ok('applyUltrasonicPreset exists', typeof u.applyUltrasonicPreset === 'function');
        u.onPlaylistChange({ id: 64400 });
        ok('playlist change does NOT apply the preset (filter stays 10, min stays 0)', u.data.params.filterSize === 10 && u.data.params.minFrequency === 0);
        ok('ultrasonic playlist (Nyquist 125) offers the preset', u.isUltrasonicPlaylist && u.isUltrasonicPlaylist() === true);
        if (typeof u.applyUltrasonicPreset === 'function') {
            u.applyUltrasonicPreset();
            const p = u.data.params;
            ok('preset fills E: min 15, max 125, amp 1, dur 0.01, bw 3, area 0.02, filter 2',
                p.minFrequency === 15 && p.maxFrequency === 125 && p.amplitudeThreshold === 1 && p.durationThreshold === 0.01 && p.bandwidthThreshold === 3 && p.areaThreshold === 0.02 && p.filterSize === 2, JSON.stringify(p));
            ok('preset opens Advanced Parameters', u.details.show === true);
            ok('preset values pass the form validation', u.advancedParamErrors().length === 0);
        }
        const a = makeCtrl(24);          // 48 kHz audible
        a.onPlaylistChange({ id: 1 });
        ok('audible playlist (Nyquist 24) does NOT offer the preset', a.isUltrasonicPlaylist && a.isUltrasonicPlaylist() === false);
        if (typeof a.applyUltrasonicPreset === 'function') {
            a.applyUltrasonicPreset();
            ok('preset is a no-op on an audible playlist', a.data.params.filterSize === 10 && a.data.params.minFrequency === 0);
        }
        const h = makeCtrl(48);          // 96 kHz hi-res audible recorder: offered, never forced
        h.onPlaylistChange({ id: 2 });
        ok('96 kHz playlist: preset offered but defaults untouched', h.isUltrasonicPlaylist() === true && h.data.params.filterSize === 10 && h.data.params.minFrequency === 0);
    }

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });