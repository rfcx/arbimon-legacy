var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
const { createS3Client } = require('../../../utils/storage');
var csv_stringify = require("csv-stringify");
var path   = require('path');
var model = require('../../../model');
const stream = require('stream');
const moment = require('moment');
var config = require('../../../config');
const mime = require('mime');
const { getCachedMetrics } = require('../../../utils/cached-metrics');
const fs = require('fs')

let s3, s3RFCx;

// endpoint-aware: route through s3-proxy/s3-reader/s3-writer chain
// (AWS_S3_ENDPOINT) instead of AWS S3 directly. See app/utils/storage.js.
function defineS3Clients() {
    if (!s3) {
        s3 = createS3Client('aws')
    }
    if (!s3RFCx) {
        s3RFCx = createS3Client('aws_rfcx')
    }
}

defineS3Clients();

router.get('/exists/site/:siteid/file/:filename', function(req, res, next) {
    res.type('json');
    var site_id = req.params.siteid;
    var ext = path.extname(req.params.filename);
    var filename = path.basename(req.params.filename, ext);
    model.recordings.exists(
        {
            site_id: site_id,
            filename: filename
        },
        function(err, result) {
            if(err)
                next(err);

            res.json({ exists: result });
        }
    );
});

router.get('/search', function(req, res, next) {
    res.type('json');
    var params = req.query;

    params.project_id = req.project.project_id;

    model.recordings.findProjectRecordings(params, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/query', function(req, res, next) {
    res.type('json');
    let params = req.query;

    params.project_id = req.project.project_id;
    console.log('Recording query params', params)
    model.recordings.query(params, function(err, recording) {
        if (err) {
            console.error('Error get the recording', err)
            return res.json(0);
        }
        res.json(recording);
    });
});

router.get('/search-count', function(req, res, next) {
    res.type('json');
    var params = req.query;

    params.project_id = req.query.project_id? req.query.project_id : req.project.project_id;

    model.recordings.countProjectRecordings(params).then(function(rows) {
        res.json(rows);
    }).catch(next);
});

router.get('/count', function(req, res, next) {
    res.type('json');
    let p = req.project.project_id;
    const key = { 'project-recording-count': `project-${p}-rec` }
    getCachedMetrics(req, res, key, p, next);
});

router.post('/pm-export', function(req, res, next) {
    writeExportParams(req, res, next)
});

router.post('/project-template-export', function(req, res, next) {
    writeExportParams(req, res, next)
});

router.post('/project-soundscape-export', function(req, res, next) {
    writeExportParams(req, res, next)
});

router.post('/project-rfm-classify-export', function(req, res, next) {
    writeExportParams(req, res, next)
});

async function writeExportParams(req, res, next) {
    let filters, projection
    try {
        filters = req.body.filters ? req.body.filters : {}
        projection = req.body.show ? req.body.show : {};
    } catch(e){
        return next(e);
    }
    filters.project_id = req.project.project_id
    projection.projectUrl = req.project.url
    const userEmail = filters.userEmail
    delete filters.userEmail
    const userId = req.session.user.id;

    model.recordings.writeExportParams(projection, filters, userId, userEmail).then(function(data) {
        res.json({ success: true })
    }).catch(next);
}

router.post('/occupancy-models-export', function(req, res, next) {
    let filters, projection
    try {
        filters = req.body.filters ? req.body.filters : {}
        projection = req.body.show ? req.body.show : {};
    } catch(e){
        return next(e);
    }
    filters.project_id = req.project.project_id
    filters.species_name = projection.species_name

    const userEmail = filters.userEmail
    delete filters.userEmail
    delete projection.species_name
    const userId = req.session.user.id;
    model.recordings.writeExportParams(projection, filters, userId, userEmail).then(function(data) {
        res.json({ success: true })
    }).catch(next);
});

router.post('/recordings-export', function(req, res, next) {
    let filters, projection
    try {
        filters = req.body.filters ? req.body.filters : {}
        projection = req.body.show ? req.body.show : {};
    } catch(e){
        return next(e);
    }

    filters.project_id = req.project.project_id;
    const userEmail = filters.userEmail
    delete filters.userEmail
    const userId = req.session.user.id;
    projection.projectUrl = req.project.url
    model.recordings.writeExportParams(projection, filters, userId, userEmail).then(function(data) {
        res.json({ success: true })
    }).catch(next);
});

router.post('/grouped-detections-export', function(req, res, next) {
    let filters, projection
    try {
        filters = req.body.filters ? req.body.filters : {}
        projection = req.body.show ? req.body.show : {};
    } catch(e){
        return next(e);
    }

    filters.project_id = req.project.project_id
    const userEmail = filters.userEmail
    delete filters.userEmail
    const userId = req.session.user.id;
    model.recordings.writeExportParams(projection, filters, userId, userEmail).then(function(data) {
        res.json({ success: true })
    }).catch(next);
});

router.get('/download/:recordingId', function(req, res, next) {
    downloadRecordingById(req, res, false, next);
});

router.get('/inline/:recordingId', function(req, res, next) {
    downloadRecordingById(req, res, true, next);
});

/**
 * Stream a recording's audio from S3 to `res` with FULL error handling.
 *
 * WHY THIS EXISTS (2026-08-29, the XMLParserError pod-kill class).
 * ----------------------------------------------------------------
 * This used to be `getObject(...).createReadStream().pipe(res)` with NO
 * 'error' listener on the request or the stream. That is a PROCESS-KILL
 * primitive, and it killed both prod replicas repeatedly on 2026-08-28/29:
 *
 *   A recording row whose object is absent from every storage layer (see
 *   OPEN-ITEMS #86: ~1.85M such rows) makes our s3 chain answer
 *   `404 text/plain "not found in any layer"`. aws-sdk v2 assumes an S3 error
 *   body is XML, so `Request.extractError` (s3.js:697) hands that text to
 *   xml2js/sax, which strict-fails on the leading 'n' and THROWS
 *   SYNCHRONOUSLY inside an SDK event listener. With no 'error' listener the
 *   throw becomes an uncaughtException, and bin/www's crash net deliberately
 *   fail-stops anything that is not ERR_HTTP_HEADERS_SENT => process.exit(1).
 *   Both replicas serve the same user, so BOTH died within seconds.
 *
 * Note the parse error was never the disease: returning valid XML instead
 * merely renames the fatal error to NoSuchKey (measured). The load-bearing
 * fix is attaching the 'error' listeners -- ANY S3 failure (missing object,
 * permissions, upstream outage) must not be able to kill the process.
 *
 * Mirrors the existing precedent in app/model/recordings.js
 * (`downloadAssetFromMediaAPI`, the #1796 media-api fix): listen on BOTH the
 * request and the stream, and guarantee the completion path runs exactly once.
 *
 * Calls back once with (err). Headers are NOT set here -- see
 * downloadRecordingById, which now waits for first-byte before committing the
 * response, so a miss can still be answered with a clean 404.
 */
function getRecordingFromS3(bucket, legacy, key, res, onHeaders, callback) {
    if(!s3 || !s3RFCx){
        defineS3Clients()
    }
    let s3Client = legacy? s3 : s3RFCx;

    let done = false;
    const finish = function (err) {
        if (done) return;
        done = true;
        callback(err || null);
    };

    const req = s3Client.getObject({ Bucket: bucket, Key: key });

    // The SDK throws out of THIS listener chain on a non-XML error body; the
    // listener is what converts a pod kill into an ordinary error.
    req.on('error', finish);

    const stream = req.createReadStream();
    stream.on('error', finish);

    // Only commit the response once bytes are actually flowing. Before the
    // first byte res.headersSent is false, so an error can still produce a
    // real 404; after it, the response is committed and the only honest
    // action is to destroy the socket rather than truncate silently.
    let started = false;
    stream.once('data', function () {
        started = true;
        try { onHeaders(); } catch (e) { /* headers already sent */ }
    });
    stream.on('end', function () { finish(null); });

    stream.on('data', function (chunk) {
        if (!res.write(chunk)) { stream.pause(); res.once('drain', function () { stream.resume(); }); }
    });

    // If the client goes away mid-download, stop pulling bytes from storage.
    res.on('close', function () {
        if (!done) { try { req.abort(); } catch (e) {} stream.destroy(); finish(null); }
    });

    return { isStarted: function () { return started; } };
}

async function downloadRecordingById(req, res, inline, next) {
    const recordingFromParams = req.params.recordingId;
    const match = /^(\d+)?(\.(wav|flac|opus|mp3))/i.exec(recordingFromParams);
    const recordingId = match ? match[1] : recordingFromParams;
    const [recording] = await model.recordings.findByIdAsync(recordingId)
    const recordingUri = recording.uri
    const recordingName = recordingUri.split('/').pop()
    const legacy = recordingUri.startsWith('project_')
    const mimetype = mime.getType(recordingName)
    const bucketName = config(legacy ? 'aws' : 'aws_rfcx').bucketName

    // Headers are applied on FIRST BYTE, not up front: setting them early was
    // harmless while the process died anyway, but now that we survive a miss we
    // want the option of answering 404 instead of a 200 with an empty body.
    const applyHeaders = function () {
        res.set({ 'Content-Disposition' : `${ inline ? 'inline' : 'attachment' }; filename=${ recordingName }`})
        res.setHeader('Content-type', `${ inline ? 'audio/wav' : mimetype }`)
    };

    await new Promise(function (resolve) {
        const handle = getRecordingFromS3(bucketName, legacy, recordingUri, res, applyHeaders, function (err) {
            if (!err) {
                if (!res.writableEnded) { res.end(); }
                return resolve();
            }
            if (res.headersSent || handle.isStarted()) {
                // Committed mid-stream: cannot signal cleanly. Destroy so the
                // client sees a broken transfer instead of a truncated file
                // that looks complete.
                try { res.destroy(); } catch (e) {}
                return resolve();
            }
            const missing = err && (err.statusCode === 404 || err.code === 'NoSuchKey' ||
                                    err.code === 'NotFound' || err.name === 'XMLParserError');
            if (missing) {
                res.status(404).json({ error: 'recording audio not found' });
                return resolve();
            }
            next(err);
            return resolve();
        });
    });
}

router.get('/time-bounds', function(req, res, next) {
    res.type('json');
    model.projects.recordingsMinMaxDates(req.project.project_id, function(err, data) {
        if(err) return next(err);
        res.json(data[0]);
    });
});

// get records for the project
router.get('/:recUrl?', function(req, res, next) {
    res.type('json');
    // get nearby recordings
    if (req.query && req.query.recording_id) {
        model.recordings.getPrevAndNextRecordingsAsync(req.query.recording_id)
            .then((recordings) => {
                if(!recordings.length){
                    return res.status(404).json({ error: 'recording not found' });
                }
                res.json(recordings);
                return null;
            })
            .catch((err) => {
                next(err)
            })
    }
    else {
        var recordingUrl = req.params.recUrl;

        model.recordings.findByUrlMatch(
            recordingUrl,
            req.project.project_id,
            {
                order: true,
                compute: req.query && req.query.show,
                recording_id: req.query && req.query.recording_id,
                ...req.query && req.query.limit && {limit: req.query.limit},
                ...req.query && req.query.offset && {offset: req.query.offset}
            },
            function(err, rows) {
                if (err) return next(err);
                res.json(rows);
                return null;
            }
        );
    }
});

router.get('/count/:recUrl?', function(req, res, next) {
    res.type('json');
    var recordingUrl = req.params.recUrl;

    model.recordings.findByUrlMatch(recordingUrl, req.project.project_id, { count_only:true }, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});

// get info about count of recordings in a project
router.get('/available/:recUrl?', function(req, res, next) {
    res.type('json');
    var recordingUrl = req.params.recUrl;
    model.recordings.findByUrlMatch(
        recordingUrl,
        req.project.project_id,
        {
            count_only:true,
            group_by:'next',
            collapse_single_leaves:true
        },
        function(err, count) {
            if(err) return next(err);

            res.json(count);
            return null;
        }
    );
});

// Visualizer page | get info about one selected recording
router.param('oneRecUrl', function(req, res, next, recording_url){
    model.recordings.findByUrlMatch(recording_url, req.project.project_id, {limit:1}, function(err, recordings) {
        if(err){
            return next(err);
        }
        if(!recordings.length){
            return res.status(404).json({ error: "recording not found"});
        }
        let recExt;
        if (recordings[0].file) {
            recExt = path.extname(recordings[0].file);
            recordings[0].ext = recExt;
        }
        req.recording = recordings[0];
        return next();
    });
});

router.get('/tiles/:recordingId/:i/:j/:randomString', function(req, res, next) {
    let i = req.params.i | 0;
    let j = req.params.j | 0;
    let recordingId = req.params.recordingId;
    let timeout;

    res.on('finish', () => {
        clearTimeout(timeout)
    });
    res.on('close', () => {
        clearTimeout(timeout)
    });

    model.recordings.findByRecordingId(recordingId, function(err, recording) {
        if (err) {
            return next(err);
        }
        if (recording === null){
            return res.status(404).json({ error: "recording not found"});
        }

        model.recordings.fetchInfo(recording, function(err, rec){
            if(err) return next(err);
            model.recordings.fetchOneSpectrogramTile(rec, i, j, function(err, file){
                if(err || !file){ next(err); return; }
                res.sendFile(file.path, function () {
                    if (fs.existsSync(file.path)) {
                        console.log('Tile file unlink', file.path)
                        fs.unlink(file.path, function (err) {
                            if (err) console.error('Error deleting the tile file.', err);
                            console.info('Tile file deleted.');
                        })
                    }
                })
            });
        });


    });
});

router.get('/:get/:oneRecUrl?', function(req, res, next) {
    let get = req.params.get;
    let recording = req.recording;
    let query = req.query
    if (get === 'audio') {
        req.headers['content-type'] = query.format ? 'audio/wav' : 'audio/mpeg';
    }
    if (query && query.spectroColor) {
        recording.spectroColor = query.spectroColor
    }
    let returnType = {
        recording : function(err, recordings) {
            if(err) return next(err);

            res.json(recordings instanceof Array ? recordings[0] : recordings);
        },
        file : function(err, file) {
            if (err || !file) return next(err);

            // For audio: set Content-Type + a Content-Disposition filename
            // whose extension matches the actually-served format BEFORE
            // calling res.download (which writes headers immediately).
            //
            // Background: fetchAudioFile transcodes to MP3 by default and to
            // WAV when query.format === '.wav' (see app/model/recordings.js
            // fetchAudioFile + getAssetFileFromMediaAPI). The previous code
            // called res.download(file.path, recording.file, ...) which:
            //   1. set Content-Type from recording.file (e.g. "...WAV" -> audio/wav)
            //      even when we actually transcoded to MP3,
            //   2. left Content-Disposition advertising the original AudioMoth
            //      filename (e.g. 20240320_092904.WAV) even though the body
            //      was an MP3,
            //   3. then tried to override Content-Type and status to 206 in a
            //      follow-up block, which set the status to 206 even when no
            //      Range request was made (invalid HTTP without Content-Range).
            // The result was four pieces of metadata claiming three different
            // formats with a fourth thing (MP3 ID3v2.4) in the body. Strict
            // clients that select a decoder from Content-Type or the URL
            // extension would refuse to decode.
            if (get === 'audio') {
                const isWav = query.format === '.wav' || query.format === 'wav';
                const ext = isWav ? '.wav' : '.mp3';
                const contentType = isWav ? 'audio/wav' : 'audio/mpeg';
                // Normalize the served filename: keep the original basename
                // (typically the recorder's filename like 20240320_092904)
                // but use the extension that matches what we actually produced.
                const originalExt = path.extname(recording.file);
                const baseName = path.basename(recording.file, originalExt);
                const servedName = `${baseName}${ext}`;
                res.setHeader('Content-Type', contentType);
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${servedName}"`
                );
                res.sendFile(file.path, function(err) {
                    fs.unlink(file.path, () => {});
                    if (err && !res.headersSent) return next(err);
                });
                return;
            }

            // Spectrogram images + thumbnails are CONTENT-ADDRESSED (every
            // render param is encoded in the request URL/filename), so they
            // are immutable and safe to cache aggressively. Serve them
            // INLINE (not as an attachment download) with a long-lived
            // Cache-Control + an ETag (res.sendFile adds Last-Modified/ETag)
            // so browsers and the CDN reuse them instead of re-fetching /
            // re-rendering on every page view. (Previously res.download set
            // Content-Disposition: attachment with no cache headers, which
            // defeats inline <img> caching.)
            if (get === 'image' || get === 'thumbnail') {
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Content-Disposition', `inline; filename="${recording.file}"`);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.sendFile(file.path, function(err) {
                    fs.unlink(file.path, () => {});
                    if (err && !res.headersSent) return next(err);
                });
                return;
            }

            res.download(file.path, recording.file, function() {
                fs.unlink(file.path, () => {})
            });
        },
    };

    switch(get){
        case 'info'  :
            let url_comps = /(.*)\/([^/]+)\/([^/]+)/.exec(req.originalUrl);
            recording.audioUrl = `${url_comps[1]}/audio/${recording.id}${query.format ? '.wav' : '.flac'}`;
            recording.imageUrl = url_comps[1] + "/image/" + recording.id;
            model.recordings.fetchValidations(recording, async function(err, validations){
                if(err) return next(err);
                // Add validated aed species boxes
                const aedValidations = await model.recordings.fetchAedValidations(recording.id)
                if (aedValidations) {
                    recording.aedValidations = aedValidations.map(item => {
                        return { ...item, name: `${item.scientific_name} ${item.songtype_name}`, isPopupOpened: false, presentReview: 1 }
                    });
                }
                recording.validations = validations;
                model.recordings.fetchInfo(recording, function(err, rec){
                    if(err) return next(err);

                    model.recordings.fetchSpectrogramTiles(rec, function(err, rec){
                        if(err) return next(err);

                        res.json(rec);
                    });
                });
            });
        break;
        case 'audio'     : model.recordings.fetchAudioFile(recording, query, returnType.file); break;
        case 'image'     : model.recordings.fetchSpectrogramFile(recording, returnType.file); break;
        case 'thumbnail' : model.recordings.fetchThumbnailFile(recording, returnType.file); break;
        case 'find'      : returnType.recording(null, [recording]); break;
        case 'tiles'     : model.recordings.fetchSpectrogramTiles(recording, returnType.recording); break;
        case 'next'      : model.recordings.fetchNext(recording, returnType.recording); break;
        case 'previous'  : model.recordings.fetchPrevious(recording, returnType.recording); break;
        default:  next(); return;
    }
});

