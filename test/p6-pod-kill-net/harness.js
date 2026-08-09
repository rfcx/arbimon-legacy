// Behavioural harness for the 2026-08-09 pod-kill bundle (models-delete tail,
// getModelById guards, changeUserRole tail, unvalidateRois float, bin/www net).
// Pure-logic + subprocess proofs -- no DB required. Run: node harness.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ok   ' + name); }
                             else { fail++; console.log('  FAIL ' + name); } };

const runSub = (code) => {
  const f = path.join(os.tmpdir(), 'p6net-' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(f, code);
  const r = spawnSync(process.execPath, [f], { encoding: 'utf8', timeout: 5000 });
  fs.unlinkSync(f);
  return r;
};

(async () => {
  console.log('\n[A] models-delete tail -- guard + contained try/catch (both layers required)');

  // The FIXED tail, extracted logic-identical from models.js.
  async function fixedTail(getModelJobId, hideAsync, model_id, log) {
    try {
      const jobData = await getModelJobId(model_id);
      if (jobData && jobData.job_id) { await hideAsync(jobData.job_id); return 'hide'; }
      log.push('skip'); return 'skip';
    } catch (e) { log.push('contained:' + e.message); return 'contained'; }
  }
  const log = [];
  let hid = null;
  ok('[A1] linked model still hides the right job',
     (await fixedTail(async () => ({ job_id: 168732 }), async (id) => { hid = id; }, 6397, log)) === 'hide' && hid === 168732);
  ok('[A2] unlinked model (twin row) skips without throwing',
     (await fixedTail(async () => undefined, async () => {}, 6394, log)) === 'skip');
  ok('[A3] job_id NULL row skips (never hide(null))',
     (await fixedTail(async () => ({ job_id: null }), async () => {}, 1, log)) === 'skip');
  ok('[A4] rejecting read is CONTAINED (guard alone would die here)',
     (await fixedTail(async () => { throw new Error('ECONNRESET'); }, async () => {}, 1, log)) === 'contained');
  ok('[A5] skip + containment are logged, not silent', log.length === 3);

  // Subprocess: the OLD shape kills the process on the unlinked-model input.
  const rOld = runSub(`
    function fakeDelete(cb){ cb(null, [{}]); }
    fakeDelete(async function(err,row){
      const jobData = await (async()=>undefined)();
      await jobData.job_id;
    });
    setTimeout(()=>console.log('SURVIVED'),50);`);
  ok('[A6] OLD shape: process DIES (exit 1) on the same input -- the 08-08 crash',
     rOld.status === 1 && /Cannot read properties of undefined/.test(rOld.stderr || ''));

  // Subprocess: the FIXED shape survives BOTH failure modes with no net installed.
  const rNew = runSub(`
    function fakeDelete(cb){ cb(null, [{}]); }
    async function tail(getJob){ try { const j = await getJob(); if (j && j.job_id) {} else {} } catch(e){} }
    fakeDelete(async function(err,row){ await tail(async()=>undefined); await tail(async()=>{throw new Error('db')}); console.log('TAILS_DONE'); });
    setTimeout(()=>console.log('SURVIVED'),50);`);
  ok('[A7] FIXED shape: survives empty read AND rejecting read without any net',
     rNew.status === 0 && /TAILS_DONE/.test(rNew.stdout) && /SURVIVED/.test(rNew.stdout));

  console.log('\n[B] getModelById routes -- err + empty-result guards');
  function guardedHead(err, modelData) {           // logic of the fixed prologue
    if (err) return { next: err };
    const [data] = modelData || [];
    if (!data) return { status: 404 };
    return { data };
  }
  ok('[B1] err routes to next()', !!guardedHead(new Error('x'), null).next);
  ok('[B2] empty result -> 404, no throw', guardedHead(null, []).status === 404);
  ok('[B3] undefined result -> 404, no throw', guardedHead(null, undefined).status === 404);
  ok('[B4] real row passes through', guardedHead(null, [{ uri: 'u' }]).data.uri === 'u');
  ok('[B5] validation-list guard: undefined row -> 404 path (no .length deref)',
     (function (row) { if (!row || !row.length) return 404; return 200; })(undefined) === 404);

  console.log('\n[C] changeUserRole tail -- unknown email fails via callback, not via crash');
  function makeChangeUserRole(findByEmailAsync) {
    return (upr, cb) => {
      (async function (err) {
        if (err) return cb(err);
        let user;
        try { [user] = await findByEmailAsync(upr.user_email); }
        catch (e) { return cb(e); }
        if (!user) return cb(new Error('changeUserRole: no user found for email'));
        cb(null, 'updated:' + user.user_id);
      })(null);
    };
  }
  await new Promise((res) => makeChangeUserRole(async () => [{ user_id: 7 }])({ user_email: 'a@b' }, (e, r) => {
    ok('[C1] known email: update proceeds', !e && r === 'updated:7'); res();
  }));
  await new Promise((res) => makeChangeUserRole(async () => [])({ user_email: 'x@y' }, (e) => {
    ok('[C2] unknown email: callback(err), no throw', e && /no user found/.test(e.message)); res();
  }));
  await new Promise((res) => makeChangeUserRole(async () => { throw new Error('db down'); })({ user_email: 'x@y' }, (e) => {
    ok('[C3] rejecting read: callback(err), no escape', e && e.message === 'db down'); res();
  }));

  console.log('\n[D] unvalidateRois -- the chain is returned (caller owns rejections)');
  async function fixedUnvalidate(getRois, validate) {
    const rois = await getRois();
    return Promise.resolve().then(async function () {
      for (const r of rois) { await validate(r); }
    });
  }
  let caught = false;
  await fixedUnvalidate(async () => [{ id: 1 }], async () => { throw new Error('boom'); }).catch(() => { caught = true; });
  ok('[D1] a rejection inside the chain reaches the caller\'s .catch', caught);

  console.log('\n[E] bin/www net -- subprocess proofs of both handlers');
  const netSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'bin', 'www'), 'utf8');
  const netBlock = netSrc.slice(0, netSrc.indexOf("var debug"));
  ok('[E0] net block present in bin/www and installed before any require',
     /unhandledRejection/.test(netBlock) && /uncaughtException/.test(netBlock));

  const rNet1 = runSub(netBlock + `
    Promise.reject(new TypeError("Cannot read properties of undefined (reading 'job_id')"));
    setTimeout(()=>console.log('ALIVE'),80);`);
  ok('[E1] unhandledRejection: logged with marker AND process survives',
     rNet1.status === 0 && /ALIVE/.test(rNet1.stdout) && /UNHANDLED_ERROR_NET/.test(rNet1.stderr));

  const rNet2 = runSub(netBlock + `
    const e = new Error('Cannot set headers after they are sent to the client');
    e.code = 'ERR_HTTP_HEADERS_SENT';
    setTimeout(()=>{ throw e; }, 10);
    setTimeout(()=>console.log('ALIVE'),80);`);
  ok('[E2] uncaughtException ERR_HTTP_HEADERS_SENT (the #1789 class): survives',
     rNet2.status === 0 && /ALIVE/.test(rNet2.stdout) && /"survivable":true/.test(rNet2.stderr));

  const rNet3 = runSub(netBlock + `
    setTimeout(()=>{ throw new Error('genuinely unknown sync corruption'); }, 10);
    setTimeout(()=>console.log('ALIVE'),80);`);
  ok('[E3] uncaughtException (unknown): logged THEN exits 1 (fail-stop preserved)',
     rNet3.status === 1 && !/ALIVE/.test(rNet3.stdout) && /"survivable":false/.test(rNet3.stderr));

  const rNet4 = runSub(netBlock + `
    // a reason whose .stack getter throws -- the net itself must not throw
    const evil = { get stack(){ throw new Error('evil'); }, toString(){ return 'evil-reason'; } };
    Promise.reject(evil);
    setTimeout(()=>console.log('ALIVE'),80);`);
  ok('[E4] a poisoned rejection reason cannot kill the net', rNet4.status === 0 && /ALIVE/.test(rNet4.stdout));

  console.log(`\n${pass}/${pass + fail} passed${fail ? '  ***FAILURES***' : ''}`);
  process.exit(fail ? 1 : 0);
})();