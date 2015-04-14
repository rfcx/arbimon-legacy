/**
    @module utils/upload-queue
    @description 
    Module export <a href="https://github.com/caolan/async#queue">async.queue</a> 
    using as worker processUpload()
    @example
    var uploadQueue = require('../utils/upload-queue');
    
    uploadQueue.push(upload); // processUpload() upload param
 */


var fs = require('fs');
var util = require('util');
var debug = require('debug')('arbimon2:upload-queue');
var async = require('async');
var AWS = require('aws-sdk');

var model = require('../model');
var config = require('../config');
var audioTools= require('../utils/audiotool');
var tmpFileCache = require('../utils/tmpfilecache');

var deleteFile = function(filename) {
    fs.unlink(filename, function(err) {
        if(err) console.error("failed to delete: %s", filename);
    });
};

var s3 = new AWS.S3({ 
    httpOptions: {
        timeout: 30000,
    }
}); 

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
 * @param done {Function} function call when procesing is done or and error occured
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
                user_id: upload.userId,
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

module.exports = uploadQueue;
