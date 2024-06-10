/* jshint node:true */
"use strict";

var q = require('q');
var express = require('express');
var router = express.Router();
var model = require('../../../model');
var csv_stringify = require("csv-stringify");
const dayInMs = 24 * 60 * 60 * 1000;
const fs = require('fs');
const path = require('path');

let cachedData = {
    counts: { }
};

/** Return a list of all the pattern matchings in a project.
 */
router.get('/', function(req, res, next) {
    getPatternMatchings(req, res, next)
});

async function getPatternMatchings(req, res, next) {
    if (req.query.rec_id) {
        return model.patternMatchings.getPatternMatchingRois({
            rec_id: req.query.rec_id,
            validated: req.query.validated
        })
        .then(function(data){
            res.json(data);
        }).catch(next);
    }

    let opts = {
        project:req.project.project_id,
        deleted:0,
        showUser:true,
        showTemplate: true,
        showSpecies: true,
        showPlaylistName: true,
        ...!!req.query.completed && { completed: req.query.completed },
        q: req.query.q,
        limit: req.query.limit,
        offset: req.query.offset,
        showCounts: req.query.showCounts
    };

    if (req.query.limit) {
        model.patternMatchings.findWithPagination(opts)
            .then(data => {
                res.json(data);
            }).catch(next);
    }
    else {
        model.patternMatchings.find(opts).then(function(count) {
            res.json(count);
        }).catch(next);
    }
}

/** Return a pattern matching's data.
 */
router.get('/:patternMatching/details', function(req, res, next) {
    res.type('json');
    model.patternMatchings.findOne({
        id: req.params.patternMatching,
        showTemplate: true,
        showPlaylistName: true,
        showPlaylistCount: true,
        showCounts: true,
        showSpecies: true,
    }).then(function(pm) {
        res.json(pm);
    }).catch(next);
});

router.get('/count', function(req, res, next) {
    res.type('json');
    let p = req.project.project_id;
    if (req.query.cache && cachedData.counts[p] && (Date.now() - cachedData.counts[p].time < dayInMs)) {
        return res.json(cachedData.counts[p].count);
    }
    else {
        model.patternMatchings.totalPatternMatchings(p).then((count) => {
            cachedData.counts[req.project.project_id] = {
                count: count,
                time: Date.now()
            };
            res.json(count);
        }).catch(next);
    }
});

router.param('paging', function(req, res, next, paging){
    const components = paging.split('_');
    req.paging = {
        offset: (components[0] | 0),
        limit: (components[1] | 0),
    }
    return next();
});

router.get('/:patternMatching/rois/:paging', async function(req, res, next) {
    res.type('json');
    model.patternMatchings.getPmRois(req)
        .then((json) => res.json(json))
        .catch(next);
});

router.get('/:patternMatching/site-index', function(req, res, next) {
    res.type('json');
    model.patternMatchings.getSitesForPM(req.params.patternMatching)
        .then(function(sites) {
            res.json(sites)
        }).catch(next);
});

router.get('/:patternMatching/:fileName?', function(req, res, next) {
    if(req.query.out=="text"){
        res.type('text/plain');
    } else {
        res.setHeader('Content-type', 'text/csv')
        res.set({ 'Content-Disposition' : `attachment; filename=${ req.params.fileName }`})
        res.type('text/csv');
    }

    try {
        var filters = JSON.parse(req.query.filters || '{}') || {};
    } catch(e) {
        return next(e);
    }

    filters.project_id = req.project.project_id | 0;

    model.patternMatchings.getPmRoiRecordingUri(req.params.patternMatching).then(async (rows) => {
        const recObj = {}
        for (let row of rows) {
            if (!recObj[row.recording_id]) {
                const signedUrl = await model.patternMatchings.getSignedUrl(row.uri)
                recObj[row.recording_id] = signedUrl ? signedUrl : 'no data'
            }
        }
        return model.patternMatchings.exportRois(req.params.patternMatching, filters).then(function(results) {
            const datastream = results[0];
            const fields = results[1].map(function(f) { return f.name });
            ['year', 'month', 'day', 'hour', 'minute', 'url', 'frequency'].forEach(item=> { fields.push(item) });
            ['datetime', 'meta', 'recording_id', 'sample_rate'].forEach(item=> {
                let index = fields.findIndex(i => i === item);
                fields.splice(index, 1);
            });
            const colOrder= { id: -17, recording: -16, site: -15, year: -14, month: -13, day: -12, hour: -11, minute: -10,
                species: -9, songtype: -8, x1: -7, x2: -6, y1: -5, y2: -4, frequency: -3, validated: -2,url: -1
            };
            fields.sort(function(a, b) {
                var ca = colOrder[a] || 0, cb = colOrder[b] || 0;
                return ca < cb ? -1 : (
                       ca > cb ?  1 : (
                        a <  b ? -1 : (
                        a >  b ?  1 :
                        0
                )));
            });
            datastream
                .on('data', (data) => {
                    model.patternMatchings.exportDataFormatted(data, recObj);
                })
                .pipe(csv_stringify({ header: true, columns: fields }))
                .pipe(res);
        }).catch(next);
    }).catch(next);
});

