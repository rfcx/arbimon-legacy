/* jshint node:true */
"use strict";

const express = require('express');
const router = express.Router();
const model = require('../../../model');
const { httpErrorHandler, Converter } = require('@rfcx/http-utils');

/** Return a list of all the templates in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    var params = {
        deleted: 0,
        showSpecies: true,
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
    }
    else {
        params.project = req.project.project_id;
    }
    model.templates.find(params).then(function(count) {
        res.json(count);
        return null;
    }).catch(next);
});

router.get('/count', function(req, res, next) {
    res.type('json');

    const project_id = req.project.project_id;
    const converter = new Converter(req.query, {});
    converter.convert('publicTemplates').optional().toBoolean();
    return converter.validate()
        .then(async (params) => {
            const result = await model.templates.templatesCount(project_id, params && params.publicTemplates)
            res.json({ count: result[0].count })
        })
        .catch(httpErrorHandler(req, res, 'Error getting templates count'))
});

router.get('/:template/image', function(req, res, next) {
    res.type('json');
    model.templates.fetchDataImage(req.template, req.dataId).then(function(data) {
        res.json(data);
    }).catch(next);
});

router.get('/:template/audio', function(req, res, next) {
    model.templates.getAudioFile(req.params.template, { gain: req.query.gain }).then(function(roiAudio) {
        if(!roiAudio){
            res.sendStatus(404);
        } else {
            res.sendFile(roiAudio.path);
        }
    }).catch(next);
});


router.use(function(req, res, next) {
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage templates")){
        return res.json({ error: "you dont have permission to 'manage templates'" });
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
    model.templates.insert(opts)
        .then(function(new_template) {
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
