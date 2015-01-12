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

var s3 = new AWS.S3(); 


var processUpload = function(upload, cb) {
    
    var file = upload.file;
    var fileInfo = upload.fileInfo;
    
    debug("processUpload:", file.filename);
    
    var siteId = upload.info.site.id;
    
    var name = file.filename.split('.');
    var extension = name[name.length-1];
    
    var recTime = new Date(fileInfo.year, --fileInfo.month, fileInfo.date, fileInfo.hour, fileInfo.min);
    var inFile = file.path;
    var outFile = tmpFileCache.key2File(fileInfo.filename + '.flac');
    var thumbnail = tmpFileCache.key2File(fileInfo.filename + '.thumbnail.png');

    var fileURI = util.format('project_%d/site_%d/%d/%d/%s', 
        upload.project_id,
        siteId,
        fileInfo.year,
        fileInfo.month,
        fileInfo.filename
    );
    
    debug('fileURI:', fileURI);
    
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
        
        convert: ['insertUploadRecs', function(callback) {
            if(extension === "flac") 
                return callback(null, 0);
                
            debug('convert to flac:', file.filename);
            
            audioTool.transcode(inFile, outFile, { format: 'flac' }, 
                function(code, stdout, stderr) {
                    if(code !== 0)
                        return callback(new Error("error transcoding: \n" + stderr));
                    
                    callback(null, code);
                }
            );
        }],
        
        thumbnail: ['insertUploadRecs', function(callback) {
            
            debug('gen thumbnail:', file.filename);
            
            audioTool.spectrogram(inFile, thumbnail, 
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
        
        uploadFlac: ['convert', function(callback, results) {
            debug('uploadFlac:', file.filename);
            
            var params = { 
                Bucket: config('aws').bucketName, 
                Key: fileURI + '.flac',
                ACL: 'public-read',
                Body: fs.createReadStream(outFile)
            };

            s3.putObject(params, function(err, data) {
                if (err)       
                    return callback(err);
                    
                debug("Successfully uploaded flac", fileInfo.filename);
                callback(null, data);
            });

        }],
        
        uploadThumbnail: ['thumbnail', function(callback, results) {
            debug('uploadThumbnail:', file.filename);
            
            var params = { 
                Bucket: config('aws').bucketName, 
                Key: fileURI + '.thumbnail.png',
                ACL: 'public-read',
                Body: fs.createReadStream(thumbnail)
            };

            s3.putObject(params, function(err, data) {
                if (err)       
                    return callback(err);
                    
                debug("Successfully uploaded thumbnail:", fileInfo.filename);
                callback(null, data);
            });

        }],
        
        insertOnDB: ['uploadFlac', 'uploadThumbnail', function(callback, results) {
            debug("inserting to DB", file.filename);
            
            model.recordings.insert({
                site_id: siteId,
                uri: fileURI + '.flac',
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
        deleteFile(thumbnail);
        
        if(extension !== 'flac') {
            deleteFile(outFile);
        }
        
        if(results.insertUploadRecs) {
            model.uploads.removeFromList(results.insertUploadRecs[0].insertId, function(e) {
                if(e) console.error(e);
            });
        }
        
        if(err) return cb(err);
        
        debug('process upload results:');
        debug(results);
        
        cb(null, file.filename);
    });
};

var deleteFile = function(filename) {
    fs.exists(filename, function (exists) {
        if(exists)
            fs.unlinkSync(filename);
    });
};


// routes

router.post('/audio/project/:projectid', function(req, res, next) {
    
    var project_id = req.param('projectid');
    
    var perm = "manage project recordings";
    
    if(!req.haveAccess(project_id, perm)) {
        return res.status(401).json({ error: "you dont have permission to '"+ perm +"'" });
    }
    
    var info;
    var fileUploaded;
    
    req.busboy.on('field', function(fieldname, val) {
        if(fieldname === 'info') {
            try {
                info = JSON.parse(val);
            }
            catch(err) {
                err.status =  400;
                return next(err);
            }
        }
    });
    
    req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
        
        async.parallel({
            getProjectInfo: function(callback) {
                model.projects.findById(project_id, callback);
            },
            getTotal: function(callback) {
                model.projects.totalRecordings(project_id, callback);
            }
        }, 
        function(err, results) {
            if(err) return next(err);
            
            var project = results.getProjectInfo[0];
            var total = results.getTotal[0].count;
            
            if(total >= project.recording_limit) {
                return res.status(401).send("Project Recording limit reached");
            }
            
            var saveTo = tmpFileCache.key2File(filename);
            file.pipe(fs.createWriteStream(saveTo));
            
            fileUploaded = { 
                filename: filename,
                path: saveTo
            };
        });
    
    });
    
    req.busboy.on('finish', function() {
        
        debug('info: ', info);
        debug('fileUploaded: ', fileUploaded);
        
                
        var fileInfo;
        try {
            fileInfo = formatParse(info.format, fileUploaded.filename);
        } 
        catch(e) {
            return next(fileInfo);
        }
        
        model.recordings.exists({
            site_id: info.site.id,
            filename: fileInfo.filename
        },
        function(err, exists) {
            if(err) next(err);
            
            if(exists) {
                var msg = "filename "+ fileInfo.filename +
                          " already exists on site " + info.site.id;
                return res.status(403).send(msg);
            }
            
            res.status(202).send("upload done!");

            processUpload({ 
                info: info,
                file: fileUploaded,
                fileInfo: fileInfo,
                project_id: project_id,
                user_id: req.session.user.id
            }, 
            function(err, file){
                if(err) return console.error(file.filename, err);
                
                console.log(file.filename, 'processed successfully');
            });
            
        });
    });
    
    req.pipe(req.busboy);
});


module.exports = router;
