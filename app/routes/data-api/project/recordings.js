var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
var csv_stringify = require("csv-stringify");
var path   = require('path');
var model = require('../../../model');
const stream = require('stream');
const moment = require('moment');
const dayInMs = 24 * 60 * 60 * 1000;
var config = require('../../../config');
const rfcxConfig = config('rfcx');
let s3, s3RFCx;
let cachedData = {
    counts: { },
    species: { }
};

function defineS3Clients() {
    if (!s3) {
        s3 = new AWS.S3(getS3ClientConfig('aws'))
    }
    if (!s3RFCx) {
        s3RFCx = new AWS.S3(getS3ClientConfig('aws-rfcx'))
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

router.get('/species-count', function(req, res, next) {
    res.type('json');
    var params = req.query;
    params.project_id = req.query.project_id? req.query.project_id : req.project.project_id;
    if (req.query.cache && cachedData.species[params.project_id] && (Date.now() - cachedData.species[params.project_id].time < dayInMs)) {
        return res.json({count: cachedData.species[params.project_id].count});
    }
    else {
        model.recordings.countProjectSpecies(params).then((rows) => {
            var species = []
            const result = Object.values(JSON.parse(JSON.stringify(rows)))
            result.map(s => {
                if(!species.includes(s.species)) {
                    species.push(s.species)
                }
            })
            cachedData.species[params.project_id] = {
                count: species.length,
                time: Date.now()
            };
            res.json({count: species.length});
        }).catch(next);
    }
});

router.get('/occupancy-models-export/:species?', function(req, res, next) {
    if(req.query.out=="text"){
        res.type('text/plain');
    } else {
        res.type('text/csv');
    }
    processFiltersData(req, res, next);
});

router.get('/recordings-export.csv', function(req, res, next) {
    if(req.query.out=="text"){
        res.type('text/plain');
    } else {
        res.type('text/csv');
    }
    processFiltersData(req, res, next);
});

router.get('/grouped-detections-export.csv', function(req, res, next) {
    if(req.query.out=="text"){
        res.type('text/plain');
    } else {
        res.type('text/csv');
    }
    processFiltersData(req, res, next);
});

processFiltersData = async function(req, res, next) {
    try{
        var filters = req.query.filters ? JSON.parse(req.query.filters) : {}
        var projectionFilter = req.query.show ? JSON.parse(req.query.show) : {};
    } catch(e){
        return next(e);
    }

    filters.project_id = req.project.project_id | 0;

    console.log(JSON.stringify(filters));

    var projection = req.query.show;
    // Combine Occupancy models report.
    if (projectionFilter && projectionFilter.species) {
        return model.recordings.exportOccupancyModels(projectionFilter, filters).then(async function(results) {
            let sitesData = await model.recordings.getCountSitesRecPerDates(filters.project_id);
            let allSites = sitesData.map(item => { return item.site }).filter((v, i, s) => s.indexOf(v) === i);
            // Get the first/last recording/date per project, not include invalid dates.
            let dates = sitesData
                .filter(s => s.year && s.month && s.day && s.year > '1970')
                .map(s => new Date(`${s.year}/${s.month}/${s.day}`).valueOf())
            let maxDate = new Date(Math.max(...dates));
            let minDate = new Date(Math.min(...dates));
            let fields = [];
            while (minDate <= maxDate) {
                fields.push(moment(minDate).format('YYYY/MM/DD'));
                minDate = new Date(minDate.setDate(minDate.getDate() + 1));
            };
            let streamObject = {};
            for (let row of results) {
                // Combine repeating sites with existing data in the report.
                if (streamObject[row.site]) {
                    let index = fields.findIndex(date => date === row.date);
                    streamObject[row.site][index+1] = row.count === 0 ? 0 : 1;
                    streamObject[row.site][fields.length+index+1] = (new Date(row.date).getTime()/86400000 + 2440587.5).toFixed();
                }
                else {
                    let tempRow = {};
                    let tempJdays = {};
                    // Fill each cell in the report.
                    fields.forEach((item) => {
                        tempRow.site = row.site;
                        let site = sitesData.find(site => {
                            if (site.site === row.site) {
                                return item === moment(new Date(`${site.year}/${site.month}/${site.day}`)).format('YYYY/MM/DD');
                            }
                        });
                        // Occupancy parameter:
                        // 1 (present); 0 (absent);
                        // NA ( device was not active in that day, in other words, there are no recordings for this day);
                        // NI ( no information from the user if species is present or absent).
                        tempRow[item] = item === row.date? (row.count === 0 ? 0 : 1) : (site ? 'NI' : 'NA');
                        // Detection parameter:
                        // The julian day when there are recordings for that day;
                        // NA if the recorder was not active in that day (i.e there is no recordings associated with that day).
                        tempJdays[item] = item === row.date? (new Date(row.date).getTime()/86400000 + 2440587.5).toFixed() : (site ? (new Date(item).getTime()/86400000 + 2440587.5).toFixed() : 'NA');
                    });
                    streamObject[row.site] = [...Object.values(tempRow), ...Object.values(tempJdays)];
                }
            };
            // Get sites without validations.
            let notValidated = allSites.filter(site => !results.find(res => site === res.site ));
            if (notValidated && notValidated.length) {
                for (let row of notValidated) {
                    let notValidatedRow = {};
                    let notValidatedDays = {};
                    fields.forEach((item) => {
                        notValidatedRow.site = row;
                        let site = sitesData.find(site => {
                            if (site.site === row) {
                                return item === moment(new Date(`${site.year}/${site.month}/${site.day}`)).format('YYYY/MM/DD');
                            }
                        });
                        notValidatedRow[item] = site ? 'NI' : 'NA';
                        notValidatedDays[item] = site ? (moment(new Date(`${site.year}/${site.month}/${site.day}`)).valueOf()/86400000 + 2440587.5).toFixed() : 'NA';
                    });
                    streamObject[row] = [...Object.values(notValidatedRow), ...Object.values(notValidatedDays)];
                }
            }
            fields = [...fields, ...fields];
            fields.unshift('site');
            let datastream = new stream.Readable({objectMode: true});
                for (let row of Object.values(streamObject)) {
                    datastream.push(row);
                }
                datastream.push(null);

                datastream
                    .pipe(csv_stringify({header:true, columns:fields}))
                    .pipe(res);
        }).catch(next);
    }
    // Combine grouped detections report.
    if (projectionFilter && projectionFilter.grouped && projectionFilter.validation && !projectionFilter.species) {
        return model.recordings.exportRecordingData(projectionFilter, filters).then(async function(results) {
            let gKey = projectionFilter.grouped;
            let fields = [];
            results.forEach(result => {
                fields.push(...Object.keys(result).filter(f => f !== gKey && !fields.includes(f)))
            });
            let data = {};
            results.forEach((r, i) => {
                const s = r[gKey]
                // Create empty row for each grouped key.
                if (!data[s]) {
                    data[s] = {};
                    data[s][gKey] = s;
                };
                fields.forEach((f) => {
                    // Fill for each cell 0 as default value.
                    if (data[s][f] === undefined) { data[s][f] = 0 };
                    data[s][f] += r[f] === '---' || r[f] === undefined ? 0 : +r[f];
                })
            });
            fields.unshift(gKey);
            let datastream = new stream.Readable({objectMode: true});
                let streamArray = Object.values(data);
                if (gKey === 'hour') {
                    streamArray.sort(function(a, b) {
                        return a.hour - b.hour;
                    });
                };
                for (let row of streamArray) {
                    datastream.push(row);
                };
                datastream.push(null);

                datastream
                    .pipe(csv_stringify({header:true, columns:fields}))
                    .pipe(res);
        }).catch(next);
    }

    model.recordings.exportRecordingData(projection, filters).then(function(results) {
        var datastream = results[0];
        var fields = results[1].map(function(f){return f.name;});
        const metaIndex = fields.indexOf('meta');
        if (metaIndex !== -1) {
            fields.splice(metaIndex, 1);
        }
        let colOrder={filename:-6,site:-5,time:-4, day:-4, month:-3, year:-2, hour:-1, date: 0};
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
            .pipe(new stream.Transform({
                objectMode: true,
                transform: function (row, encoding, callback) {
                    if (row.meta && row.filename) {
                        try {
                            const parsedMeta = JSON.parse(row.meta);
                            row.filename = parsedMeta && parsedMeta.filename? parsedMeta.filename :  row.filename;
                        } catch (e) {}
                        delete row.meta;
                    }
                    if (row.url) {
                        row.url = `${rfcxConfig.apiBaseUrl}/api/project/${req.project.url}/recordings/download/${row.url}`;
                    }
                    callback();
                }
            }))
        datastream
            .pipe(csv_stringify({header:true, columns:fields}))
            .pipe(res);
    }).catch(next);
}

router.get('/download/:recordingId', function(req, res, next) {
    res.type('json');
    downloadRecordingById(req, res, next);
});

function getRecordingFromS3(bucket, key, res) {
    if (!s3) {
        s3 = new AWS.S3();
    }
    return s3
        .getObject({ Bucket: bucket, Key: key })
        .createReadStream()
        .pipe(res)
}

async function downloadRecordingById(req, res, next) {
    let recordingId = req.params.recordingId;
    let recording = await model.recordings.findByIdAsync(recordingId);
    const namePartials = recording[0].uri.split('/');
    recording[0].name = namePartials[namePartials.length - 1];
    let legacy = recording[0].uri.startsWith('project_');
    res.set({
        'Content-Disposition' : 'attachment; filename="'+recording[0].name
    });
    await getRecordingFromS3(config(legacy? 'aws' : 'aws-rfcx').bucketName, recording[0].uri, res);
}


router.get('/count', function(req, res, next) {
    res.type('json');
    let p = req.project.project_id;
    if (req.query.cache && cachedData.counts[p] && (Date.now() - cachedData.counts[p].time < dayInMs)) {
        return res.json(cachedData.counts[p].count);
    }
    else {
        model.projects.totalRecordings(p).then((count) => {
            cachedData.counts[p] = {
                count: count[0],
                time: Date.now()
            };
            res.json(count[0]);
        }).catch(next);
    }
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
