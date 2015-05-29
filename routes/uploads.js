var fs = require('fs');
var debug = require('debug')('arbimon2:route:uploads');
var express = require('express');
var router = express.Router();
var async = require('async');
var util = require('util');
var _ = require('lodash');


var model = require('../model');
var audioTools= require('../utils/audiotool');
var tmpFileCache = require('../utils/tmpfilecache');
var formatParse = require('../utils/format-parse');
var uploadQueue = require('../utils/upload-queue');

var deleteFile = function(filename) {
    fs.unlink(filename, function(err) {
        if(err) console.error("failed to delete: %s", filename);
    });
};

// middleware to handle upload auth
var authorize = function(req, res, next) {
    if(req.session && req.session.loggedIn) { 
        if(!req.query.project || !req.query.site || !req.query.nameformat) {
            return res.status(400).json({ error: "missing parameters" });
        }
        
        debug('project_id: %s | site_id: %s |format: %s', 
            req.query.project, 
            req.query.site, 
            req.query.nameformat
        );
        
        var perm = "manage project recordings";
        
        if(!req.haveAccess(req.query.project, perm)) {
            res.status(401).json({ 
                error: "you dont have permission to '"+ perm +"'"
            });
            return;
        }
        
        req.upload = {
            userId: req.session.user.id,
            projectId: Number(req.query.project),
            siteId: Number(req.query.site),
            nameFormat: req.query.nameformat,
        };
        
        next();
    }
    
    // verify token
    else if(req.token) {
        
        req.upload = {
            userId: 0,
            projectId: Number(req.token.project),
            siteId: Number(req.token.site),
            nameFormat: "Arbimon",
        };
        
        next();
    }
    else {
        // error not logged user nor site token
        return res.sendStatus(401);
    }
};

var verifySite = function(req, res, next) {
    model.sites.findById(req.upload.siteId, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) {
            return res.status(403).json({ error: "site does not exist" });
        }
        
        var site = rows[0];
        
        // verify token is valid to the system
        if(req.token && (site.token_created_on !== req.token.iat)) {
            return res.status(400).json({ error: "can not use revoked token" });
        }
        
        if(site.project_id !== req.upload.projectId) {
            return res.status(403).json({ error: "site does not belong to project"});
        }
        
        next();
    });
};

var receiveUpload = function(req, res, next) {
    
    async.parallel({
        getProjectInfo: function(callback) {
            model.projects.findById(req.upload.projectId, callback);
        },
        getUsage: function(callback) {
            model.projects.getStorageUsage(req.upload.projectId, callback);
        }
    }, 
    function(err, results) {
        if(err) return next(err);
        
        var project = results.getProjectInfo[0][0];
        var minsUsage = results.getUsage[0][0].min_usage;
        
        debug('limit', project.recording_limit);
        debug('usage', minsUsage);
        
        if(minsUsage >= project.recording_limit) {
            return res.status(401).json({ error: "Project Recording limit reached"});
        }
        
        var upload = {};
        var error = false;
        
        if(!req.busboy) return res.status(400).json({ error: "no data" });
        
        req.busboy.on('field', function(fieldname, val) {
            debug('field %s = %s', fieldname, val);
            
            if(fieldname === 'info') {
                try {
                    upload.metadata = JSON.parse(val);
                }
                catch(err) {
                    error = true;
                    return res.status(400).json({ error: err.message });
                }
                
                var notValid = !upload.metadata.recorder || 
                                !upload.metadata.sver ||
                                !upload.metadata.mic;
                    
                if(notValid && !error) {
                    error = true;
                    return res.status(400).json({ error: "missing basic metadata" });
                }
            }
        });
        
        req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            debug('file fieldname: %s | filename: %s', fieldname, filename);
            
            // FFI -> filename format info
            try {
                upload.FFI = formatParse(req.upload.nameFormat, filename);
            } 
            catch(e) {
                file.resume();
                error = true;
                return res.status(400).json({ error: e.message });
            }
            
            var saveTo = tmpFileCache.key2File(Date.now()+filename);
            //                                 ^__ concat now() to prevent collitions
            file.pipe(fs.createWriteStream(saveTo));
            
            upload.name = filename;
            upload.path = saveTo;
            
        });
        
        req.busboy.on('finish', function() {
            if(error) return;
            
            if(!upload.metadata || !upload.name || !upload.path) {
                return res.status(400).json({ error: "form data not complete"});
            }
            
            debug('metadata: ', upload.metadata);
            debug('filename: ', upload.name);
            
            async.waterfall([
                function recNotExists(callback) {
                    model.recordings.exists({
                        site_id: req.upload.siteId,
                        filename: upload.FFI.filename
                    },
                    function(err, exists) {
                        if(err) return next(err);
                        
                        if(exists) {
                            deleteFile(upload.path);
                            var msg = "filename "+ upload.FFI.filename +
                                      " already exists on site " + req.upload.siteId;
                            return res.status(403).json({ error: msg });
                        }
                        
                        callback();
                    });
                },
                function getAudioInfo(callback) {
                    audioTools.info(upload.path, function(code, info) {
                        if(code !== 0) {
                            deleteFile(upload.path);
                            return res.status(500).json({ error: "error getting audio file info" });
                        }
                        
                        callback(null, info);
                    });
                },
                function sendToProcess(info, callback) {
                    
                    upload.projectId = req.upload.projectId;
                    upload.siteId = req.upload.siteId;
                    upload.userId = req.upload.userId;
                    upload.info = info;
                    
                    if(info.duration >= 3600) {
                        deleteFile(upload.path);
                        return res.status(403).json({ error: "Recording is too long, please contact support" });
                    }
                    
                    debug('new usage', (info.duration/60)+minsUsage);
                    
                    if((info.duration/60)+minsUsage > project.recording_limit) {
                        deleteFile(upload.path);
                        var msg = "Recording is too long, there is only " + Math.round((project.recording_limit-minsUsage)*100)/100 +
                            " minutes of space left";
                        return res.status(401).json({ error: msg });
                    }
                    
                    if(info.duration > 120) {
                        audioTools.splitter(upload.path, info.duration, function(err, files) {
                            if(err) return next(err);
                            
                            var i = 0;
                            async.eachSeries(files, function(f, nextUpload) {
                                var uploadPart = _.cloneDeep(upload);
                                
                                uploadPart.FFI.filename = uploadPart.FFI.filename +'.p'+ (i+1);
                                
                                uploadPart.FFI.datetime.setMinutes(uploadPart.FFI.datetime.getMinutes()+i);
                                
                                uploadPart.name = uploadPart.FFI.filename + uploadPart.FFI.filetype;
                                uploadPart.path = f;
                                
                                debug('upload', uploadPart);
                                uploadQueue.enqueue(_.cloneDeep(uploadPart), function(err) {
                                    if(err) return nextUpload(err);
                                    
                                    i++;
                                    nextUpload();
                                });
                            }, function splitDone(err2) {
                                if(err2) return next(err2);
                                
                                deleteFile(upload.path);
                                res.status(202).json({ success: "upload done!" });
                            });
                        });
                    }
                    else {
                        debug('upload', upload);
                        uploadQueue.enqueue(upload, function(err) {
                            if(err) return next(err);
                            
                            res.status(202).json({ success: "upload done!" });
                        });
                    }
                }
            ]);
            
        });
        
        req.pipe(req.busboy);
    });
};

router.post('/audio', authorize, verifySite, receiveUpload);

module.exports = router;
