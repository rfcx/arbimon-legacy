var debug = require('debug')('arbimon2:route:soundscapes');
var express = require('express');
var sprintf = require("sprintf-js").sprintf;
var csv_stringify = require("csv-stringify");
var async = require('async');
var AWS = require('aws-sdk');
var q = require('q');

var config = require('../../../config');
var model = require('../../../model');

var router = express.Router();
var region_router = express.Router();

let s3, s3RFCx;
defineS3Clients();

function getS3ClientConfig (type) {
    return {
        accessKeyId: config(type).accessKeyId,
        secretAccessKey: config(type).secretAccessKey,
        region: config(type).region
    }
}

function defineS3Clients () {
    if (!s3) {
        s3 = new AWS.S3(getS3ClientConfig('aws'))
    }
    if (!s3RFCx) {
        s3RFCx = new AWS.S3(getS3ClientConfig('aws_rfcx'))
    }
}

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
    res.type('json');
    model.soundscapes.find({project:req.project.project_id}, {
        compute:req.query && req.query.show
    }, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});

router.get('/details', function(req, res, next) {
    res.type('json');
    model.soundscapes.details(req.project.project_id,
    function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});



router.get('/:soundscape', function(req, res, next) {
    res.type('json');
    res.json(req.soundscape);
});

router.get('/:soundscape/delete', function(req, res, next) {
    res.type('json');
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
    res.type('json');
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

router.get('/:soundscape/norm-vector', function(req, res, next) {
    res.type('json');
    var soundscape = req.soundscape;
    model.soundscapes.fetchNormVector(req.soundscape, function(err, vector){
        if(err){
            next(err);
        } else {
            res.json(vector);
        }
    });
});

router.get('/:soundscape/export-list', function(req, res, next) {
    var soundscape = req.soundscape;
    var raw = !!(req.query.raw|0);

    function dumpRawCsv(scidx){
        var filename = soundscape.name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g,'_')  + '.raw.csv';
        var cols = ["site", "recording", "time index", "frequency", "amplitude"];
        var recdata={};
        var stringifier = csv_stringify({header:true, columns:cols});
        res.setHeader('Content-disposition', 'attachment; filename='+filename);
        stringifier.pipe(res);
        return q.ninvoke(async, 'eachSeries', Object.keys(scidx.index), function(freq_bin, next_row){
            var row = scidx.index[freq_bin];
            var freq = freq_bin * soundscape.bin_size;
            return q.ninvoke(async, 'eachSeries', Object.keys(row), function(time, next_cell){
                var recs = row[time][0];
                var amps = row[time][1];
                var c_idxs=[]; for(var ri=0,re=recs.length; ri<re;++ri){ c_idxs.push(ri); }
                return q.ninvoke(async, 'eachSeries', c_idxs, function(c_idx, next_rec){
                    var rec_idx = recs[c_idx];
                    var amp = amps && amps[c_idx] || '-';
                    var recId = scidx.recordings[rec_idx];
                    return q.resolve().then(function(){
                        if(!recdata[recId]){
                            return q.ninvoke(model.recordings, 'findByUrlMatch', recId, null);
                        }
                    }).then(function(recordings){
                        if(!recdata[recId] && recordings && recordings.length > 0){
                            recdata[recId] = recordings[0];
                        }
                        return recdata[recId];
                    }).catch(function(err){
                        // ignore err, return no recording
                    }).then(function(recording){
                        if(!recording){
                            stringifier.write(["-", "id:"+recId, time, freq, amp]);
                        } else {
                            stringifier.write([recording.site, recording.file, time, freq, amp]);
                        }
                    }).nodeify(next_rec);
                }).nodeify(next_cell);
            }).nodeify(next_row);
        }).then(function(){
            stringifier.end();
        });
    }
    
    function dumpSCIDXMatrix(scidx){
        var filename = soundscape.name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g,'_')  + '.csv';
        var cols = [];
        var matrix = [];
        var x,y;
        for(x=0; x < scidx.width; ++x){
            cols.push(scidx.offsetx + x);
        }
        for(y=0; y < scidx.height; ++y){
            var row = [];
            for(x=0; x < scidx.width; ++x){
                row.push(0);
            }
            matrix.push(row);
        }
        res.setHeader('Content-disposition', 'attachment; filename='+filename);
        
        var recdata={};
        var threshold = soundscape.threshold;

        return q.resolve().then(function(){
            if(soundscape.threshold_type == 'relative-to-peak-maximum'){
                var maxAmp=0;
                return q.all(Object.keys(scidx.index).map(function(freq_bin){
                    var row = scidx.index[freq_bin];
                    return q.all(Object.keys(row).map(function(time){
                        var recs = row[time][0];
                        var amps = row[time][1];
                        return q.all(recs.map(function(rec_idx, c_idx){
                            var amp = amps && amps[c_idx];
                            if(maxAmp <= amp){
                                maxAmp = amp;
                            }
                        }));
                    }));
                })).then(function(){
                    threshold *= maxAmp;
                });
            }
        }).then(function(){
            Object.keys(scidx.index).map(function(freq_bin){
                var row = scidx.index[freq_bin];
                var freq = freq_bin * soundscape.bin_size;
                Object.keys(row).map(function(time){
                    var recs = row[time][0];
                    var amps = row[time][1];
                    if(!threshold){
                        matrix[freq_bin - scidx.offsety][time - scidx.offsetx] += recs.length;
                    } else {
                        recs.map(function(rec_idx, c_idx){
                            var amp = amps && amps[c_idx];
                            if(amp && amp > threshold){
                                matrix[freq_bin - scidx.offsety][time - scidx.offsetx]++;
                            }
                        });
                    }
                });
            });
        }).then(function(){
            if(soundscape.normalized){
                return model.soundscapes.fetchNormVector(soundscape).then(function(normvec){
                    for(x=0; x < scidx.width; ++x){
                        key = '' + (x + scidx.offsetx);
                        if(key in normvec){
                            var val = normvec[key];
                            for(y=0; y < scidx.height; ++y){
                                matrix[y][x] = matrix[y][x] * 1.0 / val;
                            }
                        }
                    }
                });
            }
        }).then(function(){
            var stringifier = csv_stringify({header:true, columns:['freq-min','freq-max'].concat(cols)});
            stringifier.pipe(res);
            for(y=matrix.length-1; y > -1; --y){
                var row = matrix[y];
                var freq = (scidx.offsety + y) * soundscape.bin_size;
                stringifier.write([freq, freq + soundscape.bin_size].concat(row));
            }
            stringifier.end();
        });
    }
    
    model.soundscapes.fetchSCIDX(req.soundscape).then(
        raw ? dumpRawCsv : dumpSCIDXMatrix
    ).catch(next);
});


router.get('/:soundscape/indices', function(req, res, next) {
    res.type('json');
    const isProd = process.env.NODE_ENV === 'production';
    const awsConfig = isProd ? config('aws') : config('aws_rfcx');
    const awsBucket = isProd ? awsConfig.bucketName : awsConfig.bucketNameStaging;

    var uri = sprintf('project_%(project_id)s/soundscapes/%(soundscape_id)s/', {
        project_id: req.project.project_id,
        soundscape_id: req.soundscape.id
    });
    
    async.parallel({
        H: function(callback) {
            (isProd ? s3 : s3RFCx).getObject({
                Bucket: awsBucket,
                Key: uri + 'h.json'
            },
            callback);
        },
        ACI: function(callback) {
            (isProd ? s3 : s3RFCx).getObject({
                Bucket: awsBucket,
                Key: uri + 'aci.json'
            },
            callback);
        },
        NP: function(callback) {
            (isProd ? s3 : s3RFCx).getObject({
                Bucket: awsBucket,
                Key: uri + 'peaknumbers.json'
            },
            callback);
        }
    },
    function(err, results) {
        if(err) {
            if(err.code && err.code === "NoSuchKey"){
                return res.status(404).json({ error: "indices not found"});
            }
            else {
                return next(err);
            }
        }
        
        res.json({
            H: JSON.parse(results.H.Body),
            ACI: JSON.parse(results.ACI.Body),
            NP: JSON.parse(results.NP.Body),
        });
    });
});

router.post('/:soundscape/scale', function(req, res, next) {
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage soundscapes")){
        return res.json({ error: "you dont have permission to 'manage soundscapes'" });
    }
    model.soundscapes.setVisualizationOptions(req.soundscape, {
        max : req.body.max,
        palette : (req.body.palette | 0),
        normalized : !!req.body.normalized,
        amplitude : req.body.amplitude,
        amplitudeReference : req.body.amplitudeReference,
    }, function(err, soundscape){
        if(err){
            next(err);
        } else {
            res.json(soundscape && soundscape.pop());
        }
    });
});