router.get('/:patternMatching/audio/:roiUrl', function(req, res, next) {
    const roiUrl = req.params.roiUrl;
    const ext = path.extname(roiUrl)
    const roiId = path.basename(roiUrl, ext);
    model.patternMatchings.getRoiAudioFile(req.params.patternMatching, roiId, { gain: req.query.gain }).then(function(roiAudio) {
        if (!roiAudio){
            res.sendStatus(404);
        } if (roiAudio.path.includes('/internal')) {
            roiAudio.pipe(res)
        } else {
            res.sendFile(roiAudio.path, function () {
                if (fs.existsSync(roiAudio.path)) {
                    fs.unlink(roiAudio.path, function (err) {
                        if (err) console.error('Error deleting the PM file.', err);
                        console.info('PM file deleted.');
                    })
                }
            })
        }
    }).catch(next);
});

router.post('/:patternMatching/update', function(req, res, next) {
    res.type('json');
    model.patternMatchings.updateJobName(req.params.patternMatching, req.body.name).then(function() {
        res.json();
    }).catch(next);
});

router.post('/:patternMatching/validate', function(req, res, next) {
    res.type('json');
    const validation = req.body.validation
    model.patternMatchings.getRoi(req.params.patternMatching, req.body.rois).then(async function(rois) {
        const updatedRois = rois.filter(function(roi) { return roi.validated != validation });
        if (!updatedRois || !updatedRois.length) {
            console.log('--500 status: patternMatchings.getRoi', updatedRois.length)
            return next(new Error('Error to get PM data'));
        }
        const updatedRoiIds = updatedRois.map(function(roi) { return roi.pattern_matching_roi_id });
        let options = {};
        options.speciesId = updatedRois[0].species_id;
        options.songtypeId = updatedRois[0].songtype_id;
        let existingClass = await model.projects.getProjectClassesAsync(req.project.project_id, null, options);
        if (!existingClass.length) {
            var projectClass = {
                songtype: req.body.cls.songtype,
                species: req.body.cls.species,
                project_id: req.project.project_id
            };
            model.projects.insertClass(projectClass, function(err, result){
                if(err) return next(err);
                model.projects.insertNews({
                    news_type_id: 5,
                    user_id: req.session.user.id,
                    project_id: req.project.project_id,
                    data: JSON.stringify({
                        class: [result.class],
                        species: [result.species, projectClass.species],
                        song: [result.songtype, projectClass.songtype]
                    })
                });
            });
        };
        model.patternMatchings.validateRois(req.params.patternMatching, updatedRoiIds, validation)
            .then(async function(validatedRois) {
                for (let roi of updatedRois) {
                    const previousValidation = roi.validated;
                    await model.recordings.validate({id: roi.recording_id}, req.session.user.id, req.project.project_id,
                        { class: `${roi.species_id}-${roi.songtype_id}`, val: validation, oldVal: previousValidation, review: true})
                }
            }).then(function() {
                res.json({
                    rois: updatedRoiIds,
                    validation: req.body.validation,
            });
        }).catch(next);
    }).catch(next);
});

router.post('/:patternMatching/remove', function(req, res, next) {
    res.type('json');

    const projectId = req.project.project_id;
    const patternMatchingId = req.params.patternMatching
    q.resolve().then(function(){
        if(!req.haveAccess(projectId, "manage pattern matchings")){
            throw new Error("You don't have permission to delete pattern matchings");
        }
    }).then(function(){
        return model.patternMatchings.delete(patternMatchingId | 0);
    }).then(async function() {
        res.json({ok: true});
        const userId = req.session.user.id
        await model.patternMatchings.unvalidateRois(patternMatchingId, userId, projectId)
        const jobData = await model.patternMatchings.getPMjobId(patternMatchingId)
        await model.jobs.hideAsync(jobData.job_id)
    }).catch(next);
});

router.post('/new', function(req, res, next) {
    res.type('json');

    var project_id = req.project.project_id;

    q.resolve().then(function(){
        if (!req.haveAccess(project_id, "manage pattern matchings")) {
            throw new Error("You don't have permission to run pattern matchings");
        }
    }).then(function(){
        return model.patternMatchings.requestNewPatternMatchingJob({
            project    : project_id,
            user       : req.session.user,
            name       : req.body.name,
            template   : req.body.template,
            playlist   : req.body.playlist,
            params   : req.body.params,
        });
}).then(function(result){
        res.json({ ok: true, result: result });
    }).catch(next);
});


module.exports = router;
