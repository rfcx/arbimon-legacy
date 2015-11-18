var express = require('express');
var router = express.Router();

var model = require('../../../model');

router.get('/', function(req, res, next){
    model.tags.search({
        q:req.query.q || '', 
        offset:req.query.off || 0,
        limit:req.query.size || 10
    }).then(function(tags){
        res.json(tags);
    }).catch(next);
});

router.get('/:resource/:id', function(req, res, next) {
    res.type('json');
    model.tags.getTagsFor(req.params.resource, req.params.id).then(function(tags){
        res.json(tags);
    }).catch(next);
});


router.use(function(req, res, next) { 
    // TODO: use another permission, instead of borrowing this one.
    if(!req.haveAccess(req.project.project_id, "manage training sets"))
        return res.json({ error: "you dont have permission to 'add/remove tags'" });        
    next();
});

router.put('/:resource/:id', function(req, res, next) {
    res.type('json');
    var tag = {user:req.session && req.session.user};
    if(req.body){
        if(req.body.id){
            tag.id = req.body.id;
        } else if(req.body.text){
            tag.text = req.body.text;
        }
    }
    model.tags.addTagTo(req.params.resource, req.params.id, tag).then(function(tags){
        res.json(tags);
    }).catch(next);
});

router.delete('/:resource/:id/:tagId', function(req, res, next) {
    res.type('json');
    model.tags.removeTagFrom(req.params.resource, req.params.id, req.params.tagId).then(function(results){
        res.json(results);
    }).catch(next);
});

module.exports = router;
