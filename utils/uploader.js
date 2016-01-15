/*jshint node:true */
"use strict";

/**
    @module utils/uploader
    @description 
    exports class for upload processor
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
        if(err) console.error("failed to delete: %s. error: %s", filename, err);
    });
};

var deleteBucketObject = function(key) {
    if(key) s3.deleteObject({
        Bucket : config('aws').bucketName,
        Key    : key
    }, function (err) {
        if(err) console.error("failed to delete bucket object: %s. error: %s", key, err);
    });
};


AWS.config.update({
    accessKeyId: config('aws').accessKeyId, 
    secretAccessKey: config('aws').secretAccessKey,
    region: config('aws').region
});

var s3 = new AWS.S3({ 
    httpOptions: {
        timeout: 30000,
    }
}); 

/** 
 * Creates an upload processor
 * @class Uploader
 */
var Uploader = function() {};

/** 
 * Checks if upload is registered on db and update state to processing
 */
Uploader.prototype.insertUploadRecs = function(callback) {
    if(this.upload.id) {
        model.uploads.updateState(this.upload.id, 'processing', callback);
    }
    else {
        model.uploads.insertRecToList({
            filename: this.upload.name,
            project_id: this.upload.projectId,
            site_id: this.upload.siteId,
            user_id: this.upload.userId,
            state: 'processing',
        }, 
        (function(err, result) {
            if(err) return callback(err);
            
            this.upload.id = result.insertId;
            callback(null, result);
        }).bind(this));
    }
};

/**
 * Transcodes the recording to flac and/or mix down to mono if needed
 */
Uploader.prototype.convertMonoFlac = function(callback) {
    debug('convertMonoFlac:', this.upload.name);
    var needConvert = false;
    
    var args = [this.inFile];
    
    if(this.upload.info.channels > 1) {
        needConvert = true;
        args.push('-c', 1);
    }
    if(this.upload.FFI.filetype !== ".flac") {
        needConvert = true;
        args.push('-t', 'flac');
    }
    
    if(!needConvert) {
        this.outFile = this.inFile;
        return callback(null, 'did not process');
    }
    
    args.push(this.outFile);
    
    audioTools.sox(args, (function(code, stdout, stderr) {
        if(code !== 0)
            return callback(new Error("error converting to mono and/or to flac: \n" + stderr));
        this.upload.info.channels = 1;
        callback(null, code);
    }).bind(this));
};

/**
 * Fetches initial audio info if it wasnt provided or is incomplete.
 */ 
Uploader.prototype.getInitialAudioInfo = function(callback) {
    debug('getInitialAudioInfo:', this.upload.name);
    if(this.upload.info && this.upload.info.channels){
        callback();
    } else {
        audioTools.info(this.inFile, (function(code, info) {
            if(code !== 0) {
                return callback(new Error("error getting audio file info"));
            }
            
            this.upload.info = info;
            callback();
        }).bind(this));
    }
};

/**
 * Updates audio info in case file was splitted and duration is different
 */ 
Uploader.prototype.updateAudioInfo = function(callback) {
    debug('updateAudioInfo:', this.upload.name);
    audioTools.info(this.outFile, (function(code, info) {
        if(code !== 0) {
            return callback(new Error("error getting audio file info"));
        }
        
        this.upload.info = info;
        callback();
    }).bind(this));
};

/**
 * Updates file size using fs.stat to have real file size in bytes
 */ 
Uploader.prototype.updateFileSize = function(callback) {
    debug('updateFilesize:', this.upload.name);
    fs.stat(this.outFile, (function(err, stats) {
        if(err) return callback(err);
        
        this.upload.info.file_size = stats.size;
        callback();
    }).bind(this));
};

/**
 * Generates audio spectrogram thumbnail of the file
 */ 
