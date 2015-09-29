/*jshint node:true */
"use strict";

/**
    @module utils/upload-queue
    @description 
    Module export <a href="https://github.com/caolan/async#queue">async.queue</a> 
    using as worker processUpload()
    @example
    var uploadQueue = require('../utils/upload-queue');
    
    uploadQueue.enqueue(upload); // processUpload() upload param
 */
var debug = require('debug')('arbimon2:upload-queue');
var async = require('async');

var model = require('../model');
var Uploader = require('../utils/uploader');
var tmpFileCache = require('../utils/tmpfilecache');


var worker = function(upload, callback) {
    var uploader = new Uploader();
    uploader.process(upload, callback);
};

// queue process 1 recording at a time per server instance
var queue = async.queue(worker, 1);

queue.drain = function() {
    console.log('done processing uploads on queue');
};

module.exports = {
    enqueue: function(upload, cb) {
        async.waterfall([
            function(callback) {
                upload.tempFileUri = Uploader.computeTempAreaPath(upload);
                
                model.uploads.insertRecToList({
                    filename: upload.name,
                    project_id: upload.projectId,
                    site_id: upload.siteId,
                    user_id: upload.userId,
                    state: 'waiting',
                    metadata: upload.metadata,
                    datetime: upload.FFI.datetime,
                    channels: upload.info.channels,
                    duration: upload.info.duration
                }, 
                callback);
            },            
            function(result, fields, callback) {
                upload.id = result.insertId;
                callback();
            },
            function storeRawFileInBucket(callback){
                Uploader.moveToTempArea(upload, callback);
            },
            function(callback){
                queue.push(upload);
                callback();
            }
        ], cb);
    },
    resume: function(){
        return model.uploads.getUploadsList().then(function(uploads_list){
            uploads_list.forEach(function(upload_item){
                if(upload_item.datetime){
                    var f = /^(.+?)(.[^.]+)?$/.exec(upload_item.filename);
                    if(!f){
                        return;
                    }
                    var upload = {
                        id: upload_item.id,
                        metadata: {
                            recorder: upload_item.recorder,
                            mic: upload_item.mic,
                            sver: upload_item.software
                        },
                        FFI: {
                            filename: f[1],
                            filetype: f[2],
                            datetime: upload_item.datetime
                        },
                        name: upload_item.filename,
                        path: tmpFileCache.key2File("resumed-upload/" + Date.now() + upload_item.filename),
                        projectId: upload_item.project_id,
                        siteId: upload_item.site_id,
                        userId: upload_item.user_id
                    };
                    upload.tempFileUri = Uploader.computeTempAreaPath(upload);
                    queue.push(upload);
                }
            });
        }).catch(console.error);
    }
};
