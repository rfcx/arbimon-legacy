var express = require('express');
var router = express.Router();
var model = require('../../../models');


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


/** Return a list of all the recordings in a project.
 */
router.get('/count/:recUrl?', function(req, res, next) {
    var recording_url = req.param('recUrl');
    model.recordings.findByUrlMatch(recording_url, req.project.project_id, {count_only:true}, function(err, count) {
        if(err) return next(err);
            
        res.json(count);
        return null;
    });
});

router.get('/available/:recUrl?', function(req, res, next) {
    var recording_url = req.param('recUrl');
    model.recordings.findByUrlMatch(recording_url, req.project.project_id, {count_only:true, group_by:'next', collapse_single_leaves:true}, function(err, count) {
        if(err) return next(err);
            
        res.json(count);
        return null;
    });
});


router.get('/:get/:oneRecUrl?', function(req, res, next) {
    var get       = req.param('get');
    var recording = req.recording;
    var and_return = {
        recording : function(err, recordings){
            if(err){ next(err); return; }
            res.json(recordings ? recordings[0] : null);
        },
        file : function(err, file){
            if(err || !file){ next(err); return; }
            res.sendFile(file.path);
        },
    };
    switch(get){
        case 'info'  :
            var url_comps = /(.*)\/([^/]+)\/([^/]+)/.exec(req.originalUrl);
            recording.audioUrl = url_comps[1] + "/audio/" + recording.id;
            recording.imageUrl = url_comps[1] + "/image/" + recording.id;
            model.recordings.fetchInfo(recording, function(err, recording){
                if(err){ next(err); return;}
                model.recordings.fetchValidations(recording, function(err, validations){
                    if(err){ next(err); return;}
                    recording.validations = validations;
                    res.json(recording);
                })
            });
        break;
        case 'audio' : model.recordings.fetchAudioFile(recording, and_return.file); break;
        case 'image' : model.recordings.fetchSpectrogramFile(recording, and_return.file); break;
        case 'thumbnail' : model.recordings.fetchThumbnailFile(recording, and_return.file); break;
        case 'find'      : and_return.recording(null, [recording]); break;
        case 'next'      : model.recordings.fetchNext(recording, and_return.recording); break;
        case 'previous'  : model.recordings.fetchPrevious(recording, and_return.recording); break;
        default:  next(); return;
    }
});

router.post('/validate/:oneRecUrl?', function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "validate species")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }

    var recording = req.recording;
    model.recordings.validate(recording, req.project.project_id, req.session.user.id, req.body, function(err, validation) {
        if(err) return next(err);
        return res.json(validation);
    });
});

router.get('/:recUrl?', function(req, res, next) {
    var recording_url = req.param('recUrl');
    model.recordings.findByUrlMatch(recording_url, req.project.project_id, {order:true}, function(err, rows) {
        if(err) return next(err);
            
        res.json(rows);
        return null;
    });
});


module.exports = router;