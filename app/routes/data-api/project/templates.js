/* jshint node:true */
"use strict";

const express = require('express');
const router = express.Router();
const model = require('../../../model');
const { httpErrorHandler, Converter } = require('@rfcx/http-utils');
const fs = require('fs');
const path = require('path');

/** Return a list of all the templates in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    var params = {
        deleted: 0,
        showSpecies: true,
        q: req.query.q,
        taxon: req.query.taxon
    };
    if (req.query.showRecordingUri === 'true') {
        params.showRecordingUri = req.query.showRecordingUri;
    }
    if (req.query.limit !== undefined) {
        params.limit = req.query.limit;
    }
    if (req.query.offset) {
        params.offset = req.query.offset;
    }
    if (req.query.projectTemplates === 'true') {
        params.projectTemplates = req.query.projectTemplates;
        params.user_id = req.session.user.id;
    }
    if (req.query.publicTemplates === 'true') {
        params.publicTemplates = req.query.publicTemplates;
        params.user_id = req.session.user.id;
        params.isRfcxUser = req.session.user.isRfcx
    }
    else {
        params.project = req.project.project_id;
    }
    if (req.query.limit) {
        model.templates.findWithPagination(params).then(function(data) {
            res.json(data);
            return null;
        }).catch(next);
    }
    else {
        model.templates.find(params).then(function(data) {
            res.json(data);
            return null;
        }).catch(next);
    }
});

router.get('/class', function(req, res, next) {
    res.type('json');
    model.templates.getTemplatesByClass(req.query.classIds).then(function(data) {
        res.json(data);
    }).catch(next);
});

router.get('/count', function(req, res, next) {
    res.type('json');

    const project_id = req.project.project_id;
    const converter = new Converter(req.query, {});
    converter.convert('publicTemplates').optional().toBoolean();
    converter.convert('projectTemplates').optional().toBoolean();
    return converter.validate()
        .then(async (params) => {
            const condition = params && params.projectTemplates ? ' AND T.source_project_id IS NULL' : null
            const isRfcxUser = req.session.user.isRfcx
            const count = await model.templates.templatesCount(project_id, params && params.publicTemplates, null, condition, isRfcxUser)
            res.json({ count })
        })
        .catch(httpErrorHandler(req, res, 'Error getting templates count'))
});

router.get('/:template/image', function(req, res, next) {
    res.type('json');
    model.templates.fetchDataImage(req.template, req.dataId).then(function(data) {
        res.json(data);
    }).catch(next);
});

/** Renders a template's ROI spectrogram DYNAMICALLY via the media-api.
 *
 * WHY (2026-08-03): template images used to be rendered once at creation time
 * and uploaded to S3 (templates.uri). That baked any render-time defect into
 * storage forever -- and a tmpfilecache key collision (see
 * Recordings.buildAssetCacheKey) meant ~21-35% of templates created after
 * 2026-06-09 stored the full-recording COLOUR spectrogram instead of the
 * monochrome ROI crop.
 *
 * Rendering on demand from the recording + the ROI box (x1/x2/y1/y2) makes the
 * image a pure function of data we still hold, so a defect is fixed by a code
 * change alone (no S3 backfill), and the ROI box staying in sync with the
 * picture is guaranteed. media-api asset names are content-addressed, so the
 * response is immutable and cacheable for a year.
 *
 * Legacy recordings (uri starts with 'project_') have no media-api stream and
 * keep using the stored image.
 */