router.post('/validate/:oneRecUrl?', function(req, res, next) {
    res.type('json');

    const projectId = req.project.project_id
    if(!req.haveAccess(projectId, "validate species")) {
        return res.json({ error: "You do not have permission to validate species" });
    }

    model.recordings.validate(req.recording, req.session.user.id, projectId, req.body, function(err, validations) {
        if(err) return next(err);
        return res.json(validations);
    });
});

router.post('/delete', function(req, res, next) {
    res.type('json');
    const recs = req.body.recs
    let playlists
    if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to manage project recordings" });
    }
    if(!recs) {
        return res.json({ error: 'missing arguments' });
    }
    const recIds = recs.map(function(rec) {
        return rec.id
    });
    const idToken = req.headers.authorization?.split(' ')[1];
    return model.playlists.findRecordingsPlaylists(recIds).then(function(result) {
        playlists = result
        // PHASE B (2026-09-09): this archives rather than destroys; the
        // acting user is recorded in `archived_by`. The playlist refresh below
        // still matters -- archiving REMOVES playlist membership (ruling C2),
        // so the cached totals must be recomputed exactly as before.
        model.recordings.delete(recs, req.project.project_id, req.session.idToken === undefined ? idToken : req.session.idToken, async function(err, result) {
            if(err) return next(err);

            res.json(result);
            for (let playlist of playlists) {
                await model.playlists.refreshTotalRecs(playlist.playlist_id)
            }
        }, req.session.user && req.session.user.id);
    })
});


router.post('/delete-matching', function(req, res, next) {
    res.type('json');
    var params = req.body;

    if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to manage project recordings" });
    }


    params.project_id = req.project.project_id;
    const idToken = req.headers.authorization?.split(' ')[1];
    model.recordings.deleteMatching(params, req.project.project_id, req.session.idToken === undefined ? idToken : req.session.idToken, req.session.user && req.session.user.id).then(function(result) {
        res.json(result);
    }).catch(next);
});

module.exports = router;
