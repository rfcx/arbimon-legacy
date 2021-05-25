var express = require('express');
var router = express.Router();

var model = require('../../../model');

router.get('/classes', function(req, res, next){
    res.type('json');
    let classes = [];
    model.SoundscapeComposition.getClassesFor({
        project: req.project.project_id,
        tally: !!req.query.tally,
    }).then((data) => {
        classes = data;
        model.SoundscapeComposition.getClassesFor({
            project: req.project.project_id,
            tally: !!req.query.tally,
            isSystemClass: !!req.query.isSystemClass
        }).then((systemClasses) => {
            systemClasses.forEach(obj => {
                if (!classes.find((c) => c.id === obj.id)) {
                    classes.push(obj)
                }
            });
            res.json(classes);
        })
    }).catch(next);
});

router.post('/add-class', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        next(new APIError("You don't have permission to 'add soundscape composition classes'"));
        return;
    }

    model.SoundscapeComposition.addClass(
        req.body.name,
        req.body.type,
        req.project.project_id
    ).then(function(new_class){
        res.json(new_class);
    }).catch(next);
});

router.post('/remove-class', function(req, res, next) {
    res.type('json');

    if(!req.haveAccess(req.project.project_id, "manage project species")) {
        next(new APIError("You don't have permission to 'remove soundscape composition classes'"));
        return;
    }

    model.SoundscapeComposition.removeClassFrom(
        req.body.id,
        req.project.project_id
    ).then(function(){
        res.json({result:'success'});
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