router.get('/:template/spectrogram', function(req, res, next) {
    model.templates.find({
        id: req.params.template,
        showRecordingUri: true,
        showSiteData: true
    }).get(0).then(function(template) {
        if (!template) return res.sendStatus(404);

        // Legacy (pre-media-api) recordings have no media-api stream: fall back
        // to the stored S3 image. NOTE: use `storedUri` -- `uri` is now THIS
        // route (see model/templates.js find()), so redirecting to it would loop.
        if (!template.recUri || String(template.recUri).startsWith('project_')) {
            if (!template.storedUri) return res.sendStatus(404);
            return res.redirect(302, template.storedUri);
        }

        const recording = {
            uri: template.recUri,
            external_id: template.external_id,
            datetime: template.datetime,
            datetime_utc: template.datetime_utc
        };
        const maxFreq = Math.max(template.y1, template.y2);
        const minFreq = Math.min(template.y1, template.y2);
        const options = {
            maxFreq: (template.sample_rate && maxFreq > template.sample_rate / 2)
                ? template.sample_rate / 2
                : maxFreq,
            minFreq: minFreq,
            trim: {
                from: Math.min(template.x1, template.x2),
                to: Math.max(template.x1, template.x2)
            }
        };
        const attr = model.recordings.buildMediaApiAttr(recording, 'template', options);
        // Serve through the existing content-addressed asset proxy, which
        // already rewrites images to inline + immutable caching.
        return res.redirect(302, `/legacy-api/ingest/recordings/${attr}`);
    }).catch(next);
});

router.get('/audio/:templateUrl', function(req, res, next) {
    const roiUrl = req.params.templateUrl;
    const ext = path.extname(roiUrl)
    const template = path.basename(roiUrl, ext);
    model.templates.getAudioFile(template, { gain: req.query.gain }).then(function(roiAudio) {
        if (!roiAudio){
            res.sendStatus(404);
        } if (roiAudio.path.includes('/internal')) {
            roiAudio.pipe(res)
        } else {
            res.sendFile(roiAudio.path, function () {
                if (fs.existsSync(roiAudio.path)) {
                    fs.unlink(roiAudio.path, function (err) {
                        if (err) console.error('Error deleting the template file.', err);
                        console.info('Template file deleted.');
                    })
                }
            })
        }
    }).catch(next);
});

router.get('/download/:templateUrl', function(req, res, next) {
    const templateUrl = req.params.templateUrl;
    const ext = path.extname(templateUrl)
    const templateId = path.basename(templateUrl, ext);
    model.templates.find({ id: templateId }).then(function(template) {
        return model.templates.getAudioFile(templateId, { gain: 5 }).then(function(roiAudio) {
            res.set({ 'Content-Disposition' : `attachment; filename=${ template[0].name }.wav`})
            res.setHeader('Content-type', 'audio/wav')
            if (!roiAudio){
                res.sendStatus(404);
            } if (roiAudio.path.includes('/internal')) {
                roiAudio.pipe(res)
            } else {
                res.sendFile(roiAudio.path, function () {
                    if (fs.existsSync(roiAudio.path)) {
                        fs.unlink(roiAudio.path, function (err) {
                            if (err) console.error('Error deleting the template file.', err);
                            console.info('Template file deleted.');
                        })
                    }
                })
            }
        }).catch(next);
    }).catch(next);
});


router.use(function(req, res, next) {
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage templates")){
        return res.json({ error: "you dont have permission to manage templates" });
    }
    next();
});


/** Add a template to a project.
*/
router.post('/add', function(req, res, next) {
    res.type('json');
    var opts = {
        name: req.body.name,
        project : req.project.project_id,
        recording: req.body.recording,
        species: req.body.species,
        songtype: req.body.songtype,
        x1: req.body.roi.x1,
        y1: req.body.roi.y1,
        x2: req.body.roi.x2,
        y2: req.body.roi.y2,
        user_id: req.session.user.id
    };
    if (req.body.source_project_id) {
        opts.source_project_id = req.body.source_project_id;
    }
    return model.templates.insert(opts).then(function(new_template) {
        res.json(new_template);
    }).catch(next);
});

router.post('/:template/remove', function(req, res, next) {
    res.type('json');
    model.templates.delete(req.params.template | 0).then(function() {
        res.json({ok: true});
    }).catch(next);
});

module.exports = router;
