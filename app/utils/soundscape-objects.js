/* jshint node:true */
'use strict';
/**
 * Where a soundscape's objects live (2026-09-25, operator goifirr 22:12 #3 +
 * 23:32 step 1).
 *
 * Soundscape objects (index.scidx, peaknumbers.json, h.json, aci.json) live in
 * their own bucket `arbimon-soundscapes` (hot -> cold-a -> B2 b2b), flat layout:
 *
 *     arbimon-soundscapes / <soundscape_id>/<file>
 *
 * READS ARE NEW-BUCKET-ONLY (step 3, 2026-09-26, operator goifirr 11:20): the
 * copy is complete and verified (47,223 objects, 0 errors, size+MD5 checked on
 * cold-a AND B2), writers have been NEW-only since arbimon-soundscapes #26, and
 * nothing writes the old layout any more. The old copies REMAIN in `arbimon2`
 * (step 4 cancelled, operator 2026-09-25 23:58), so the DELETE path still removes
 * BOTH layouts (and the legacy image.png key).
 *
 * `image.png` is intentionally absent from FILES: the PNG is no longer produced
 * and was not copied (operator 22:12: "skip the soundscape PNG backfill").
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

/** Read candidate: the NEW layout only (step 3; the fallback is gone). */
function locations (soundscape, file) {
    const sid = soundscape.id !== undefined ? soundscape.id : soundscape.soundscape_id;
    return [
        { Bucket: newBucket(), Key: newKey(sid, file) },
    ];
}

function isMissing (err) {
    if (!err) return false;
    const c = err.code || err.name;
    return err.statusCode === 404 || c === 'NoSuchKey' || c === 'NotFound' || c === 'NoSuchBucket';
}

/**
 * getObject from the NEW bucket (the only read location since step 3).
 * callback(err, data, where) with `where` always 'new' (kept for callers).
 */
function getObject (s3, soundscape, file, callback) {
    const loc = locations(soundscape, file)[0];
    s3.getObject(loc, function (err, data) {
        if (err) return callback(err);
        callback(null, data, 'new');
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