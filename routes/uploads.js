var debug = require('debug')('arbimon2:route:uploads');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var async = require('async');
var util = require('util');
var AWS = require('aws-sdk');


var model = require('../model');
var config = require('../config');
var audioTool = require('../utils/audiotool');
var tmpFileCache = require('../utils/tmpfilecache');
var formatParse = require('../utils/format-parse');

var s3 = new AWS.S3({ 
    httpOptions: {
        timeout: 30000,
    }
}); 


var processUpload = function(upload, cb) {
    
    var file = upload.file;
    debug("processUpload:", file.filename);
    
    var fileInfo = upload.fileInfo;
    var siteId = upload.site_id;
    
    var recTime = new Date(fileInfo.year, (fileInfo.month-1), fileInfo.date, fileInfo.hour, fileInfo.min);
    var inFile = file.path;
    var tempFile = tmpFileCache.key2File(fileInfo.filename + '.temp.flac');
    var outFile = tmpFileCache.key2File(fileInfo.filename + '.flac');
    var thumbnail = tmpFileCache.key2File(fileInfo.filename + '.thumbnail.png');
    var extension = fileInfo.filetype;
    
    var uri = util.format('project_%d/site_%d/%d/%d/%s', 
        upload.project_id,
        siteId,
        fileInfo.year,
        fileInfo.month,
        fileInfo.filename
    );
    
    var fileUri = uri + '.flac';
    var thumbnailUri = uri + '.thumbnail.png';
    
    debug('fileURI:', fileUri);
    
    async.auto({
        insertUploadRecs: function(callback) {
            model.uploads.insertRecToList({
                filename: file.filename,
                project_id: upload.project_id,
                site_id: siteId,
                user_id: upload.user_id,
            }, 
            callback);
        },
        
        convertToMono : ['insertUploadRecs', function(callback) {
                
            debug('convert to mono:', file.filename);
                        
            audioTool.sox([inFile, '-c', 1, tempFile], function(code, stdout, stderr) {
                if(code !== 0)
                    return callback(new Error("error converting to mono: \n" + stderr));
                
                callback(null, code);
            });
        }],
        
        transcodeToFlac: ['convertToMono', function(callback) {
            if(extension === "flac") {
                outFile = tempFile;
                return callback(null, 0);
            }
                
            debug('transcode to flac:', file.filename);
            
            audioTool.transcode(tempFile, outFile, { format: 'flac' }, 
                function(code, stdout, stderr) {
                    if(code !== 0)
                        return callback(new Error("error transcoding to flac: \n" + stderr));
                    
                    callback(null, code);
                }
            );
        }],
        
        genThumbnail: ['convertToMono', function(callback) {
            
            debug('gen thumbnail:', file.filename);
            
            audioTool.spectrogram(tempFile, thumbnail, 
                { 
                    maxfreq : 15000,
                    pixPerSec : (7),
                    height : (153)
                },  
                function(code, stdout, stderr){
                    if(code !== 0)
                        return callback(new Error("error generating spectrogram: \n" + stderr));
                        
                    callback(null, code);
                }
            );
        }],
        
        uploadFlac: ['transcodeToFlac', async.retry(function(callback, results) {
            debug('uploadFlac:', file.filename);
            
            var params = { 
                Bucket: config('aws').bucketName, 
                Key: fileUri,
                ACL: 'public-read',
                Body: fs.createReadStream(outFile)
            };

            s3.putObject(params, function(err, data) {
                if (err)       
                    return callback(err);
                    
                debug("Successfully uploaded flac", fileInfo.filename);
                callback(null, data);
            });

        })],
        
        uploadThumbnail: ['genThumbnail', async.retry(function(callback, results) {
            debug('uploadThumbnail:', file.filename);
            
            var params = { 
                Bucket: config('aws').bucketName, 
                Key: thumbnailUri,
                ACL: 'public-read',
                Body: fs.createReadStream(thumbnail)
            };

            s3.putObject(params, function(err, data) {
                if (err)       
                    return callback(err);
                    
                debug("Successfully uploaded thumbnail:", fileInfo.filename);
                callback(null, data);
            });

        })],
        
        insertOnDB: ['uploadFlac', 'uploadThumbnail', function(callback, results) {
            debug("inserting to DB", file.filename);
            
            model.recordings.insert({
                site_id: siteId,
                uri: fileUri,
                datetime: recTime,
                mic: upload.info.mic,
                recorder: upload.info.recorder,
                version: upload.info.sver
            },
            callback);
        }]
    },
    function(err, results) {
        // delete temp files
        deleteFile(inFile);
        deleteFile(tempFile);
        deleteFile(thumbnail);
        
        if(extension !== 'flac') {
            deleteFile(outFile);
        }
        
        if(results.insertUploadRecs && 
            results.insertUploadRecs[0] && 
            results.insertUploadRecs[0].insertId) {
            
                model.uploads.removeFromList(results.insertUploadRecs[0].insertId, function(e) {
                    if(e) console.error(e);
                });
        }
        
        if(err) return cb(err);
        
        debug('process upload results:');
        debug(results);
        
        console.log('done processing %s for site %s', file.filename, siteId);
    });
};

var deleteFile = function(filename) {
    fs.unlink(filename, function(err) {
        if(err) console.error("failed to delete: %s", filename);
    });
};

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
        
        var project = results.getProjectInfo[0];
        var total = results.getTotal[0].count;
        
        if(total >= project.recording_limit) {
            file.resume();
            return res.status(401).send("Project Recording limit reached");
        }
        
        var info;
        var fileUploaded;
        var fileInfo;
        var error = false;
        
        if(!req.busboy) return res.sendStatus(400);
        
        req.busboy.on('field', function(fieldname, val) {
            debug('field %s = %s', fieldname, val);
            
            if(fieldname === 'info') {
                try {
                    info = JSON.parse(val);
                }
                catch(err) {
                    error = true;
                    err.status =  400;
                    return next(err);
                }
            }
        });
        
        req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            debug('file fieldname: %s | filename: %s', fieldname, filename);
            
            try {
                fileInfo = formatParse(req.upload.nameFormat, filename);
            } 
            catch(e) {
                file.resume();
                error = true;
                return res.status(400).json({ error: e.message });
            }
            
            var saveTo = tmpFileCache.key2File(filename);
            file.pipe(fs.createWriteStream(saveTo));
            
            fileUploaded = { 
                filename: filename,
                path: saveTo
            };

        
        });
        
        req.busboy.on('finish', function() {
            if(error) return;
            
            if(!info || !fileUploaded) return res.sendStatus(400);
            
            debug('info: ', info);
            debug('fileUploaded: ', fileUploaded);
            
            model.recordings.exists({
                site_id: req.upload.siteId,
                filename: fileInfo.filename
            },
            function(err, exists) {
                if(err) next(err);
                
                if(exists) {
                    deleteFile(fileUploaded.path);
                    var msg = "filename "+ fileInfo.filename +
                              " already exists on site " + req.upload.siteId;
                    return res.status(403).send(msg);
                }
                
                processUpload({ 
                    info: info,
                    file: fileUploaded,
                    fileInfo: fileInfo,
                    project_id: req.upload.projectId,
                    site_id: req.upload.siteId,
                    user_id: req.upload.userId,
                });
                
                
                res.status(202).send("upload done!");
            });
        });
        
        req.pipe(req.busboy);
    });
};

router.post('/audio', authorize, receiveUpload);

module.exports = router;
