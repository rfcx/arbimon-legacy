var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var async = require('async');
var util = require('util');


var model = require('../models');
var jobQueue = require('../utils/jobqueue');
var config = require('../config');
var audioTool = require('../utils/audiotool');
var tmpFileCache = require('../utils/tmpfilecache');
var formatParse = require('../utils/format-parse');

var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config/aws.json');
var s3 = new AWS.S3(); 


router.get('/audio', function(req, res) {
    res.sendStatus(200);
});
    
router.post('/audio/project/:projectid', function(req, res) {
    
    var project_id = req.param('projectid');
    
    var perm = "manage project recordings";
    
    if(!req.haveAccess(project_id, perm)) {
        return res.json({ error: "you dont have permission to '"+ perm +"'" });
    }
    
    var fields = {};
    var files = [];
    
    req.busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
        fields[fieldname] = val;
    });
    
    req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
        var saveTo = tmpFileCache.key2File(filename);
        file.pipe(fs.createWriteStream(saveTo));
        
        files.push({ 
            filename: filename,
            path: saveTo
        });
    });
    
    req.busboy.on('finish', function() {
        //~ console.log('fields:', fields);
        //~ console.log('files:', files);
        
        res.send("Done!");
        
        fields.project = JSON.parse(fields.project);
        fields.info = JSON.parse(fields.info);
        
        files.forEach(function(file) {
            
            jobQueue.push({ 
                name: "process: " + file.filename,
                work: function(cb) {
                    var name = file.filename.split('.');
                    var extension = name[name.length-1];
                    
                   
                    var fileInfo = formatParse(fields.info.format, file.filename);
                    var recTime = new Date(fileInfo.year, --fileInfo.month, fileInfo.date, fileInfo.hour, fileInfo.min);
                    var inFile = file.path;
                    var outFile = tmpFileCache.key2File(fileInfo.filename + '.flac');
                    var thumbnail = tmpFileCache.key2File(fileInfo.filename + '.thumbnail.png');

                    var fileKey = util.format('project_%d/site_%d/%d/%d/%s', 
                        fields.project.project_id,
                        fields.info.site.id,
                        fileInfo.year,
                        fileInfo.month,
                        fileInfo.filename
                    );
                    
                    console.log('fileKey:', fileKey);
                    
                    async.auto({
                        convert: function(callback) {
                            console.log('convert');
                            if(extension === "flac")
                                return callback(null, 0);
                                
                            audioTool.transcode(inFile, outFile, { format: 'flac' }, 
                                function(code, stdout, stderr) {
                                    callback(null, code);
                                }
                            );
                        },
                        
                        thumbnail: function(callback) {
                            console.log('thumbnail');
                             audioTool.spectrogram(inFile, thumbnail, 
                                { 
                                    maxfreq : 15000,
                                    pixPerSec : (7),
                                    height : (153)
                                },  
                                function(code){                            
                                    callback(null, code);
                                }
                            );
                        },
                        
                        uploadFlac: ['convert', function(callback, results) {
                            console.log('uploadFlac');
                            
                            if(results.convert)
                                throw new Error("error processing");
                            
                            var params = { 
                                Bucket: 'arbimon2', 
                                Key: fileKey + '.flac',
                                ACL: 'public-read',
                                Body: fs.createReadStream(outFile)
                            };

                            s3.putObject(params, function(err, data) {
                                if (err)       
                                    return console.log(err)     
                                    
                                console.log("Successfully uploaded flac", fileInfo.filename);
                                callback(null, data);
                            });

                        }],
                        
                        uploadThumbnail: ['thumbnail', function(callback, results) {
                            console.log('uploadThumbnail');
                            
                            if(results.thumbnail)
                                throw new Error("error creating thumbnail");
                            
                            var params = { 
                                Bucket: 'arbimon2', 
                                Key: fileKey + '.thumbnail.png',
                                ACL: 'public-read',
                                Body: fs.createReadStream(thumbnail)
                            };

                            s3.putObject(params, function(err, data) {
                                if (err)       
                                    return console.log(err)     
                                    
                                console.log("Successfully uploaded thumbnail", fileInfo.filename);
                                callback(null, data);
                            });

                        }],
                        
                        insertOnDB: ['uploadFlac', 'uploadThumbnail', function(callback, results) {
                                                
                            model.recordings.insert({
                                site_id: fields.info.site.id,
                                uri: fileKey + '.flac',
                                datetime: recTime,
                                mic: fields.info.mic,
                                recorder: fields.info.recorder,
                                version: fields.info.sver
                            },
                            function(err, result) {
                                callback(err, result);
                            });
                        }]
                    },
                    function(err, results) {
                        // delete temp files
                        fs.unlinkSync(inFile);
                        fs.unlinkSync(outFile);
                        fs.unlinkSync(thumbnail);
                        
                        if(err) return cb(err);
                        
                        console.log('err = ', err);
                        console.log('results = ', results);
                        cb();
                    });
                }
            },
            2,
            function(err){
                if(err) next(err);
                console.log('finished processing:', file.filename);
            });
        });
        
        // procesar
        // subir a s3
        // entrar a db
    });
    
    req.pipe(req.busboy);
});

//~ router.get('/audio/project/:projectid/status', function(req, res) {
    //~ var project_id = req.param('projectid');
    //~ 
    //~ model.recordings.uploadedStatus(    
//~ });

module.exports = router;
