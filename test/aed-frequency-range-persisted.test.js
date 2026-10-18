/* jshint node:true */
'use strict';
// rfcx-local 2026-10-18 (OPEN-ITEMS §476; support ticket rhammond@frostburg.edu): since the
// in-cluster port (7a046c06, 2026-05-28) enqueueAEDClusteringJob wrote only the five
// thresholds, so the user's Min/Max Frequency was DROPPED (0 of 237 jobs since the port
// carry the keys; 2,202/2,202 before), while the form kept a hard-coded 0-24 kHz box.
// This drives the REAL model file with dbpool stubbed and asserts the persistence rule:
//   (a) both blank                                  -> keys OMITTED (worker = full band)
//   (b) 0-10 on a 48 kHz playlist (Nyquist 24)      -> Min 0 / Max 10 persisted
//   (c) 0-24 on a 192 kHz playlist (Nyquist 96)     -> keys OMITTED (stale-bundle default guard)
//   (d) 1-24 on a 192 kHz playlist                  -> persisted as typed (not the default shape)
//   (e) 0-200 on a 192 kHz playlist                 -> Max clamped to 96
//   (f) min >= max                                   -> rejected, no INSERT
//   (g) min < 0 / non-numeric                        -> rejected, no INSERT
//   (h) band lookup FAILS (unknown Nyquist)          -> 0-10 still persisted, 0-24 persisted as typed
//   (i) the five thresholds are still present and the INSERT shape is unchanged
// RED control: run against the pre-fix model -> (b) FAILS (keys absent).
// Run: node test/aed-frequency-range-persisted.test.js     (exit 1 on any FAIL)
const path = require('path');

