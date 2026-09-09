const express = require('express');
const router = express.Router();
const model = require('../../../model');

router.get('/', function(req, res, next){
    res.type('json');
    model.tags.search({
        q:req.query.q || '', 
        offset:req.query.off || 0,
        limit:req.query.size || 10
    }).then(function(tags){
        res.json(tags);
    }).catch(next);
});

router.get('/:resource', function(req, res, next) {
    res.type('json');
    model.tags.getTagsForType(req.params.resource, {
        project: req.project.project_id
    }).then(function(tags){
        res.json(tags);
    }).catch(next);
});

router.get('/:resource/:id', function(req, res, next) {
    res.type('json');
    // 2026-09-09 (OPEN-ITEMS §292): bind the id to the project in the URL.
    model.tags.getTagsFor(req.params.resource, req.params.id, req.project.project_id).then(function(tags){
        res.json(tags);
    }).catch(next);
});


router.use(function(req, res, next) { 
    if(!req.haveAccess(req.project.project_id, 'manage project recordings'))
    throw new Error('You do not have permission to add and remove tags');
    next();
});

router.put('/:resource/:id', function(req, res, next) {
    res.type('json');
    let tag = {};
    if(req.body){
        Object.keys(req.body).forEach(function(k){
            tag[k] = req.body[k];
        });
    }
    tag.user = req.session && req.session.user;
    model.recordings.findByIdAsync(req.params.id).then(function(recording) {
        if (!recording || !recording.length) {
            throw new Error('Recording not found')
        }
        model.tags.addTagTo(req.params.resource, recording[0], tag).then(function(tags){
            res.json(tags);
        }).catch(next);
    })
});

router.delete('/:resource/:id/:tagId', function(req, res, next) {
    res.type('json');
    // 2026-09-09 (OPEN-ITEMS §292): bind the id to the project in the URL.
    model.tags.removeTagFrom(req.params.resource, req.params.id, req.params.tagId, req.project.project_id).then(function(results){
        res.json(results);
    }).catch(next);
});

module.exports = router;
