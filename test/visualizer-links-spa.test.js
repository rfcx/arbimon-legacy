/* jshint node:true */
'use strict';
// Visualizer links point at the SPA visualizer (/p/<slug>/visualizer/...), not the
// legacy /project/<slug>/visualizer (rfcx-local 2026-09-28).
// Run: node test/visualizer-links-spa.test.js
//
// The share card is exercised for REAL (app/routes/resource-cards/visualizer.js,
// with its two model dependencies stubbed in require.cache). The Angular link
// sites are pinned by source, because this repo has no browser unit harness.
const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
function ok (label, cond) {
    if (cond) { console.log('  ok   ' + label); pass++; }
    else { console.log('  FAIL ' + label); fail++; }
}
const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function stub (rel, exportsObj) {
    const file = require.resolve(path.join(ROOT, rel));
    require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}

(async function () {
    console.log('share card (resource-cards/visualizer.rec)');
    stub('app/model/recordings', {
        findByUrlMatch: () => Promise.resolve([{ id: 314371, site: 'S1', datetime: '2020-01-01', thumbnail: 't.png' }])
    });
    stub('app/utils/project-scope', { recordingUrlOwned: () => Promise.resolve(true) });
    const card = require('../app/routes/resource-cards/visualizer');
    const c = await card.rec({ project_id: 1, url: 'puerto-rico-island-wide' },
        'https://arbimon.org/project/puerto-rico-island-wide/', 'visualizer/rec/314371');
    ok('absolute /p/<slug>/visualizer/rec/<id> on the SAME host (got ' + (c && c.url) + ')',
        c && c.url === 'https://arbimon.org/p/puerto-rico-island-wide/visualizer/rec/314371');
    const c2 = await card.rec({ project_id: 1, url: 'x' }, 'http://localhost:3000/project/x/visualizer/rec/9', 'visualizer/rec/9');
    ok('keeps a non-default host + port (got ' + (c2 && c2.url) + ')', c2 && c2.url === 'http://localhost:3000/p/x/visualizer/rec/314371');

    console.log('Angular link sites (source-pinned)');
    const rf = read('assets/app/app/analysis/random-forest-models/models/index.js');
    ok('RF gotoRec opens /p/<slug>/visualizer/rec/<id>', rf.includes("'/p/' + Project.getUrl() + '/visualizer/rec/' + $scope.selected.id"));
    ok('RF gotoRec no longer uses $location.path(rurl)', !/\$location\.path\(\s*rurl\s*\)/.test(rf));

    const pl = read('assets/app/app/audiodata/playlists/playlists.html');
    ok('playlists View Region uses /p/', pl.includes("'/p/' + projectUrl + '/visualizer/soundscape/'"));
    ok('playlists View Region no longer pipes through the projectUrl filter (/project/ prefix)', !/visualizer\/soundscape[^"]*\|\s*projectUrl/.test(pl));
    ok('PlaylistCtrl exposes projectUrl', read('assets/app/app/audiodata/playlists/playlists.js').includes('$scope.projectUrl = Project.getUrl();'));

    const ts = read('assets/app/app/audiodata/training-sets.html');
    ok('training-sets empty state links to /p/<slug>/visualizer', ts.includes('ng-href="/p/{{ projecturl }}/visualizer"'));
    ok('training-sets no longer uses ui-sref="visualizer"', !ts.includes('ui-sref="visualizer"'));

    const pm = read('assets/app/app/analysis/patternmatching/index.js');
    ok('PM create "Go to Visualizer" leaves for /p/<slug>/visualizer',
        pm.includes("data.url === '/visualizer'") && pm.includes("'/p/' + Project.getUrl() + '/visualizer'"));

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });