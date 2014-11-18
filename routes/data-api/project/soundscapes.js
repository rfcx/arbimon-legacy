var express = require('express');
var router = express.Router();
var model = require('../../../models');


router.param('soundscape', function(req, res, next, soundscape){
    model.soundscapes.find({
        id      : soundscape,
        project : req.project.project_id
    }, function(err, soundscapes) {
        if(err) return next(err);

        if(!soundscapes.length){
            return res.status(404).json({ error: "soundscape not found"});
        }
        req.soundscape = soundscapes[0];
        return next();
    });
});

router.param('bbox', function(req, res, next, bbox){
    var m=/^((\d+)?,(\d+)?-(\d+)?,(\d+)?|all)?$/.exec(bbox);
    if(!m){
        return res.status(404).json({ error: "Invalid bounding box."});
    }
    req.bbox = {
        x1 : m[2] === undefined ? undefined : (m[2] | 0),
        y1 : m[3] === undefined ? undefined : (m[3] | 0),
        x2 : m[4] === undefined ? undefined : (m[4] | 0),
        y2 : m[5] === undefined ? undefined : (m[5] | 0)
    };
    return next();
});


/** Return a list of all the soundscapes in a project.
 */
router.get('/', function(req, res, next) {
    model.soundscapes.find({project:req.project.project_id}, {
        compute:req.query && req.query.show
    }, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});


router.use('/:soundscape/recordings/:bbox', function(req, res, next) {
    var filters = {
        ignore_offsets : true,
        minx : req.bbox.x1,
        maxx : req.bbox.x2,
        miny : req.bbox.y1,
        maxy : req.bbox.y2
    };
    model.soundscapes.fetchSCIDX(req.soundscape, filters, function(err, scidx){
        if(err){
            next(err);
        } else {
            res.json(scidx.flatten());
        }
    });
});


module.exports = router;