Uploader.prototype.genThumbnail = function(callback) {
    debug('gen thumbnail:', this.upload.name);
    
    audioTools.spectrogram(this.outFile, this.thumbnail, 
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
};

/**
 * Uploads audio file to AWS S3 Bucket
 */ 
Uploader.prototype.uploadFlac = function(callback) {
    debug('uploadFlac:', this.upload.name);
    
    var params = { 
        Bucket: config('aws').bucketName, 
        Key: this.fileUri,
        ACL: 'public-read',
        Body: fs.createReadStream(this.outFile)
    };

    s3.putObject(params, (function(err, data) {
        if (err)       
            return callback(err);
            
        debug("Successfully uploaded flac", this.upload.FFI.filename);
        callback(null, data);
    }).bind(this));
};

/**
 * Uploads thumbnail file to AWS S3 Bucket
 */
Uploader.prototype.uploadThumbnail = function(callback) {
    debug('uploadThumbnail:', this.upload.name);
    
    var params = { 
        Bucket: config('aws').bucketName, 
        Key: this.thumbnailUri,
        ACL: 'public-read',
        Body: fs.createReadStream(this.thumbnail)
    };

    s3.putObject(params, (function(err, data) {
        if (err)       
            return callback(err);
            
        debug("Successfully uploaded thumbnail:", this.upload.FFI.filename);
        callback(null, data);
    }).bind(this));

};

/**
 * Inserts the recording to the recordings table on the database
 */ 
Uploader.prototype.insertOnDB = function(callback) {
    debug("inserting to DB", this.upload.name);
    
    model.recordings.insert({
        site_id: this.upload.siteId,
        uri: this.fileUri,
        datetime: this.upload.FFI.datetime,
        mic: this.upload.metadata.mic,
        recorder: this.upload.metadata.recorder,
        version: this.upload.metadata.sver,
        sample_rate: this.upload.info.sample_rate,
        precision: this.upload.info.precision,
        duration: this.upload.info.duration,
        samples: this.upload.info.samples,
        file_size: this.upload.info.file_size,
        bit_rate: this.upload.info.bit_rate,
        sample_encoding: this.upload.info.sample_encoding,
        upload_time: new Date()
    },
    callback);
};

/**
 * Removes all the local and temporary files.
 */ 
Uploader.prototype.cleanUpTempFiles = function(callback) {
    // delete temp files
    deleteFile(this.thumbnail);
    deleteFile(this.inFile);
    if(this.outFile !== this.inFile) {
        deleteFile(this.outFile);
    }
    
    // remove from uploads_processing table
    callback();
};
/**
 * Finish the upload by updating the state to uploaded and deleting the bucket object.
 */ 
Uploader.prototype.finishProcessing = function(callback) {
    model.uploads.updateState(this.upload.id, 'uploaded', (function(err){
        deleteBucketObject(this.upload.tempFileUri);
        callback(err);
    }).bind(this));
};

Uploader.prototype.ensureFileIsLocallyAvailable = function(callback) {
    if(this.upload.tempFileUri){// it's in the bucket!!!
        s3.getObject({
            Bucket : config('aws').bucketName,
            Key    : this.upload.tempFileUri
        }, (function(err, data){
            if(err) { callback(err); return; }
            fs.writeFile(this.upload.path, data.Body, callback);
        }).bind(this));
    } else {// is already available
        callback();
    }
};

Uploader.prototype.dataPrep = function(callback) {
    
    this.inFile = this.upload.path;
    this.outFile = tmpFileCache.key2File(this.upload.FFI.filename + '.out.flac');
    this.thumbnail = tmpFileCache.key2File(this.upload.FFI.filename + '.thumbnail.png');
    
    var uri = util.format('project_%d/site_%d/%d/%d/%s', 
        this.upload.projectId,
        this.upload.siteId,
        this.upload.FFI.datetime.getFullYear(),
        this.upload.FFI.datetime.getMonth()+1,
        this.upload.FFI.filename
    );
    
    this.fileUri = uri + '.flac';
    this.thumbnailUri = uri + '.thumbnail.png';
    
    debug('fileURI:', this.fileUri);
    
    callback();
};


/** 
 * Process recording
 * @param {Object}  upload - object containing upload info
 * @param {Object}  upload.metadata - recording metadata
 * @param {String}  upload.metadata.recorder - recorder model
 * @param {String}  upload.metadata.mic - microphone model used in the recorder
 * @param {String}  upload.metadata.sver - recorder's software version
 * @param {Object}  upload.info - audio file info
 * @param {Number}  upload.info.channels - number of audio channels on file
 * @param {Number}  upload.info.duration - length of audio in seconds
 * @param {Object}  upload.FFI - fileformat info object returned by utils/formatParse()
 * @param {String}  upload.name - original filename
 * @param {String}  upload.path - path uploaded file
 * @param {String}  upload.projectId - project id
 * @param {String}  upload.siteId - site id
 * @param {String}  upload.userId - user id
 * @param {Function} done - function call when procesing is done or an error occured
 **/
Uploader.prototype.process = function(upload, done) {
    var self = this;
    
    self.start = new Date(); // for elapse time
    
    debug("process:", upload.name);
    self.upload = upload;
    
    async.auto({
        prepInfo: self.dataPrep.bind(self),
        
        ensureFileIsLocallyAvailable: ['prepInfo', self.ensureFileIsLocallyAvailable.bind(self)],
        
        insertUploadRecs: ['ensureFileIsLocallyAvailable', self.insertUploadRecs.bind(self)],
        // run initial audio file info, just in case that data is missing, before deciding if conversion is needed
        getInitialAudioInfo: ['insertUploadRecs', self.getInitialAudioInfo.bind(self)],
        
        convertMonoFlac: ['getInitialAudioInfo', self.convertMonoFlac.bind(self)],
        // update audio file info after conversion
        updateAudioInfo: ['convertMonoFlac', self.updateAudioInfo.bind(self)],
        
        updateFileSize: ['updateAudioInfo', self.updateFileSize.bind(self)],
        
        genThumbnail: ['updateFileSize', self.genThumbnail.bind(self)],
        
        uploadFlac: ['genThumbnail', async.retry(self.uploadFlac.bind(self))],
        
        uploadThumbnail: ['genThumbnail', async.retry(self.uploadThumbnail.bind(self))],
        
        insertOnDB: ['uploadFlac', 'uploadThumbnail', self.insertOnDB.bind(self)],
        
        finishProcessing: ['insertOnDB', self.finishProcessing.bind(self)]
    },
    function(err, results) {
        self.cleanUpTempFiles(function(err2){
            if(err) {
                console.error("Error while processing upload.", err.stack);
                model.uploads.updateStateAndComment(self.upload.id, 'error', JSON.stringify(err), function(){
                    done(err);
                });
                return;
            }
            // silently ignoring cleanup problems.......
            // if(err2) {
            //     console.error(err2.stack);
            //     return done(err2);
            // }
            
            debug('upload processing results:', results);
            debug('done processing %s for site %s', self.upload.name, self.upload.siteId);
            debug('elapse:', ((new Date()) - self.start)/1000 + 's');
            
            done(null, results);
        });
    });
};

Uploader.computeTempAreaPath = function(upload){
    return util.format('uploading/project_%d/site_%d/%d/%d/%s%s', 
        upload.projectId,
        upload.siteId,
        upload.FFI.datetime.getFullYear(),
        upload.FFI.datetime.getMonth()+1,
        upload.FFI.filename,
        upload.FFI.filetype
    );
};

Uploader.moveToTempArea = function(upload, callback){
    if(!upload.tempFileUri){
        upload.tempFileUri = Uploader.computeTempAreaPath(upload);
    }
    
    var params = { 
        Bucket: config('aws').bucketName, 
        Key: upload.tempFileUri,
        Body: fs.createReadStream(upload.path)
    };

    s3.putObject(params, function(err, data) {
        if(err) {
            return callback(err);
        }
            
        debug("Successfully moved uploaded ", upload.path, " to ", upload.tempFileUri);
        
        fs.unlink(upload.path, callback);
    });
};


module.exports = Uploader;
