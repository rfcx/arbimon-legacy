/* jshint node:true */
'use strict';

// Concurrent identical cache MISSES + the serve-then-unlink callers must not
// lose a request (rfcx-local FINDING-2026-09-27-prc-autogain-concurrent-legacy-audio).
// Run: node test/tmpfilecache-concurrent-miss.test.js
//
// The defect, reproduced on the production model code in the demo pod: every
// audio/image route does `fetch(key) -> res.sendFile(file.path) -> fs.unlink(file.path)`.
// Both requests for one recording shared ONE cache path. The first to finish
// sending unlinked it while the second was between its own miss and its stat, or
// was about to open it, so the second answered 500 ENOENT (6-7 of 10
// concurrent pairs). The in-flight de-dupe at the top of fetch() had been
// commented out (2024-04-17 #1507), so both requests ran their own miss.
//
// Fix under test: (1) fetch() joins an in-flight miss for the same key instead
// of starting a second one; (2) every fetch() callback gets its OWN path (a
// hard link to the cached bytes), so a caller that unlinks after sending
// removes only its own link.
//
// These tests exercise the REAL app/utils/tmpfilecache.js in a throwaway dir.
// NEGATIVE CONTROL: run against the pre-fix module (git stash) and the
// 'concurrent misses' and 'unlink does not hurt a sibling' cases FAIL.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfc-test-'));
process.env.TMPFILECACHE_PATH = dir;
process.env.TMPFILECACHE_MAXOBJECTLIFETIME = '86400000';
process.env.TMPFILECACHE_CLEANUPINTERVAL = '14400000';
process.env.TMPFILECACHE_INFLIGHTJOINTIMEOUT = '300'; // keep the orphaned-miss case fast
process.env.TMPFILECACHE_HANDOUTREAPDELAY = '150';    // keep the disk-lifetime case fast
const cache = require(path.resolve(__dirname, '..', 'app', 'utils', 'tmpfilecache.js'));

let failed = 0;
const results = [];
async function test(name, fn) {
    try { await fn(); results.push('ok   ' + name); }
    catch (e) { failed++; results.push('FAIL ' + name + '\n     ' + String(e && e.message).split('\n')[0].slice(0, 300)); }
}

// The serve-then-unlink callers (asset routes, export job) opt in to their own link.
const fetchP = (key, onmiss) => new Promise((resolve) => {
    cache.fetch(key, onmiss, (err, data) => resolve({ err, data }), { ownLink: true });
});
// Internal readers that KEEP the file (fetchInfo, render inputs, scidx) use the default.
const fetchShared = (key, onmiss) => new Promise((resolve) => {
    cache.fetch(key, onmiss, (err, data) => resolve({ err, data }));
});
// The route's exact tail: read the file (sendFile), THEN unlink the path it was given.
const serveThenUnlink = ({ err, data }) => new Promise((resolve) => {
    if (err || !data) return resolve({ status: 500, why: String(err && (err.code || err)) });
    fs.readFile(data.path, (e, buf) => {
        fs.unlink(data.path, () => {});
        resolve(e ? { status: 500, why: e.code } : { status: 200, bytes: buf.length, body: buf.toString() });
    });
});
// A miss that renders slowly the way downloadAssetFromMediaAPI does: the write
// stream on cache_miss.file is OPENED when the response starts and closed when
// it ends, so a sibling's unlink in between orphans the inode being written.
const slowMiss = (body, ms, counter) => (miss) => {
    counter.n++;
    const ws = fs.createWriteStream(miss.file);
    ws.on('error', (e) => miss.resolveWaiting(e));
    ws.on('close', () => miss.retry_get());
    setTimeout(() => { ws.end(body); }, ms);
};

