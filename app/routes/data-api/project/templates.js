/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../../model');


/** Return a list of all the templates in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    var params = {
        deleted: 0,
        showSpecies: true
    }
    if (req.query.showRecordingUri === 'true') {
        params.showRecordingUri = req.query.showRecordingUri;
    }
    if (req.query.showOwner === 'true') {
        params.showOwner = req.query.showOwner;
        params.user_id = req.session.user.id;
    }
    if (req.query.allAccessibleProjects === 'true') {
        params.allAccessibleProjects = req.query.allAccessibleProjects;
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
    model.templates.insert({
        name: req.body.name,
        project : req.project.project_id,
        recording: req.body.recording,
        species: req.body.species,
        songtype: req.body.songtype,
        x1: req.body.roi.x1,
        y1: req.body.roi.y1,
        x2: req.body.roi.x2,
        y2: req.body.roi.y2,
    }).then(function(new_template) {
        // model.projects.insertNews({
        //     news_type_id: 7, // template created
        //     user_id: req.session.user.id,
        //     project_id: req.project.project_id,
        //     data: JSON.stringify({ training_set: req.body.name })
        // });

        res.json(new_template);
    }).catch(next);
});

router.post('/:template/remove', function(req, res, next) {
    res.type('json');
    model.templates.delete(req.params.template | 0).then(function() {
        res.json({ok: true});
    }).catch(next);
});


// /** Edit a template.
// */
// router.post('/edit/:template', function(req, res, next) {
//     res.contentType('application/json');
//     model.templates.edit(req.template, {
//         name    : req.body.name,
//         extras  : req.body
//     }).then(function(edited_tset) {
//         model.projects.insertNews({
//             news_type_id: 12, // template created
//             user_id: req.session.user.id,
//             project_id: req.project.project_id,
//             data: JSON.stringify({ training_set: req.template.name })
//         });
//
//         res.json(edited_tset && edited_tset[0]);
//         return null;
//     }, next);
// });
//
// /** Remove a template.
// */
// router.post('/remove/:template', function(req, res, next) {
//     res.type('json');
//     model.templates.remove(req.template).then(function() {
//         model.projects.insertNews({
//             news_type_id: 13, // template created
//             user_id: req.session.user.id,
//             project_id: req.project.project_id,
//             data: JSON.stringify({ training_set: req.template.name })
//         });
//
//         res.json(req.template);
//         return null;
//     }, next);
// });


module.exports = router;
