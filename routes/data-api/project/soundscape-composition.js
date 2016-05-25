var express = require('express');
var router = express.Router();

var model = require('../../../model');

router.get('/classes', function(req, res, next){
    model.SoundscapeComposition.getClassesFor({
        project: req.project.project_id
    }).then(function(classes){
        res.json(classes);
    }).catch(next);
});

router.get('/annotations/:id', function(req, res, next) {
    res.type('json');
    model.SoundscapeComposition.getAnnotationsFor({
        recording: req.params.id,
        groupResults : true
    }).then(function(annotations){
        res.json(annotations);
    }).catch(next);
});

router.use(function(req, res, next) { 
    // TODO: use another permission, instead of borrowing this one.
    if(!req.haveAccess(req.project.project_id, "validate species")){
        return res.json({ error: "you dont have permission to add soundscape composition annotations." });
    }
    next();
});

router.post('/annotate/:id', function(req, res, next) {
    res.type('json');
    model.SoundscapeComposition.annotate({
        recording: req.params.id,
        annotation : req.body
    }).then(function(annotations){
        res.json(annotations);
    }).catch(next);
});

module.exports = router;
