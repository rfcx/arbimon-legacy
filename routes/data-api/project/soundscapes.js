var debug = require('debug')('arbimon2:route:soundscapes');
var express = require('express');
var sprintf = require("sprintf-js").sprintf;
var async = require('async');
var AWS = require('aws-sdk');

var config = require('../../../config');
var model = require('../../../model');

var s3 = new AWS.S3();
var router = express.Router();
var region_router = express.Router();


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


router.param('soundscape', function(req, res, next, soundscape){
    model.soundscapes.find({
        id      : soundscape,
        project : req.project.project_id
    }, function(err, soundscapes) {
        if(err) return next(err);

        if(!soundscapes.length){
            return res.status(404).json({ error: "soundscape not found" });
        }
        
        var s = soundscapes[0];
        // console.log(s);
        s.aggregation = {
            id: s.aggregation,
            name: s.aggr_name,
            scale: JSON.parse(s.aggr_scale)
        };
        
        delete s.aggr_name;
        delete s.aggr_scale;
        
        req.soundscape = s;
        
        return next();
    });
});


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

router.get('/details', function(req, res, next) {
    model.soundscapes.details(req.project.project_id,
    function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});


router.get('/:soundscape', function(req, res, next) {
    res.json(req.soundscape);
});

router.get('/:soundscape/delete', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "manage soundscapes"))
        return res.json({ error: "you dont have permission to 'manage soundscapes'" });
    
    model.soundscapes.delete(req.soundscape.id,
    function(err, data) {
        if(err) return next(err);

        res.json({ok:'Soundscape deleted.'});
        return null;
    });
});

router.get('/:soundscape/scidx', function(req, res, next) {
    var soundscape = req.soundscape;
    var just_count = req.query && req.query.count;
    model.soundscapes.fetchSCIDX(req.soundscape, {
        just_count : just_count
    },function(err, scidx){
        if(err){
            next(err);
        } else {
            res.json(scidx);
        }
    });
});

router.get('/:soundscape/indices', function(req, res, next) {
    
    var uri = sprintf('project_%(project_id)s/soundscapes/%(soundscape_id)s/', {
        project_id: req.project.project_id,
        soundscape_id: req.soundscape.id
    });
    
    async.parallel({
        H: function(callback) {
            s3.getObject({
                Bucket: config('aws').bucketName,
                Key: uri + 'h.json'
            },
            callback);
        },
        ACI: function(callback) {
            s3.getObject({
                Bucket: config('aws').bucketName,
                Key: uri + 'aci.json'
            },
            callback);
        },
        NP: function(callback) {
            s3.getObject({
                Bucket: config('aws').bucketName,
                Key: uri + 'peaknumbers.json'
            },
            callback);
        }
    },
    function(err, results) {
        if(err) return next(err);
        
        res.json({
            H: JSON.parse(results.H.Body),
            ACI: JSON.parse(results.ACI.Body),
            NP: JSON.parse(results.NP.Body),
        });
    });
});

router.post('/:soundscape/scale', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "manage soundscapes"))
        return res.json({ error: "you dont have permission to 'manage soundscapes'" });
        
    model.soundscapes.setVisualScale(req.soundscape, {
        max : req.body.max,
        palette : (req.body.palette | 0)
    }, function(err, soundscape){
        if(err){
            next(err);
        } else {
            res.json(soundscape && soundscape.pop());
        }
    });
});


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


region_router.param('region', function(req, res, next, region){
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

region_router.get('/', function(req, res, next) {
    model.soundscapes.getRegions(req.soundscape, {
        compute:req.query.view
    },function(err, regions){
        if(err){
            next(err);
        } else {
            res.json(regions);
        }
    });
});

region_router.post('/add', function(req, res, next) {
    
    if(!req.haveAccess(req.project.project_id, "manage soundscapes"))
        return res.json({ error: "you dont have permission to 'manage soundscapes'" });
    
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

region_router.get('/:region', function(req, res, next) {
    res.json(req.region);
});

region_router.post('/:region/sample', function(req, res, next) {
    model.soundscapes.sampleRegion(req.soundscape, req.region, {
        count : (req.region.count * (req.body.percent|0) / 100.0) | 0
    }, function(err, region){
        if(err){
            next(err);
        } else {
            res.json(region);
        }
    });
});


region_router.get('/:region/tags/:recid', function(req, res, next) {
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

region_router.post('/:region/tags/:recid/add', function(req, res, next) {
    
    if(!req.haveAccess(req.project.project_id, "manage soundscapes"))
        return res.json({ error: "you dont have permission to 'manage soundscapes'" });
    
    model.soundscapes.addRegionTag(req.region, req.params.recid, req.session.user.id, req.body.tag, function(err, tag){
        if(err){
            next(err);
        } else {
            res.json(tag);
        }
    });
});


region_router.post('/:region/tags/:recid/remove', function(req, res, next) {
    
    if(!req.haveAccess(req.project.project_id, "manage soundscapes"))
        return res.json({ error: "you dont have permission to 'manage soundscapes'" });
    
    model.soundscapes.removeRegionTag(req.region, req.params.recid, req.body.tag, function(err, tag){
        if(err){
            next(err);
        } else {
            res.json(tag);
        }
    });
});

router.use('/:soundscape/regions/', region_router);

module.exports = router;
