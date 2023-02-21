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

router.get('/species-count', function(req, res, next) {
    res.type('json');
    let p = req.query.project_id? req.query.project_id : req.project.project_id;
    const key = { 'project-species-count': `project-${p}-species` }
    getCachedMetrics(req, res, key, p, next);
});

router.get('/count', function(req, res, next) {
    res.type('json');
    let p = req.project.project_id;
    const key = { 'project-recording-count': `project-${p}-rec` }
    getCachedMetrics(req, res, key, p, next);
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
    res.set({'Content-Disposition' : `attachment; filename=${req.path.substring(1)}`});
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
                        // NI ( no information from the user if species is present or absent). Changed to 0
                        tempRow[item] = item === row.date? (row.count === 0 ? 0 : 1) : (site ? '0' : 'NA');
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
                        notValidatedRow[item] = site ? '0' : 'NA';
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
        let allData
        // Get all sites, data, hours for selected project.
        if (projectionFilter.grouped === 'site') {
            model.projects.getProjectSites(filters.project_id).then(function(rows) {
                allData = rows.map(s=>s.name)
            })
        }
        if (projectionFilter.grouped === 'date') {
            await model.projects.getProjectDates(filters.project_id, "%Y/%m/%d").then(function(rows) {
                allData = rows.map(r=>r.date)
            })
        }
        if (projectionFilter.grouped === 'hour') {
            await model.projects.getProjectDates(filters.project_id, "%H").then(function(rows) {
                allData = rows.map(r=>r.date)
            })
        }
        return model.recordings.groupedDetections(projectionFilter, filters).then(async function(results) {
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
            // Include all sites, data, hours without validations to the report.
            let extendedRows = allData.filter(i => !Object.keys(data).includes(i));
            extendedRows.forEach(s => {
                if (!data[s]) {
                    data[s] = {};
                    data[s][gKey] = s;
                };
                fields.forEach((f) => {
                    if (data[s][f] === undefined) { data[s][f] = 'NA' };
                })
            })
            fields.unshift(gKey);
            let datastream = new stream.Readable({objectMode: true});
                let streamArray = Object.values(data);
                streamArray.sort(function(a, b) {
                    if (gKey === 'date') {
                        return new Date(a[gKey]) - new Date(b[gKey]);
                    }
                    else return a[gKey] - b[gKey];
                });
                for (let row of streamArray) {
                    datastream.push(row);
                };
                datastream.push(null);

                datastream
                    .pipe(csv_stringify({header:true, columns:fields}))
                    .pipe(res);
        }).catch(next);
    }
    // Get a report with all recordings in the project.
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
                        row.url = `${config('hosts').publicUrl}/api/project/${req.project.url}/recordings/download/${row.url}`;
                    }
                    // Fill a specific label for each cell without validations data.
                    fields.forEach(f => {
                        if (row[f] === undefined || row[f] === null) {
                            row[f] = '---'}
                        }
                    )
                    callback();
                }
            }))
        datastream
            .pipe(csv_stringify({header:true, columns:fields}))
            .pipe(res);
    }).catch(next);
}

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