(async () => {
    await test('control: a single miss serves 200 with the rendered bytes', async () => {
        const c = { n: 0 };
        const r = await serveThenUnlink(await fetchP('rec-control.mp3', slowMiss('AAAA', 30, c)));
        assert.strictEqual(r.status, 200); assert.strictEqual(r.body, 'AAAA'); assert.strictEqual(c.n, 1);
    });

    await test('concurrent identical misses: ALL requests 200 (20 pairs, staggers 0-40 ms)', async () => {
        const bad = [];
        for (let i = 0; i < 20; i++) {
            const c = { n: 0 };
            const key = `rec-pair-${i}.mp3`;
            const first = fetchP(key, slowMiss('BODY' + i, 25, c)).then(serveThenUnlink);
            await new Promise((r) => setTimeout(r, (i % 5) * 10));
            const second = fetchP(key, slowMiss('BODY' + i, 25, c)).then(serveThenUnlink);
            const [a, b] = await Promise.all([first, second]);
            if (a.status !== 200 || b.status !== 200 || a.body !== b.body) bad.push({ i, a: a.status + ':' + (a.why || ''), b: b.status + ':' + (b.why || '') });
        }
        assert.ok(bad.length === 0, bad.length + '/20 pairs had a failed request: ' + JSON.stringify(bad.slice(0, 3)));
    });

    await test('concurrent identical misses render ONCE (the in-flight miss is joined)', async () => {
        const c = { n: 0 };
        const ps = [0, 1, 2, 3].map(() => fetchP('rec-once.mp3', slowMiss('ONCE', 40, c)).then(serveThenUnlink));
        const rs = await Promise.all(ps);
        assert.deepStrictEqual(rs.map((r) => r.status), [200, 200, 200, 200]);
        assert.strictEqual(c.n, 1, 'oncachemiss ran ' + c.n + ' times for one key');
    });

    await test('unlink after send does not hurt a sibling holding the same key (warm cache)', async () => {
        const c = { n: 0 };
        await serveThenUnlink(await fetchP('rec-warm.mp3', slowMiss('WARM', 5, c)));
        // re-populate, then hand out two paths and unlink the first BEFORE the second reads
        const a = await fetchP('rec-warm.mp3', slowMiss('WARM', 5, c));
        const b = await fetchP('rec-warm.mp3', slowMiss('WARM', 5, c));
        assert.ok(a.data && b.data, 'both fetches returned a file');
        fs.unlinkSync(a.data.path);
        assert.strictEqual(fs.readFileSync(b.data.path, 'utf8'), 'WARM');
        fs.unlinkSync(b.data.path);
    });

    await test('a failed miss rejects EVERY joined waiter and caches nothing', async () => {
        let n = 0;
        const boom = (miss) => { n++; setTimeout(() => miss.resolveWaiting(new Error('media-api returned 500')), 20); };
        const rs = await Promise.all([fetchP('rec-fail.mp3', boom), fetchP('rec-fail.mp3', boom)]);
        assert.ok(rs[0].err && rs[1].err, 'both waiters saw the error');
        assert.ok(!fs.existsSync(cache.key2File('rec-fail.mp3')), 'no cache file for a failed render');
        // the next request re-tries the render (the in-flight entry was cleared)
        const c = { n: 0 };
        const r = await serveThenUnlink(await fetchP('rec-fail.mp3', slowMiss('OK', 5, c)));
        assert.strictEqual(r.status, 200); assert.strictEqual(c.n, 1);
    });

    await test('an ORPHANED miss (handler reports its error elsewhere, never resolves) does not hang a joiner', async () => {
        // recordings.fetchAudioFile's legacy branch does `if(err) return callback(err)` inside its miss
        // handler: the error goes to the FIRST request's own callback and the CacheMiss never resolves.
        const orphan = () => { /* never resolves the miss */ };
        cache.fetch('rec-orphan.mp3', orphan, () => {});
        const t0 = Date.now();
        const c = { n: 0 };
        const r = await serveThenUnlink(await fetchP('rec-orphan.mp3', slowMiss('LATE', 5, c)));
        const waited = Date.now() - t0;
        assert.strictEqual(r.status, 200, 'joiner served after the bound');
        assert.strictEqual(c.n, 1, 'the joiner rendered for itself');
        assert.ok(waited < 2000, 'waited ' + waited + ' ms (bound is 300)');
    });

    await test('disk lifetime unchanged: once every caller unlinked its link, the cached original goes too', async () => {
        const c = { n: 0 };
        const shared = cache.key2File('rec-reap.mp3');
        const rs = await Promise.all([0, 1].map(() => fetchP('rec-reap.mp3', slowMiss('REAP', 20, c)).then(serveThenUnlink)));
        assert.deepStrictEqual(rs.map((r) => r.status), [200, 200]);
        await new Promise((r) => setTimeout(r, 600));
        assert.ok(!fs.existsSync(shared), 'shared original still on disk after all links were released');
        const left = fs.readdirSync(dir).filter((f) => f.indexOf(path.basename(shared, '.mp3')) === 0);
        assert.deepStrictEqual(left, [], 'leftover files: ' + left.join(','));
    });

    await test('a caller that KEEPS its file (tile shape) keeps the original alive', async () => {
        const c = { n: 0 };
        const shared = cache.key2File('rec-keep.png');
        const r = await fetchP('rec-keep.png', slowMiss('TILE', 5, c));
        await new Promise((res) => setTimeout(res, 600));
        assert.ok(fs.existsSync(r.data.path), 'the caller link is intact');
        assert.ok(fs.existsSync(shared), 'the original is kept while a link is held');
        fs.unlinkSync(r.data.path);
    });

    await test('cachePath = the shared cache path (legacy tiles derive <sha>.tile_x_y.png from it)', async () => {
        const c = { n: 0 };
        const r = await fetchP('rec-tiles.png', slowMiss('PNG', 5, c));
        assert.strictEqual(r.data.cachePath, cache.key2File('rec-tiles.png'));
        assert.notStrictEqual(r.data.path, r.data.cachePath);
        const tileName = /(.+)\.png$/.exec(r.data.cachePath)[1] + '.tile_0_0.png';
        assert.strictEqual(tileName, cache.key2File('rec-tiles.tile_0_0.png'), 'tile name derived from cachePath == the key fetchOneSpectrogramTile looks up');
        fs.unlinkSync(r.data.path);
    });

    await test('default (no ownLink): the SHARED path, no extra link left behind (internal readers)', async () => {
        const c = { n: 0 };
        const r = await fetchShared('rec-shared.wav', slowMiss('RAW', 5, c));
        assert.strictEqual(r.data.path, cache.key2File('rec-shared.wav'));
        const stem = path.basename(cache.key2File('rec-shared.wav'), '.wav');
        const names = fs.readdirSync(dir).filter((f) => f.indexOf(stem) !== -1);
        assert.deepStrictEqual(names, [path.basename(r.data.path)], 'only the cache file itself: ' + names.join(','));
        assert.strictEqual(fs.statSync(r.data.path).nlink, 1);
    });

    await test('default callers still JOIN an in-flight render (render once)', async () => {
        const c = { n: 0 };
        const rs = await Promise.all([0, 1, 2].map(() => fetchShared('rec-shared-once.wav', slowMiss('ONE', 30, c))));
        assert.ok(rs.every((r) => r.data && r.data.path === cache.key2File('rec-shared-once.wav')));
        assert.strictEqual(c.n, 1, 'rendered ' + c.n + 'x');
    });

    await test('the handed-out path keeps the cache file extension (Content-Type / filename depend on it)', async () => {
        const c = { n: 0 };
        const r = await fetchP('rec-ext.wav', slowMiss('WAVE', 5, c));
        assert.strictEqual(path.extname(r.data.path), '.wav');
        fs.unlinkSync(r.data.path);
    });

    for (const l of results) console.log(l);
    fs.rmSync(dir, { recursive: true, force: true });
    if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
    console.log('all passed');
    process.exit(0);
})();