router.get('/:soundscape/recordings/:bbox', function(req, res, next) {
    res.type('json');
    var soundscape = req.soundscape;
    var use_threshold = !!req.query.threshold;
    var filters = {
        ignore_offsets : true,
        minx : ((req.bbox.x1 - soundscape.min_t)) | 0,
        maxx : ((req.bbox.x2 - soundscape.min_t)) | 0,
        miny : ((req.bbox.y1 - soundscape.min_f) / soundscape.bin_size) | 0,
        maxy : ((req.bbox.y2 - soundscape.min_f) / soundscape.bin_size - 1) | 0
    };
    var just_count = req.query && req.query.count;
    q.resolve().then(function(){
        return model.soundscapes.fetchSCIDX(req.soundscape, filters);
    }).then(function(scidx){
        var options = use_threshold && {threshold:{
            value : soundscape.threshold,
            type : soundscape.threshold_type,
        }};
        if(just_count){
            res.json(scidx.count(options));
        } else {
            res.json(scidx.flatten(options));
        }
    }).catch(next);
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
    res.type('json');
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
    res.type('json');
    
    if(!req.haveAccess(req.project.project_id, "manage soundscapes"))
        return res.json({ error: "you dont have permission to 'manage soundscapes'" });
    
    var bbox = parse_bbox(req.body.bbox);
    model.soundscapes.addRegion(req.soundscape, {
        bbox : bbox,
        name : req.body.name,
        threshold: !!req.body.threshold,
    }, function(err, region){
        if(err){
            next(err);
        } else {
            res.json(region);
        }
    });
});

region_router.get('/:region', function(req, res, next) {
    res.type('json');
    res.json(req.region);
});

region_router.post('/:region/sample', function(req, res, next) {
    res.type('json');
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
    res.type('json');
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
    res.type('json');
    
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
    res.type('json');
    
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