let pass = 0, fail = 0;
function ok (label, cond, detail) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label + (detail ? '  [' + detail + ']' : '')); fail++; } }
const ROOT = path.join(__dirname, '..');
function stub (rel, exportsObj) {
    const file = require.resolve(path.join(ROOT, rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}

// ---- dbpool stub: a `query` that answers the band lookup, and a transaction that records INSERTs
let bandRow = null;          // what SELECT MAX(R.sample_rate)… returns; null = throw (lookup failed)
let inserts = [];
function qPromise (v) { const p = Promise.resolve(v); p.get = (i) => Promise.resolve(Array.isArray(v) ? v[i] : (i === 0 ? v : undefined)); return p; }
stub('app/utils/dbpool.js', {
    query: (sql) => {
        if (/MAX\(R\.sample_rate\)/.test(sql)) {
            if (bandRow === 'throw') { const p = Promise.reject(new Error('boom')); p.get = () => Promise.reject(new Error('boom')); return p; }
            return qPromise([bandRow]);
        }
        return qPromise([]);
    },
    escape: (v) => JSON.stringify(v),
    performTransaction: (fn) => {
        const tx = { connection: { promisedQuery: (sql, params) => {
            if (/SELECT project_id FROM playlists/.test(sql)) return Promise.resolve([{ project_id: 10248 }]);
            if (/INSERT INTO `jobs`/.test(sql)) return Promise.resolve({ insertId: 171999 });
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

function job (min, max) {
    const params = { areaThreshold: 1, amplitudeThreshold: 1, durationThreshold: 0.2, bandwidthThreshold: 0.5, filterSize: 10 };
    if (min !== undefined) params.minFrequency = min;
    if (max !== undefined) params.maxFrequency = max;
    return { user_id: 1, name: 'test', playlist_id: 64343, params };
}
async function enqueue (min, max, sr) {
    inserts = [];
    bandRow = sr === 'throw' ? 'throw' : (sr === null ? { max_sr: null, min_sr: null, n_rates: 0 } : { max_sr: sr, min_sr: sr, n_rates: 1 });
    try {
        const r = await M.enqueueAEDClusteringJob(job(min, max));
        const stored = inserts.length ? JSON.parse(inserts[0].params[3]) : null;
        return { ok: true, stored, r };
    } catch (e) {
        return { ok: false, err: e.message, stored: inserts.length ? JSON.parse(inserts[0].params[3]) : null };
    }
}
const THRESH = ['Amplitude Threshold', 'Duration Threshold', 'Bandwidth Threshold', 'Area Threshold', 'Filter Size'];

(async () => {
    let r;
    r = await enqueue(undefined, undefined, 48000);
    ok('(a) both blank -> keys omitted', r.ok && r.stored && !('Max Frequency' in r.stored) && !('Min Frequency' in r.stored), JSON.stringify(r.stored || r.err));
    r = await enqueue(null, null, 48000);
    ok('(a2) both null -> keys omitted', r.ok && r.stored && !('Max Frequency' in r.stored), JSON.stringify(r.stored || r.err));

    r = await enqueue(0, 10, 48000);
    ok('(b) 0-10 on a 48 kHz playlist -> Min 0 / Max 10 persisted', r.ok && r.stored && r.stored['Min Frequency'] === 0 && r.stored['Max Frequency'] === 10, JSON.stringify(r.stored || r.err));
    ok('(i) the five thresholds are still present', r.ok && THRESH.every(k => typeof r.stored[k] === 'number'), JSON.stringify(r.stored));
    ok('(i2) INSERT column list unchanged', r.ok && /\(`name`,`project_id`,`job_id`,`date_created`,`parameters`,`playlist_id`,`user_id`\)/.test(inserts[0].sql));

    r = await enqueue(0, 24, 192000);
    ok('(c) 0-24 on a 192 kHz playlist (stale default) -> keys omitted = full band', r.ok && r.stored && !('Max Frequency' in r.stored), JSON.stringify(r.stored || r.err));
    r = await enqueue(0, 24, 48000);
    ok('(c2) 0-24 on a 48 kHz playlist -> persisted (24 IS its Nyquist)', r.ok && r.stored && r.stored['Max Frequency'] === 24, JSON.stringify(r.stored || r.err));
    r = await enqueue(1, 24, 192000);
    ok('(d) 1-24 on a 192 kHz playlist -> persisted as typed', r.ok && r.stored && r.stored['Min Frequency'] === 1 && r.stored['Max Frequency'] === 24, JSON.stringify(r.stored || r.err));
    r = await enqueue(0, 23.9, 192000);
    ok('(d2) 0-23.9 on a 192 kHz playlist -> persisted as typed', r.ok && r.stored && r.stored['Max Frequency'] === 23.9, JSON.stringify(r.stored || r.err));

    r = await enqueue(0, 200, 192000);
    ok('(e) 0-200 on a 192 kHz playlist -> Max clamped to 96', r.ok && r.stored && r.stored['Max Frequency'] === 96, JSON.stringify(r.stored || r.err));
    r = await enqueue(20, 40, 192000);
    ok('(e2) 20-40 on a 192 kHz playlist -> persisted', r.ok && r.stored && r.stored['Min Frequency'] === 20 && r.stored['Max Frequency'] === 40, JSON.stringify(r.stored || r.err));

    r = await enqueue(10, 10, 48000);
    ok('(f) min == max -> rejected, no INSERT', !r.ok && /greater than min/.test(r.err) && r.stored === null, r.err);
    r = await enqueue(30, 10, 48000);
    ok('(f2) min > max -> rejected, no INSERT', !r.ok && r.stored === null, r.err);
    r = await enqueue(100, 200, 192000);
    ok('(f3) min above the playlist Nyquist -> rejected (max clamps to 96 < min)', !r.ok && r.stored === null, r.err);

    r = await enqueue(-1, 10, 48000);
    ok('(g) min < 0 -> rejected', !r.ok && /0 or greater/.test(r.err), r.err);
    r = await enqueue('abc', 10, 48000);
    ok('(g2) non-numeric -> rejected', !r.ok && /must be numbers/.test(r.err), r.err);

    r = await enqueue(0, 10, 'throw');
    ok('(h) band lookup fails -> 0-10 still persisted (fail-open on the lookup, not on the user)', r.ok && r.stored && r.stored['Max Frequency'] === 10, JSON.stringify(r.stored || r.err));
    r = await enqueue(0, 24, 'throw');
    ok('(h2) band lookup fails -> 0-24 persisted as typed (no Nyquist to compare)', r.ok && r.stored && r.stored['Max Frequency'] === 24, JSON.stringify(r.stored || r.err));
    r = await enqueue(0, 10, null);
    ok('(h3) empty playlist (no rows) -> 0-10 persisted', r.ok && r.stored && r.stored['Max Frequency'] === 10, JSON.stringify(r.stored || r.err));

    r = await enqueue(5, undefined, 48000);
    ok('(j) min only -> Min persisted, Max omitted (worker = file Nyquist)', r.ok && r.stored && r.stored['Min Frequency'] === 5 && !('Max Frequency' in r.stored), JSON.stringify(r.stored || r.err));

    const band = await M.getPlaylistBand(64343);
    ok('getPlaylistBand: 48 kHz -> nyquist 24', band.nyquist_khz === 24 && band.n_rates === 1, JSON.stringify(band));

    console.log(`\n${fail ? 'FAILED' : 'OK'}: ${pass} ok, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CANNOT RUN:', e); process.exit(2); });