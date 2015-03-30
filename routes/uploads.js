var debug = require('debug')('arbimon2:route:uploads');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var async = require('async');
var util = require('util');
var AWS = require('aws-sdk');
var _ = require('lodash');


var model = require('../model');
var config = require('../config');
var audioTools= require('../utils/audiotool');
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

/** Process recordings uploaded to the system
 * @method processUpload
 * @param upload {Object} object containing upload info
 * @param upload.metadata {Object} recording metadata
 * @param upload.metadata.recorder {String} recorder model
 * @param upload.metadata.mic {String} microphone model used in the recorder
 * @param upload.metadata.sver {String} recorder's software version
 * @param upload.FFI {String} fileformat info object returned by utils/formatParse()
 * @param upload.name {String} original filename
 * @param upload.path {String} path uploaded file
 * @param upload.projectId {String} project id
 * @param upload.siteId {String} site id
 * @param upload.userId {String} user id
 **/
var processUpload = function(upload, done) {
    var start = new Date();
    debug("processUpload:", upload.name);
    
    var recTime = upload.FFI.datetime;
    var inFile = upload.path;
    var outFile = tmpFileCache.key2File(upload.FFI.filename + '.out.flac');
    var thumbnail = tmpFileCache.key2File(upload.FFI.filename + '.thumbnail.png');
    
    var uri = util.format('project_%d/site_%d/%d/%d/%s', 
        upload.projectId,
        upload.siteId,
        upload.FFI.datetime.getFullYear(),
        upload.FFI.datetime.getMonth()+1,
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
        
        convertMonoFlac: ['insertUploadRecs', function(callback) {
            debug('convertMonoFlac:', upload.name);
            var needConvert = false;
            
            args = [inFile];
            
            if(upload.info.channels > 1) {
                needConvert = true;
                args.push('-c', 1);
            }
            if(upload.FFI.filetype !== ".flac") {
                needConvert = true;
                args.push('-t', 'flac');
            }
            
            args.push(outFile);
            
            if(!needConvert) {
                outFile = inFile;
                return callback(null, 'did not process');
            }
            
            audioTools.sox(args, function(code, stdout, stderr) {
                if(code !== 0)
                    return callback(new Error("error converting to mono and/or to flac: \n" + stderr));
                
                callback(null, code);
            });
        }],
        
        // update audio file info after conversion
        updateAudioInfo: ['convertMonoFlac', function(callback) {
            debug('updateAudioInfo:', upload.name);
            audioTools.info(outFile, function(code, info) {
                if(code !== 0) {
                    return callback(new Error("error getting audio file info"));
                }
                
                upload.info = info;
                callback();
            });
        }],
        
        genThumbnail: ['updateAudioInfo', function(callback) {
            debug('gen thumbnail:', upload.name);
            
            audioTools.spectrogram(outFile, thumbnail, 
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
        
        uploadFlac: ['updateAudioInfo', async.retry(function(callback, results) {
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
                version: upload.metadata.sver,
                sample_rate: upload.info.sample_rate,
                precision: upload.info.precision,
                duration: upload.info.duration,
                samples: upload.info.samples,
                file_size: upload.info.file_size,
                bit_rate: upload.info.bit_rate,
                sample_encoding: upload.info.sample_encoding
            },
            callback);
        }]
    },
    function(err, results) {
        // delete temp files
        deleteFile(thumbnail);
        deleteFile(inFile);
        if(outFile !== inFile) deleteFile(outFile);
        
        // remove from uploads_processing table
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
        console.log('elapse:', ((new Date()) - start)/1000 + 's');
        done();
    });
};

// uploadQueue process  1 recording at a time per server instance
var uploadQueue = async.queue(processUpload, 1); 
uploadQueue.drain = function() {
    console.log('done processing uploads on queue');
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
