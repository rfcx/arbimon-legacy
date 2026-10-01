#!/usr/bin/env node
/**
 * READER GOLDEN — roiSpectrogramUrl() must keep producing the EXACT filenames the
 * prewarm writers produce (bare node, no npm install; run by .github/workflows/pr-gate.yaml).
 *
 * WHY: media-api caches every ROI spectrogram by its exact filename. The prewarm
 * writers (rfcx/arbimon-jobs-analysis PM/AED, rfcx/arbimon-clustering) render ahead
 * of time under the filename THIS function will later request. If the two sides
 * drift by one millisecond or one Hz, every prewarm render is wasted and users pay
 * cold renders — with no error anywhere. That happened: the 2026-08-10 "ROUND ONCE"
 * fix in mediaAssetUrl() moved this side to Math.round while the writer truncated,
 * and ~75-80 % of PM/AED prewarm renders went unread for 7 weeks (rfcx-local
 * runbooks/FINDING-2026-10-01-roi-prewarm-key-truncate-vs-round.md).
 *
 * The writers carry the same fixture; this copy makes a READER-side change fail
 * HERE, in review, instead of in a cache-hit graph weeks later.
 *
 * FIXTURE: prewarm-reader-golden.json — 110 REAL production rows (65 AED, 45 PM;
 * 50 on sub-second recording starts, 34 with a fractional ms >= .5, 32 raw .5 Hz
 * bounds), each with the filename the DEPLOYED reader (b9a434d) built for it from
 * its own DB pool. Inputs are the values the reader receives (PG float4 text -> JS
 * number; datetime_utc -> Date).
 *
 * Also exercises BOTH URL branches (minted direct route with a token salt, and
 * the token-less /legacy-api/ingest fallback): they must name the same object.
 *
 * Exit: 0 pass · 1 mismatch · 2 cannot run (missing fixture / module) — never 0 on a skip.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FIX = path.join(__dirname, 'prewarm-reader-golden.json');
let golden, assetUrl;
try {
    golden = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    assetUrl = require('../../app/utils/asset-url');
} catch (e) {
    console.error(`CANNOT RUN: ${e.message}`);
    process.exit(2);
}
if (!Array.isArray(golden.cases) || golden.cases.length < 50) {
    console.error(`CANNOT RUN: fixture has ${golden.cases && golden.cases.length} cases (expected >= 50)`);
    process.exit(2);
}

function filenameOf (url) {
    return url ? String(url).replace(/\?.*$/, '').replace(/^.*\//, '') : null;
}
function build (c) {
    return assetUrl.roiSpectrogramUrl({
        recUri: c.rec_uri,
        externalId: c.site_external_id,
        datetimeUtc: new Date(c.datetime_utc),
        timeMin: c.det.x1,
        timeMax: c.det.x2,
        freqMin: c.det.y1,
        freqMax: c.det.y2,
        sampleRate: c.sample_rate
    }, { width: 400, height: 400 });
}

let fail = 0;
const branches = [
    ['minted (STREAM_TOKEN_SALT set)', 'reader-golden-test-salt'],
    ['ingest fallback (no salt)', undefined]
];
for (const [label, salt] of branches) {
    if (salt === undefined) delete process.env.STREAM_TOKEN_SALT; else process.env.STREAM_TOKEN_SALT = salt;
    let bad = 0;
    for (const c of golden.cases) {
        const got = filenameOf(build(c));
        if (got !== c.reader_filename_400x400) {
            if (bad < 5) console.log(`FAIL [${label}] ${c.family} ${c.id}\n   got  ${got}\n   want ${c.reader_filename_400x400}`);
            bad++;
        }
    }
    console.log(`${bad ? 'FAIL' : 'PASS'}  ${label}: ${golden.cases.length - bad}/${golden.cases.length} filenames byte-identical`);
    fail += bad;
}

// The fixture must actually exercise the class it guards, or a pass proves nothing.
const fracHalf = golden.cases.filter(c => {
    const s = new Date(c.datetime_utc).getTime() + Math.min(c.det.x1, c.det.x2) * 1000;
    return (s - Math.floor(s)) >= 0.5;
}).length;
const ties = golden.cases.filter(c => [c.det.y1, c.det.y2].some(y => y - Math.floor(y) === 0.5)).length;
console.log(`fixture coverage: ${fracHalf} cases with fractional ms >= .5, ${ties} with a .5 Hz bound`);
if (fracHalf === 0 || ties === 0) { console.log('FAIL  fixture no longer covers the rounding class'); fail++; }

console.log(`RESULT: ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);