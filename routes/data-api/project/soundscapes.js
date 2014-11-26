var express = require('express');
var router = express.Router();
var model = require('../../../models');

var region_router = express.Router();

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

var parse_bbox = function(bbox){
    var m=/^((\d+)?,(\d+)?-(\d+)?,(\d+)?|all)?$/.exec('' + bbox);
    if(!m){
        return null;
    }
    return {
        x1 : m[2] === undefined ? undefined : (m[2] | 0),
        y1 : m[3] === undefined ? undefined : (m[3] | 0),
        x2 : m[4] === undefined ? undefined : (m[4] | 0),
        y2 : m[5] === undefined ? undefined : (m[5] | 0)
    };
};

router.param('bbox', function(req, res, next, bbox){
    var bb = parse_bbox(bbox);
    if(!bb){
        return res.status(404).json({ error: "Invalid bounding box."});
    }
    req.bbox = bb;
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

router.get('/:soundscape', function(req, res, next) {
    res.json(req.soundscape);
});

router.use('/:soundscape/regions/', region_router);

router.get('/:soundscape/recordings/:bbox', function(req, res, next) {
    var soundscape = req.soundscape;
    var filters = {
        ignore_offsets : true,
        minx : ((req.bbox.x1 - soundscape.min_t)) | 0,
        maxx : ((req.bbox.x2 - soundscape.min_t)) | 0,
        miny : ((req.bbox.y1 - soundscape.min_f) / soundscape.bin_size) | 0,
        maxy : ((req.bbox.y2 - soundscape.min_f) / soundscape.bin_size - 1) | 0
    };
    var just_count = req.query && req.query.count;
    model.soundscapes.fetchSCIDX(req.soundscape, filters, function(err, scidx){
        if(err){
            next(err);
        } else {
            if(just_count){
                res.json(scidx.count());
            } else {
                res.json(scidx.flatten());
            }
        }
    });
});

router.get('/details', function(req, res, next) {
    model.soundscapes.details(req.project.project_id,
    function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});


(function(router){

router.param('region', function(req, res, next, region){
    if(!req.soundscape){
        return res.status(404).json({ error: "cannot find region without soundscape."});
    }
    
    model.soundscapes.getRegions(req.soundscape, {
        region : region
    }, function(err, regions) {
        if(err) return next(err);

        if(!regions.length){
            return res.status(404).json({ error: "region not found"});
        }
        req.region = regions[0];
        return next();
    });
});

router.get('/', function(req, res, next) {
    model.soundscapes.getRegions(req.soundscape, function(err, regions){
        if(err){
            next(err);
        } else {
            res.json(regions);
        }
    });
});

router.post('/add', function(req, res, next) {
    var bbox = parse_bbox(req.body.bbox);
    model.soundscapes.addRegion(req.soundscape, {
        bbox : bbox,
        name : req.body.name
    }, function(err, region){
        if(err){
            next(err);
        } else {
            res.json(region);
        }
    });
});

router.get('/:region', function(req, res, next) {
    res.json(req.region);
});

router.post('/:region/sample', function(req, res, next) {
    model.soundscapes.sampleRegion(req.soundscape, req.region, {
        count : req.region.count * req.body.percent
    }, function(err, region){
        if(err){
            next(err);
        } else {
            res.json(region);
        }
    });
});


router.get('/:region/tags/:recid', function(req, res, next) {
    model.soundscapes.getRegionTags(req.region, {
        recording : req.params.recid
    }, function(err, region){
        if(err){
            next(err);
        } else {
            res.json(region);
        }
    });
});

router.post('/:region/tags/:recid/add', function(req, res, next) {
    model.soundscapes.addRegionTag(req.region, req.params.recid, req.session.user.id, req.body.tag, function(err, tag){
        if(err){
            next(err);
        } else {
            res.json(tag);
        }
    });
});


router.post('/:region/tags/:recid/remove', function(req, res, next) {
    model.soundscapes.removeRegionTag(req.region, req.params.recid, req.body.tag, function(err, tag){
        if(err){
            next(err);
        } else {
            res.json(tag);
        }
    });
});

})(region_router);


module.exports = router;
