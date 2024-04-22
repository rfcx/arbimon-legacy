var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
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

function defineS3Clients() {
    if (!s3) {
        s3 = new AWS.S3(getS3ClientConfig('aws'))
    }
    if (!s3RFCx) {
        s3RFCx = new AWS.S3(getS3ClientConfig('aws_rfcx'))
    }
}

function getS3ClientConfig(type) {
    return {
        accessKeyId: config(type).accessKeyId,
        secretAccessKey: config(type).secretAccessKey,
        region: config(type).region
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
        return res.json({ success: true })
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

function getRecordingFromS3(bucket, legacy, key, res) {
    if(!s3 || !s3RFCx){
        defineS3Clients()
    }
    let s3Client = legacy? s3 : s3RFCx;
    return s3Client
        .getObject({ Bucket: bucket, Key: key })
        .createReadStream()
        .pipe(res)
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
    res.set({ 'Content-Disposition' : `${ inline ? 'inline' : 'attachment' }; filename=${ recordingName }`})
    res.setHeader('Content-type', `${ inline ? 'audio/wav' : mimetype }`)
    await getRecordingFromS3(bucketName, legacy, recordingUri, res)
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

router.get('/tiles/:recordingId/:i/:j', function(req, res, next) {
    var i = req.params.i | 0;
    var j = req.params.j | 0;
    var recordingId = req.params.recordingId;

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
    var get       = req.params.get;
    var recording = req.recording;

    var returnType = {
        recording : function(err, recordings){
            if(err) return next(err);

            res.json(recordings instanceof Array ? recordings[0] : recordings);
        },
        file : function(err, file){
            if(err || !file) return next(err);
            res.download(file.path, recording.file, function() { fs.unlink(file.path, () => {}) })
        },
    };

    switch(get){
        case 'info'  :
            var url_comps = /(.*)\/([^/]+)\/([^/]+)/.exec(req.originalUrl);
            let recExt;
            if (recording.file) {
                recExt = path.extname(recording.file);
            }
            recording.audioUrl = url_comps[1] + "/audio/" + recording.id + (recExt ? recExt : '');
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
        case 'audio'     : model.recordings.fetchAudioFile(recording, req.query, returnType.file); break;
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
    return model.playlists.findRecordingsPlaylists(recIds).then(function(result) {
        playlists = result
        model.recordings.delete(recs, req.project.project_id, req.session.idToken, async function(err, result) {
            if(err) return next(err);

            res.json(result);
            for (let playlist of playlists) {
                await model.playlists.refreshTotalRecs(playlist.playlist_id)
            }
        });
    })
});


router.post('/delete-matching', function(req, res, next) {
    res.type('json');
    var params = req.body;

    if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to manage project recordings" });
    }


    params.project_id = req.project.project_id;

    model.recordings.deleteMatching(params, req.project.project_id, req.session.idToken).then(function(result) {
        res.json(result);
    }).catch(next);
});

module.exports = router;
