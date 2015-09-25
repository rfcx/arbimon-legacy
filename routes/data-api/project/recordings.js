var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');

var model = require('../../../model');


router.get('/exists/site/:siteid/file/:filename', function(req, res, next) {
    var site_id = req.params.siteid;
    var filename = req.params.filename;
    
    model.recordings.exists(
        {
            site_id: site_id,
            filename: filename
        },
        function(err, result) {
            if(err)
                next(err);
            
            res.json({ exists: result });
        }
    );
});

router.get('/search', function(req, res, next) {
    var params = req.query;
    
    params.project_id = req.project.project_id;
    
    model.recordings.findProjectRecordings(params, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/count', function(req, res, next) {
    model.projects.totalRecordings(req.project.project_id, function(err, rows) {
        if(err) return next(err);
            
        res.json({ count: rows[0].count });
    });
});

router.get('/:recUrl?', function(req, res, next) {
    var recordingUrl = req.params.recUrl;
    
    model.recordings.findByUrlMatch(
        recordingUrl, 
        req.project.project_id, 
        {
            order: true,
            compute: req.query && req.query.show
        }, 
        function(err, rows) {
            if (err) return next(err);

            res.json(rows);
            return null;
        }
    );
});

router.get('/count/:recUrl?', function(req, res, next) {
    var recordingUrl = req.params.recUrl;
    
    model.recordings.findByUrlMatch(recordingUrl, req.project.project_id, { count_only:true }, function(err, count) {
        if(err) return next(err);
            
        res.json(count);
        return null;
    });
});

router.get('/available/:recUrl?', function(req, res, next) {
    var recordingUrl = req.params.recUrl;
    model.recordings.findByUrlMatch(
        recordingUrl, 
        req.project.project_id, 
        { 
            count_only:true, 
            group_by:'next', 
            collapse_single_leaves:true
        }, 
        function(err, count) {
            if(err) return next(err);
                
            res.json(count);
            return null;
        }
    );
});

router.param('oneRecUrl', function(req, res, next, recording_url){
    model.recordings.findByUrlMatch(recording_url, req.project.project_id, {limit:1}, function(err, recordings) {
        if(err){
            return next(err);
        }
        if(!recordings.length){
            return res.status(404).json({ error: "recording not found"});
        }
        req.recording = recordings[0];
        return next();
    });
});

router.get('/tiles/:oneRecUrl/:i/:j', function(req, res, next) {
    var i = req.params.i | 0;
    var j = req.params.j | 0;
    
    model.recordings.fetchOneSpectrogramTile(req.recording, i, j, function(err, file){
        if(err || !file){ next(err); return; }
        res.sendFile(file.path);
    });
});

router.get('/:get/:oneRecUrl?', function(req, res, next) {
    var get       = req.params.get;
    var recording = req.recording;
    
    var and_return = {
        recording : function(err, recordings){
            if(err) return next(err); 
            
            res.json(recordings instanceof Array ? recordings[0] : recordings);
        },
        file : function(err, file){
            if(err || !file) return next(err);
            
            res.sendFile(file.path);
        },
    };
    
    switch(get){
        case 'info'  :
            var url_comps = /(.*)\/([^/]+)\/([^/]+)/.exec(req.originalUrl);
            recording.audioUrl = url_comps[1] + "/audio/" + recording.id;
            recording.imageUrl = url_comps[1] + "/image/" + recording.id;
            model.recordings.fetchValidations(recording, function(err, validations){
                if(err) return next(err);
                
                recording.validations = validations;
                
                model.recordings.fetchInfo(recording, function(err, rec){
                    if(err) return next(err);
                    
                    model.recordings.fetchSpectrogramTiles(rec, function(err, rec){
                        if(err) return next(err);
                        
                        res.json(rec);
                    }); 
                });
            });
        break;
        case 'audio'     : model.recordings.fetchAudioFile(recording, req.query, and_return.file); break;
        case 'image'     : model.recordings.fetchSpectrogramFile(recording, and_return.file); break;
        case 'thumbnail' : model.recordings.fetchThumbnailFile(recording, and_return.file); break;
        case 'find'      : and_return.recording(null, [recording]); break;
        case 'tiles'     : model.recordings.fetchSpectrogramTiles(recording, and_return.recording); break;
        case 'next'      : model.recordings.fetchNext(recording, and_return.recording); break;
        case 'previous'  : model.recordings.fetchPrevious(recording, and_return.recording); break;
        default:  next(); return;
    }
});

router.post('/validate/:oneRecUrl?', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "validate species")) {
        return res.json({ error: "you dont have permission to validate species" });
    }

    model.recordings.validate(req.recording, req.session.user.id, req.project.project_id, req.body, function(err, validations) {
        if(err) return next(err);
        return res.json(validations);
    });
});

router.post('/delete', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to manage project recordings" });
    }
    
    if(!req.body.recs) {
        return res.json({ error: 'missing arguments' });
    }
    
    model.recordings.delete(req.body.recs, req.project.project_id, function(err, result) {
        if(err) return next(err);
        
        res.json(result);
    });
});

module.exports = router;
