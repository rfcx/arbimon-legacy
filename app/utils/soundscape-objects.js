/* jshint node:true */
'use strict';
/**
 * Where a soundscape's objects live (2026-09-25, operator goifirr 22:12 #3 +
 * 23:32 step 1).
 *
 * Soundscape objects (index.scidx, peaknumbers.json, h.json, aci.json) move OUT
 * of the `arbimon2` bucket into their own bucket `arbimon-soundscapes`
 * (hot -> cold-a -> B2 b2b), with a flat key layout:
 *
 *     NEW (primary):   arbimon-soundscapes / <soundscape_id>/<file>
 *     OLD (fallback):  arbimon2            / project_<pid>/soundscapes/<sid>/<file>
 *
 * During the move every READER tries NEW first and falls back to OLD on a miss,
 * so nothing breaks mid-copy; writers (the soundscape job) write NEW only; the
 * delete path removes BOTH. When the copy is verified and reads are cut over,
 * the OLD fallback is removed (a later step, its own GO).
 *
 * `image.png` is intentionally absent: the PNG is no longer produced and is not
 * copied (operator 22:12: "skip the soundscape PNG backfill").
 */
const config = require('../config');

// Overridable per environment the same way as every other bucket
// (config('soundscapes') -> SOUNDSCAPES_BUCKETNAME env).
function newBucket () {
    let c = {};
    try { c = config('soundscapes') || {}; } catch (e) { c = {}; }
    return process.env.SOUNDSCAPES_BUCKETNAME || c.bucketName || 'arbimon-soundscapes';
}
function oldBucket () { return config('aws').bucketName; }

const FILES = ['index.scidx', 'peaknumbers.json', 'h.json', 'aci.json'];

function newKey (soundscapeId, file) {
    const id = soundscapeId | 0;
    if (id <= 0) throw new Error('bad soundscape id ' + soundscapeId);
    return id + '/' + file;
}
function oldKey (projectId, soundscapeId, file) {
    return 'project_' + (projectId | 0) + '/soundscapes/' + (soundscapeId | 0) + '/' + file;
}

/** Ordered read candidates: [{Bucket, Key}, ...] -- NEW first, then OLD. */
function locations (soundscape, file) {
    const sid = soundscape.id !== undefined ? soundscape.id : soundscape.soundscape_id;
    const pid = soundscape.project !== undefined ? soundscape.project : soundscape.project_id;
    return [
        { Bucket: newBucket(), Key: newKey(sid, file) },
        { Bucket: oldBucket(), Key: oldKey(pid, sid, file) },
    ];
}

function isMissing (err) {
    if (!err) return false;
    const c = err.code || err.name;
    return err.statusCode === 404 || c === 'NoSuchKey' || c === 'NotFound' || c === 'NoSuchBucket';
}

/**
 * getObject with NEW-then-OLD fallback. callback(err, data, where) where
 * `where` is 'new' | 'old'. Any error other than "missing" on NEW is returned
 * as-is (do not mask a real outage as a miss).
 */
function getObject (s3, soundscape, file, callback) {
    const locs = locations(soundscape, file);
    s3.getObject(locs[0], function (err, data) {
        if (!err) return callback(null, data, 'new');
        if (!isMissing(err)) return callback(err);
        s3.getObject(locs[1], function (err2, data2) {
            if (err2) return callback(err2);
            callback(null, data2, 'old');
        });
    });
}

/**
 * Delete every soundscape object from BOTH layouts. Missing objects are not
 * errors (S3 deleteObjects is idempotent). `legacyImageKey` (the row's `uri`,
 * i.e. the old image.png key) is included for the old bucket so surviving
 * PNGs go too.
 */
function deleteAll (s3, soundscape, legacyImageKey, callback) {
    const sid = soundscape.id !== undefined ? soundscape.id : soundscape.soundscape_id;
    const pid = soundscape.project !== undefined ? soundscape.project : soundscape.project_id;
    const oldObjs = FILES.map(f => ({ Key: oldKey(pid, sid, f) }));
    if (legacyImageKey) oldObjs.push({ Key: legacyImageKey });
    const newObjs = FILES.map(f => ({ Key: newKey(sid, f) }));
    s3.deleteObjects({ Bucket: newBucket(), Delete: { Objects: newObjs, Quiet: true } }, function (err) {
        if (err && !isMissing(err)) return callback(err);
        s3.deleteObjects({ Bucket: oldBucket(), Delete: { Objects: oldObjs, Quiet: true } }, function (err2) {
            if (err2 && !isMissing(err2)) return callback(err2);
            callback(null);
        });
    });
}

module.exports = { FILES, newBucket, oldBucket, newKey, oldKey, locations, getObject, deleteAll, isMissing };