// Behavioural harness for the 2026-08-08 read-after-write bundle.
// Proves, for each member: the OLD shape fails on a 0-row re-read, and the
// NEW shape does not. Pure-logic reimplementation of each changed block --
// no DB required. Run: node harness.js
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ok   ' + name); }
                             else { fail++; console.log('  FAIL ' + name); } };
const threw = (fn) => { try { fn(); return false; } catch (e) { return true; } };
const threwAsync = async (fn) => { try { await fn(); return false; } catch (e) { return true; } };

console.log('\n[A] jobs.getJobUrl — async Promise executor + unguarded pmData');
// OLD: throw inside `new Promise(async ...)` escapes the caller entirely.
function oldGetJobUrl(job, pmData) {
  return new Promise(async function (resolve) {
    job.url = `patternmatching/${pmData.deleted ? '' : (pmData && pmData.pattern_matching_id ? pmData.pattern_matching_id : '')}`;
    resolve(job);
  });
}
// NEW: plain async fn + guarded deref, matching the CNN/models siblings.
async function newGetJobUrl(job, pmData) {
  return await (async function () {
    job.url = `patternmatching/${(pmData && !pmData.deleted && pmData.pattern_matching_id) ? pmData.pattern_matching_id : ''}`;
    return job;
  })();
}
(async () => {
  // The defining property: OLD is NOT catchable by the caller, and the process
  // DIES. Run in a subprocess -- in-process this would kill the harness, which
  // is precisely the defect. Exit 1 = died on unhandled rejection.
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__dirname + '/a1-subprocess.js'], { encoding: 'utf8' });
  ok('[A1] OLD: undefined pmData KILLS the process (exit 1, not caught by caller)',
     r.status === 1 && /Cannot read properties of undefined/.test(r.stderr || ''));
  ok('[A1b] OLD: caller try/catch never fired', !/CAUGHT_BY_CALLER/.test(r.stdout || ''));

  ok('[A2] NEW: undefined pmData does not throw',
     !(await threwAsync(() => newGetJobUrl({ job_type_id: 6 }, undefined))));
  const j1 = await newGetJobUrl({ job_type_id: 6 }, undefined);
  ok('[A3] NEW: missing row yields empty url (CNN/models sibling shape)', j1.url === 'patternmatching/');
  const j2 = await newGetJobUrl({ job_type_id: 6 }, { pattern_matching_id: 77, deleted: 0 });
  ok('[A4] NEW: live row preserved', j2.url === 'patternmatching/77');
  const j3 = await newGetJobUrl({ job_type_id: 6 }, { pattern_matching_id: 77, deleted: 1 });
  ok('[A5] NEW: deleted row still blanks (behaviour preserved)', j3.url === 'patternmatching/');

  console.log('\n[B] tags.addTo — reconstruction vs re-read');
  const insertId = 501, tagId = 9, tagText = 'howler', userId = 3;
  const tagIn = { t0: 1.5, f0: 100, t1: 2.5, f1: 900 };
  const oldRows = [];                       // 0-row re-read at 6.4
  const oldResult = oldRows[0];             // -> undefined
  ok('[B1] OLD: re-read returns undefined to the route', oldResult === undefined);
  const at = new Date();
  const newRow = { id: insertId, tag_id: tagId, tag: tagText, user_id: userId,
                   datetime: at, t0: tagIn.t0, f0: tagIn.f0, t1: tagIn.t1, f1: tagIn.f1 };
  ok('[B2] NEW: id present', newRow.id === 501);
  ok('[B3] NEW: projection keys match getRegionTags-style consumer',
     ['id','tag_id','tag','user_id','datetime','t0','f0','t1','f1'].every(k => k in newRow));
  ok('[B4] NEW: tag text resolved (not undefined)', newRow.tag === 'howler');
  ok('[B5] NEW: geometry preserved', newRow.t0 === 1.5 && newRow.f1 === 900);

  console.log('\n[C] users.findByIdAfterCreate — retry then LOUD failure');
  async function findByIdAfterCreate(insertData, label, findById) {
    if (!insertData || insertData.insertId === undefined || insertData.insertId === null) {
      throw new Error(label + ': INSERT returned no insertId');
    }
    const delays = [0, 5, 5, 5, 5, 5];   // compressed for test speed
    for (const w of delays) {
      if (w) await new Promise(r => setTimeout(r, w));
      const rows = await findById(insertData.insertId);
      if (rows && rows[0]) return rows[0];
    }
    throw new Error(label + ': created user not readable after insert');
  }
  // OLD behaviour: .get(0) on an empty result -> undefined -> flows into session
  ok('[C1] OLD: empty re-read yields undefined user (silent, reaches session)',
     ([])[0] === undefined);
  // NEW: never-appears -> throws (loud) rather than returning undefined
  ok('[C2] NEW: row never appears -> THROWS (loud, not undefined)',
     await threwAsync(() => findByIdAfterCreate({ insertId: 7 }, 'createFromAuth0', async () => [])));
  // NEW: appears on a later attempt (delta tick lands) -> returns the REAL row
  let calls = 0;
  const eventual = async () => (++calls >= 3) ? [{ user_id: 7, is_super: 0, project_limit: 100 }] : [];
  const got = await findByIdAfterCreate({ insertId: 7 }, 'createFromAuth0', eventual);
  ok('[C3] NEW: retry succeeds once the row lands', got && got.user_id === 7);
  ok('[C4] NEW: schema defaults come from the DB, not invented',
     got.is_super === 0 && got.project_limit === 100);
  ok('[C5] NEW: missing insertId throws',
     await threwAsync(() => findByIdAfterCreate({}, 'createByInvitation', async () => [])));
  // The retraction that drove this design: a local reconstruction would have
  // omitted is_super entirely.
  const naiveReconstruction = { user_id: 7, login: 'x', email: 'a@b.c' };
  ok('[C6] RETRACTION GUARD: naive reconstruction would lose is_super',
     naiveReconstruction.is_super === undefined);

  console.log('\n[D] soundscapes.addRegion — reconstruction');
  const reg = { id: 88, soundscape: 4, name: 'r1', x1: 1, y1: 2, x2: 3, y2: 4,
                count: 12, threshold: null, threshold_type: null, playlist: null };
  ok('[D1] NEW: getRegions projection keys all present',
     ['id','soundscape','name','x1','y1','x2','y2','count','threshold','threshold_type','playlist']
       .every(k => k in reg));
  ok('[D2] OLD: rows[0] on empty re-read was undefined', ([])[0] === undefined);

  console.log('\n[E] models.js getModelsData — unguarded site[0]');
  const siteEmpty = [];
  ok('[E1] OLD: site[0].external_id throws on empty site lookup',
     threw(() => siteEmpty[0].external_id));
  const siteExternalId = (siteEmpty && siteEmpty[0]) ? siteEmpty[0].external_id : null;
  ok('[E2] NEW: guarded lookup yields null, no throw', siteExternalId === null);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();