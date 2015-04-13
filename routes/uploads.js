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
    req.upload = {};
    
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
            projectId: req.query.project,
            siteId: req.query.site,
            nameFormat: req.query.nameformat,
        };
        
        next();
    }
    // verify token
    else if(req.token) {
        model.sites.findById(req.token.site, function(err, rows) {
            if(err) return next(err);
            if(!rows.length) return res.sendStatus(401);
            
            var site = rows[0];
            
            console.log(site);
            
            if(site.token_created_on !== req.token.iat) return res.sendStatus(401);
            
            req.upload = {
                userId: 0,
                projectId: req.token.project,
                siteId: req.token.site,
                nameFormat: "Arbimon",
            };
            
            next();
        });
    }
    else {
        // error not logged user nor site token
        return res.sendStatus(401);
    }
};

var receiveUpload = function(req, res, next) {
    
    async.parallel({
        getProjectInfo: function(callback) {
            model.projects.findById(req.upload.projectId, callback);
        },
        getTotal: function(callback) {
            model.projects.totalRecordings(req.upload.projectId, callback);
        }
    }, 
    function(err, results) {
        if(err) return next(err);
        
        var project = results.getProjectInfo[0][0];
        var total = results.getTotal[0][0].count;
        
        console.log('project', project.recording_limit);
        console.log('total', total);
        
        if(total >= project.recording_limit) {
            return res.status(401).json({ error: "Project Recording limit reached"});
        }
        
        var upload = {};
        var error = false;
        
        if(!req.busboy) return res.sendStatus(400);
        
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
                function checkExists(callback) {
                    model.recordings.exists({
                        site_id: req.upload.siteId,
                        filename: upload.FFI.filename
                    },
                    function(err, exists) {
                        if(err){ 
                            next(err);
                            return;
                        }
                        
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
                    console.log(upload);
                    
                    if(info.duration >= 3600) {
                        return res.status(403).json({ error: "recording is too long, please contact support" });
                    } else if(info.duration >= 120) {
                        audioTools.splitter(upload.path, info.duration, function(err, files) {
                            var i = 0;
                            async.eachSeries(files, function(f, callback) {
                                var uploadPart = _.cloneDeep(upload);
                                
                                uploadPart.FFI.filename = uploadPart.FFI.filename +'.p'+ (i+1);
                                
                                uploadPart.FFI.datetime.setMinutes(uploadPart.FFI.datetime.getMinutes()+i);
                                
                                uploadPart.name = uploadPart.FFI.filename + uploadPart.FFI.filetype;
                                uploadPart.path = f;
                                
                                console.log(uploadPart);
                                uploadQueue.push(_.cloneDeep(uploadPart));
                                
                                i++;
                                callback();
                            }, function() {
                                deleteFile(upload.path);
                                res.status(202).send("upload done!");
                            });
                        });
                    }
                    else {
                        uploadQueue.push(upload);
                        
                        res.status(202).send("upload done!");
                    }
                }
            ]);
            
        });
        
        req.pipe(req.busboy);
    });
};

router.post('/audio', authorize, receiveUpload);

module.exports = router;
