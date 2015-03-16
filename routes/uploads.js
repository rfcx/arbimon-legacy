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

var deleteFile = function(filename) {
    fs.unlink(filename, function(err) {
        if(err) console.error("failed to delete: %s", filename);
    });
};
/**
Process recordings uploaded to the system

@method processUpload
@param upload {Object} - 
    {
        metadata: { 
            recorder: 'recorder model', 
            mic: 'microphone model', 
            sver: 'software version' 
        },
        FFI: fileformat info object return by utils/formatParse()
        name: 'original filename',
        path: 'path uploaded file',
        projectId: PROJECT ID,
        siteId: SITE ID,
        userId: USER ID
    }
 
**/
var processUpload = function(upload, done) {
    
    debug("processUpload:", upload.name);
    
    var recTime = new Date(upload.FFI.year, (upload.FFI.month-1), upload.FFI.date, upload.FFI.hour, upload.FFI.min);
    var inFile = upload.path;
    var tempFile = tmpFileCache.key2File(upload.FFI.filename + '.temp.flac');
    var outFile = tmpFileCache.key2File(upload.FFI.filename + '.flac');
    var thumbnail = tmpFileCache.key2File(upload.FFI.filename + '.thumbnail.png');
    var extension = upload.FFI.filetype;
    
    var uri = util.format('project_%d/site_%d/%d/%d/%s', 
        upload.projectId,
        upload.siteId,
        upload.FFI.year,
        upload.FFI.month,
        upload.FFI.filename
    );
    
    var fileUri = uri + '.flac';
    var thumbnailUri = uri + '.thumbnail.png';
    
    debug('fileURI:', fileUri);
    
    async.auto({
        insertUploadRecs: function(callback) {
            model.uploads.insertRecToList({
                filename: upload.name,
                project_id: upload.projectId,
                site_id: upload.siteId,
                user_id: upload.user_id,
            }, 
            callback);
        },
        
        convertToMono : ['insertUploadRecs', function(callback) {
                
            debug('convert to mono:', upload.name);
                        
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
                
            debug('transcode to flac:', upload.name);
            
            audioTool.transcode(tempFile, outFile, { format: 'flac' }, 
                function(code, stdout, stderr) {
                    if(code !== 0)
                        return callback(new Error("error transcoding to flac: \n" + stderr));
                    
                    callback(null, code);
                }
            );
        }],
        
        genThumbnail: ['convertToMono', function(callback) {
            
            debug('gen thumbnail:', upload.name);
            
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
            debug('uploadFlac:', upload.name);
            
            var params = { 
                Bucket: config('aws').bucketName, 
                Key: fileUri,
                ACL: 'public-read',
                Body: fs.createReadStream(outFile)
            };

            s3.putObject(params, function(err, data) {
                if (err)       
                    return callback(err);
                    
                debug("Successfully uploaded flac", upload.FFI.filename);
                callback(null, data);
            });

        })],
        
        uploadThumbnail: ['genThumbnail', async.retry(function(callback, results) {
            debug('uploadThumbnail:', upload.name);
            
            var params = { 
                Bucket: config('aws').bucketName, 
                Key: thumbnailUri,
                ACL: 'public-read',
                Body: fs.createReadStream(thumbnail)
            };

            s3.putObject(params, function(err, data) {
                if (err)       
                    return callback(err);
                    
                debug("Successfully uploaded thumbnail:", upload.FFI.filename);
                callback(null, data);
            });

        })],
        
        insertOnDB: ['uploadFlac', 'uploadThumbnail', function(callback, results) {
            debug("inserting to DB", upload.name);
            
            model.recordings.insert({
                site_id: upload.siteId,
                uri: fileUri,
                datetime: recTime,
                mic: upload.metadata.mic,
                recorder: upload.metadata.recorder,
                version: upload.metadata.sver
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
        
        if(err) {
            console.error(err);
            return done(err);
        }
        
        debug('process upload results:');
        debug(results);
        
        console.log('done processing %s for site %s', upload.name, upload.siteId);
        done();
    });
};

// uploadQueue process  1 recording at a time per server instance
var uploadQueue = async.queue(processUpload, 1); 

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
            
            var saveTo = tmpFileCache.key2File(filename);
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
            
            model.recordings.exists({
                site_id: req.upload.siteId,
                filename: upload.FFI.filename
            },
            function(err, exists) {
                if(err) next(err);
                
                if(exists) {
                    deleteFile(upload.path);
                    var msg = "filename "+ upload.FFI.filename +
                              " already exists on site " + req.upload.siteId;
                    return res.status(403).json({ error: msg });
                }
                
                upload.projectId = req.upload.projectId;
                upload.siteId = req.upload.siteId;
                upload.userId = req.upload.userId;
                console.log(upload);
                uploadQueue.push(upload);
                
                res.status(202).send("upload done!");
            });
        });
        
        req.pipe(req.busboy);
    });
};

router.post('/audio', authorize, receiveUpload);

module.exports = router;
