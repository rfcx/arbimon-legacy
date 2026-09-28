/**
 * media-api 400 on the audio route -> a 400 with media-api's reason, not a 500 (rfcx-local 2026-09-28).
 *
 * Runs the REAL downloadAssetFromMediaAPI against a local fake media-api (same `request` stream path as prod):
 *  - 400 with a JSON reason  -> err.mediaApiStatus 400 + err.mediaApiMessage, and NO file left at the cache path;
 *  - 404 / 500               -> err.mediaApiStatus set, NO message, still an error (the route keeps 500 for these);
 *  - 404 must NOT carry `statusCode` (isMissingObjectError would misread a render 404 as "audio gone");
 *  - 200                      -> bytes written, no error (control: the happy path is unchanged).
 */
process.env.STREAM_TOKEN_SALT = process.env.STREAM_TOKEN_SALT || 'test_salt_400';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const recordings = require('../app/model/recordings');

const REC = { id: 1, uri: '2025/08/17/z31eluwckmtx/8e5cdc86-7598-4226-9ae5-660c535f8fb5.flac', external_id: 'z31eluwckmtx', datetime_utc: '2025-08-17T01:00:00.000Z', duration: 60 };

describe('media-api 400 pass-through (audio)', function () {
    let server, port, origGet;
    let reply = { status: 200, body: 'AUDIO' };
    before(function (done) {
        server = http.createServer(function (req, res) {
            res.writeHead(reply.status, { 'content-type': reply.status >= 400 ? 'application/json' : 'audio/mpeg' });
            res.end(reply.body);
        });
        server.listen(0, '127.0.0.1', function () { port = server.address().port; done(); });
        origGet = recordings.getAssetFileFromMediaAPI;
        // same request() stream as prod, pointed at the fake; no auth0 round-trip
        const request = require(require.resolve('request', { paths: [path.join(__dirname, '..'), '/app'] }));
        recordings.getAssetFileFromMediaAPI = async function () { return request({ method: 'GET', url: `http://127.0.0.1:${port}/x`, json: true }); };
    });
    after(function (done) { recordings.getAssetFileFromMediaAPI = origGet; server.close(done); });

    const run = (dest) => new Promise((resolve) => recordings.downloadAssetFromMediaAPI(REC, 'audio', { speed: '5' }, dest, resolve));
    const tmp = () => path.join(os.tmpdir(), 'mapi-400-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.mp3');
    const settle = () => new Promise((r) => setTimeout(r, 150));

    it('🔴 400 -> mediaApiStatus 400 + the reason; nothing cached', async function () {
        reply = { status: 400, body: JSON.stringify({ message: 'With "x", mp3 output is limited to 15 minutes (this request would be 20 minutes).', error: {} }) };
        const dest = tmp();
        const err = await run(dest);
        await settle();
        assert.ok(err, 'expected an error');
        assert.strictEqual(err.mediaApiStatus, 400);
        assert.strictEqual(err.mediaApiMessage, 'With "x", mp3 output is limited to 15 minutes (this request would be 20 minutes).');
        assert.strictEqual(err.statusCode, undefined);
        assert.strictEqual(fs.existsSync(dest), false, 'no partial/garbage file at the cache path');
    });

    it('400 with a non-JSON body -> 400 without a message', async function () {
        reply = { status: 400, body: 'nope' };
        const dest = tmp();
        const err = await run(dest);
        await settle();
        assert.strictEqual(err.mediaApiStatus, 400);
        assert.strictEqual(err.mediaApiMessage, undefined);
        assert.strictEqual(fs.existsSync(dest), false);
    });

    for (const status of [404, 500]) {
        it(`${status} -> still an error, no message, no statusCode (route keeps 500)`, async function () {
            reply = { status, body: JSON.stringify({ message: 'x' }) };
            const dest = tmp();
            const err = await run(dest);
            await settle();
            assert.strictEqual(err.mediaApiStatus, status);
            assert.strictEqual(err.mediaApiMessage, undefined);
            assert.strictEqual(err.statusCode, undefined);
            assert.strictEqual(fs.existsSync(dest), false);
        });
    }

    it('control: 200 writes the bytes, no error', async function () {
        reply = { status: 200, body: 'AUDIO-BYTES' };
        const dest = tmp();
        const err = await run(dest);
        assert.strictEqual(err, null);
        assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'AUDIO-BYTES');
        fs.unlinkSync(dest);
    });
});