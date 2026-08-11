/* jshint node:true */
"use strict";

const express = require('express');
const async = require('async');
const AWS = require('aws-sdk');
const { createS3Client } = require('../../../utils/storage');
const config = require('../../../config');
const model = require('../../../model');
const pokeDaMonkey = require('../../../utils/monkey');
const { arbimon2PublicUrl, mediaStreamId } = require('../../../utils/asset-url');
const router = express.Router();
const moment = require('moment');
const { httpErrorHandler } = require('@rfcx/http-utils');

let s3, s3RFCx;
defineS3Clients();

// endpoint-aware: route through s3-proxy/s3-reader/s3-writer chain
// (AWS_S3_ENDPOINT) instead of AWS S3 directly. See app/utils/storage.js.
function defineS3Clients () {
    if (!s3) {
        s3 = createS3Client('aws')
    }
    if (!s3RFCx) {
        s3RFCx = createS3Client('aws_rfcx')
    }
}

router.get('/', function(req, res, next) {
    res.type('json');
    model.classifications.list(req.project.project_id, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/:classiId', function(req, res, next) {
    res.type('json');
    model.classifications.errorsCount(req.params.classiId, function(err, rowsRecs) {
        if(err) return next(err);

        rowsRecs =  rowsRecs[0];

        model.classifications.detail(req.params.classiId, function(err, rows) {
            if(err) return next(err);

            var classifiacationDetails = rows[0];

            classifiacationDetails.errCount = rowsRecs.count;

            res.json(classifiacationDetails);
        });
    });
});

router.get('/:classiId/more/:from/:total', function(req, res, next) {
    res.type('json');
    model.classifications.moreDetailsAsync(req.params.classiId, req.params.from, req.params.total)
        .then(async function(rows) {
            for (let classiInfo of rows) {
                classiInfo.stats = JSON.parse(classiInfo.json_stats);
                delete classiInfo.json_stats;
                const [recording] = await model.recordings.findByIdAsync(classiInfo.recording_id)
                const site = await model.sites.findByIdAsync(recording.site_id)
                if (recording.uri.startsWith('project_')) {
                    const thumbnail = classiInfo.uri.replace('.flac', '.thumbnail.png');
                    classiInfo.rec_image_url = arbimon2PublicUrl(thumbnail);
                }
                else {
                    const momentStart = moment.utc(recording.datetime_utc ? recording.datetime_utc : recording.datetime)
                    const momentEnd = momentStart.clone().add(recording.duration, 'seconds')
                    const dateFormat = 'YYYYMMDDTHHmmssSSS'
                    const start = momentStart.format(dateFormat)
                    const end = momentEnd.format(dateFormat)
                    // `mtrue` = MONOCHROME. media-api defaults monochrome to FALSE when
                    // the token is absent (segment-file-parsing.js), so this URL was
                    // silently requesting an 8-bit RGB spectrogram -- inconsistent with
                    // every other ROI/detection surface, and ~2.8x the bytes
                    // (measured 2026-08-10).
                    //
                    // 1200x160 (7.5:1), not the previous 600x512 (1.17:1): this
                    // renders into `.sm-result-thumb`, which is
                    // `height:100px; width:100%` (style.less:480) inside
                    // `.vectorWrapper` -- so the box is CONTAINER-BOUND and very
                    // wide. Measured in a browser across the Bootstrap-3 container
                    // widths: 700x100 (7.0:1) / 920x100 (9.2:1) / 1120x100
                    // (11.2:1). A 1.17:1 render was therefore stretched 6-9.6x
                    // horizontally with only 0.54-0.86 SOURCE px per displayed px
                    // (i.e. upscaled past its own resolution, visibly smeared)
                    // while carrying 5.12x more vertical detail than the 100px-tall
                    // box can show.
                    //
                    // 1200x160 gives x-density 1.30 and y-density 1.60 at the
                    // common 970px container -- crisp in both axes, aspect bend down
                    // from 7.85x to 1.23x -- AND it is SMALLER on the wire:
                    // 94,164 B vs 140,366 B (-33%), because the wasted vertical
                    // pixels cost more than the added horizontal ones.
                    // uri-first stream id (site external_id is wrong/NULL for 11 sites
                    // — OPEN-ITEMS #107; same derivation as buildMediaApiAttr).
                    const streamId = mediaStreamId(recording.uri, site && site[0] && site[0].external_id)
                    classiInfo.rec_image_url = streamId
                        ? `/legacy-api/ingest/recordings/${streamId}_t${start}Z.${end}Z_rfull_g1_fspec_mtrue_d1200.160_wdolph_z120.png`
                        : null
                }
                delete classiInfo.uri;
            }
            res.json(rows);
        }).catch(httpErrorHandler(req, res, 'Failed getting details per recording'))
});

router.get('/:classiId/delete', function(req, res) {
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage models and classification")) {
        return res.json({
            err: "You dont have permission to 'manage models and classification'"
        });
    }
    const job_id = req.params.classiId
    model.classifications.delete(job_id, async function(err, data) {
        res.json(data)
        await model.jobs.hideAsync(job_id)
    });
});

