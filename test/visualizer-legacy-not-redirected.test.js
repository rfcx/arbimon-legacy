/* jshint node:true */
'use strict';
// The LEGACY visualizer (/project/<slug>/visualizer/...) must stay reachable -- it is
// NOT redirected to the SPA (operator 2026-09-28). Only the app's own links moved to /p/.
// A redirect was shipped by mistake in #1979 and removed; this test keeps it out.
// Run: node test/visualizer-legacy-not-redirected.test.js
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok (label, cond) { if (cond) { console.log('  ok   ' + label); pass++; } else { console.log('  FAIL ' + label); fail++; } }
const src = fs.readFileSync(path.join(__dirname, '..', 'app/routes/index.js'), 'utf8');
// Strip line comments so the kept-for-reference commented block does not count.
const live = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

ok('no live route registration matches /project/:projectUrl/visualizer',
    !/router\.(get|use|all)\(\s*\[?[^)]*['"`]\/project\/:projectUrl\/visualizer/.test(live));
ok('no live redirect targets /p/<slug>/visualizer',
    !/redirect\([^)]*\/p\/[^)]*visualizer/.test(live));
ok('the /project router still mounts (serves the legacy visualizer page)',
    /router\.use\(\s*['"]\/project['"]\s*,\s*project\s*\)/.test(live));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
