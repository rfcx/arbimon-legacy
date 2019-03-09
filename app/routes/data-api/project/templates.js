/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../../model');


/** Return a list of all the templates in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    model.templates.find({ project:req.project.project_id }, function(err, count) {
        if(err) return next(err);
        res.json(count);
        return null;
    });
});

router.get('/:template/image', function(req, res, next) {
    res.type('json');
    model.templates.fetchDataImage(req.template, req.dataId, function(err, data) {
        if(err) return next(err);
        res.json(data);
    });
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