router.post('/new', function(req, res, next) {
    res.type('json');
    var response_already_sent;
    var params, job_id;

    async.waterfall([
        function gather_job_params(next){
            var project_id = req.project.project_id;

            if(!req.haveAccess(project_id, "manage models and classification"))
                return res.json({ error: "you dont have permission to 'manage models and classification'" });

            params = {
                name        : req.body.n,
                user        : req.session.user.id,
                project     : project_id,
                classifier  : req.body.c,
                allRecs     : req.body.a, // unused
                sitesString : req.body.s, // unused
                playlist    : req.body.p.id
            };

            next();
        },
        function check_sc_exists(next){
            model.jobs.classificationNameExists({
                name: params.name,
                classifier: params.classifier,
                user: params.user,
                pid: params.project
            }, next);
        },
        function abort_if_already_exists(row) {
            var next = arguments[arguments.length -1];
            if(row[0].count !== 0){
                res.json({ name:"repeated"});
                response_already_sent = true;
                next(new Error());
                return;
            }

            next();
        },
        function add_job(next){
            model.jobs.newJob(params, 'classification_job', next);
        },
        function get_job_id(_job_id){
            var next = arguments[arguments.length -1];
            job_id = _job_id;
            next();
        },
        function poke_the_monkey(next){
            pokeDaMonkey();
            next();
        },
    ], function(err, data){
        // rfcx-local 2026-08-03: honor the waterfall's error. The #1631 rewrite
        // dropped the err check, so an aborted waterfall (e.g. the duplicate-name
        // path, which has ALREADY responded with {name:"repeated"} and bailed via
        // next(new Error())) fell through to createClassificationJob with
        // job_id === undefined — posting a garbage arbimon-rfm-classify-undefined-*
        // k8s Job and double-sending the response. The second res.json() threw
        // ERR_HTTP_HEADERS_SENT inside a q async tick (q.js:155 rethrow), which is
        // OUTSIDE express's error handling → uncaughtException → the whole pod
        // crashed (2 distinct crash events in 14d: main pod 2026-08-03 00:13Z,
        // shadow canary 2026-07-20 18:40Z).
        if (err) {
            if (!response_already_sent) {
                res.json({ err: 'Could not create classification job' });
            }
            return;
        }
        return model.classifications.createClassificationJob({
            jobId: job_id
        }, function(err, data) {
            if (err) {
                return res.json({ err: 'Could not create classification job' });
            }
            res.json({ ok: `Job created, classification Job: ${job_id}` });
        })
    });
});

