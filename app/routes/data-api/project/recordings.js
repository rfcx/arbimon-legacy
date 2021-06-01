var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
var csv_stringify = require("csv-stringify");
var path   = require('path');
var model = require('../../../model');


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

router.get('/recordings-export.csv', function(req, res, next) {
    if(req.query.out=="text"){
        res.type('text/plain');
    } else {
        res.type('text/csv');
    }

    try{
        var filters = req.query.filters ? JSON.parse(req.query.filters) : {}
    } catch(e){
        return next(e);
    }

    filters.project_id = req.project.project_id | 0;

    console.log(JSON.stringify(filters));

    var projection = req.query.show;

    model.recordings.exportRecordingData(projection, filters).then(function(results) {
        var datastream = results[0];
        var fields = results[1].map(function(f){return f.name;});
        var colOrder={filename:-3,site:-2,time:-1};
        fields.sort(function(a, b){
            var ca = colOrder[a] || 0, cb = colOrder[b] || 0;
            return ca < cb ? -1 : (
                   ca > cb ?  1 : (
                    a <  b ? -1 : (
                    a >  b ?  1 :
                    0
            )));
        });

        datastream
            .pipe(csv_stringify({header:true, columns:fields}))
            .pipe(res);
    }).catch(next);
});


router.get('/count', function(req, res, next) {
    res.type('json');
    model.projects.totalRecordings(req.project.project_id, function(err, count) {
        if(err) return next(err);

        res.json(count[0]);
    });
});

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

// get info about a selected recording
router.param('oneRecUrl', function(req, res, next, recording_url){
    model.recordings.findByUrlMatch(recording_url, req.project.project_id, {limit:1}, function(err, recordings) {
        if(err){
            return next(err);
        }
        if(!recordings.length){
            return res.status(404).json({ error: "recording not found"});
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
        model.recordings.fetchOneSpectrogramTile(recording, i, j, function(err, file){
            if(err || !file){ next(err); return; }
            res.sendFile(file.path);
        });
    });
});

router.get('/:get/:oneRecUrl?', function(req, res, next) {
    var get       = req.params.get;
    var recording = req.recording;

    var and_return = {
        recording : function(err, recordings){
            if(err) return next(err);

            res.json(recordings instanceof Array ? recordings[0] : recordings);
        },
        file : function(err, file){
            if(err || !file) return next(err);

            res.sendFile(file.path);
        },
    };

    switch(get){
        case 'info'  :
            var url_comps = /(.*)\/([^/]+)\/([^/]+)/.exec(req.originalUrl);
            recording.audioUrl = url_comps[1] + "/audio/" + recording.id;
            recording.imageUrl = url_comps[1] + "/image/" + recording.id;
            model.recordings.fetchValidations(recording, function(err, validations){
                if(err) return next(err);

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
        case 'audio'     : model.recordings.fetchAudioFile(recording, req.query, and_return.file); break;
        case 'image'     : model.recordings.fetchSpectrogramFile(recording, and_return.file); break;
        case 'thumbnail' : model.recordings.fetchThumbnailFile(recording, and_return.file); break;
        case 'find'      : and_return.recording(null, [recording]); break;
        case 'tiles'     : model.recordings.fetchSpectrogramTiles(recording, and_return.recording); break;
        case 'next'      : model.recordings.fetchNext(recording, and_return.recording); break;
        case 'previous'  : model.recordings.fetchPrevious(recording, and_return.recording); break;
        default:  next(); return;
    }
});

router.post('/validate/:oneRecUrl?', function(req, res, next) {
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "validate species")) {
        return res.json({ error: "you dont have permission to validate species" });
    }

    model.recordings.validate(req.recording, req.session.user.id, req.project.project_id, req.body, function(err, validations) {
        if(err) return next(err);
        return res.json(validations);
    });
});

router.post('/delete', function(req, res, next) {
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to manage project recordings" });
    }

    if(!req.body.recs) {
        return res.json({ error: 'missing arguments' });
    }

    model.recordings.delete(req.body.recs, req.project.project_id, function(err, result) {
        if(err) return next(err);

        res.json(result);
    });
});


router.post('/delete-matching', function(req, res, next) {
    res.type('json');
    var params = req.body;

    if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to manage project recordings" });
    }


    params.project_id = req.project.project_id;

    model.recordings.deleteMatching(params, req.project.project_id).then(function(result) {
        res.json(result);
    }).catch(next);
});

module.exports = router;