router.get('/:classiId/vector/:recId', function(req, res, next) {
    res.type('json');

    if(!req.params.classiId || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }

    model.classifications.getRecVector(req.params.classiId, req.params.recId, function(err, rows) {
        if(err) return next(err);

        if(!rows.length) {
            return res.status(404).json({ error: 'data not found'});
        }

        let vectorUri = rows[0].vect;
        const jobDate = moment.utc(rows[0].date_created).valueOf();
        const bucketUpdateDate = moment.utc('2024-11-22 00:00:00').valueOf();
        const isOldJob = jobDate < bucketUpdateDate
        let s3Client = isOldJob ? s3 : s3RFCx;
        const isProd = process.env.NODE_ENV === 'production';
        const awsConfig = (isProd || isOldJob) ? config('aws') : config('aws_rfcx');
        const vectorBucket = (isProd || isOldJob) ? awsConfig.bucketName : awsConfig.bucketNameStaging;
        s3Client.getObject({
            Key: vectorUri,
            Bucket: vectorBucket
        },
        function(err, data){
            if(err) {
                if(err.code == 'NoSuchKey'){
                    return res.status(404).json({ err:'vector-not-found' });
                }
                else {
                    return next(err);
                }
            }

            async.map(String(data.Body).split(','), function(number, next) {
                next(null, parseFloat(number));
            }, function done(err, vector) {
                res.json({ vector: vector });
            });

        });
    });

});

router.get('/csv/:classiId', function(req, res) {
    res.type('json');

    model.classifications.getName(req.params.classiId, function(err, row) {
        if(err) throw err;

        var cname = row[0].name;
        var pid = row[0].pid;

        if(!req.haveAccess(pid, "manage models and classification")) {
            // TODO use std error message json, presentation is a frontend task
            return res.send('<html><body><a href="/" class="navbar-brand">'+
                            '<img src="/images/logo.svg"></a>'+
                            '<hr><div style="font-size:14px;font-family:Helvetica,Arial,sans-serif;">Error: Cannot download CSV file. You dont have permission to \'manage models and classifications\'</div></body>');
        }

        res.set({
            'Content-Disposition' : 'attachment; filename="'+cname+'.csv"',
            'Content-Type' : 'text/csv'
        });

        model.classifications.getCsvData(req.params.classiId, function(err, row) {
            if(err) throw err;
            var data = [];

            var thisrow;
            thisrow = row[0];
            var th = thisrow.threshold;

            if(th) {
                var fields = [
                    "rec",
                    "model presence",
                    "threshold presence",
                    "current threshold",
                    "vector max value",
                    "site",
                    "year",
                    "month",
                    "day",
                    "hour",
                    "minute",
                    "species",
                    "songtype"
                ];

                data.push(fields.join(','));

                for(var i = 0 ; i < row.length ; i++)
                {
                        thisrow = row[i];
                        var maxVal = thisrow.mvv;
                        var tprec = 0;
                        if(maxVal >= th )
                        {
                            tprec = 1;
                        }

                        data.push( '"'+ thisrow.rec +'",'+ thisrow.present+','+tprec +','+th+','+maxVal+','+
                           thisrow.name+',' + thisrow.year+',' + thisrow.month+','+
                           thisrow.day+',' + thisrow.hour+','+ thisrow.min+',"' +
                           thisrow.scientific_name+'","'+ thisrow.songtype+'"');
                }
                res.send(data.join("\n"));
            }
            else
            {
                data.push('"rec","presence","site","year","month","day","hour","minute","species","songtype"');
                for(var j = 0; j < row.length; j++)
                {
                    thisrow = row[j];

                    data.push( '"'+ thisrow.rec+'",'+ thisrow.present+','+
                            thisrow.name+',' + thisrow.year+',' + thisrow.month+','+
                            thisrow.day+',' + thisrow.hour+','+ thisrow.min+',"' +
                            thisrow.scientific_name+'","'+ thisrow.songtype+'"');
                }
                res.send(data.join("\n"));
            }
        });
    });


});

module.exports = router;
