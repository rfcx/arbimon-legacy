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
var q = require('q');
var AWS = require('aws-sdk');

var config       = require('../config');
var model = require('../model');
var Uploader = require('../utils/uploader');
var tmpFileCache = require('../utils/tmpfilecache');
var JobScheduler = require('../utils/job-scheduler');

var lambda = new AWS.Lambda();

var scheduler = new JobScheduler({
    fetch: function(queue){
        return model.uploads.fetchRandomUploadItems(10).then(function(upload_items){
            if(upload_items.length){
                queue.push.apply(queue, upload_items.map(uploadFromUploadItemEntry));
            }
        });
    },
    process: function(upload){
        var uploader = new Uploader();
        return q.ninvoke(uploader, 'process', upload);
    },
    drain: function(){
        console.log('done processing uploads on queue');
    }
});

function uploadFromUploadItemEntry(upload_item){
    if(upload_item.datetime){
        var f = /^(.+?)(.[^.]+)?$/.exec(upload_item.filename);
        if(!f){
            return;
        }
        var ct = ((uploadFromUploadItemEntry.ct || 0) + 1) & 0xff;
        uploadFromUploadItemEntry.ct = ct;
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
            path: tmpFileCache.key2File("upload-item/" + Date.now() + '/' + ct + '/' + upload_item.filename),
            projectId: upload_item.project_id,
            siteId: upload_item.site_id,
            userId: upload_item.user_id
        };
        upload.tempFileUri = Uploader.computeTempAreaPath(upload);
        return upload;
    }
}

module.exports = {
    enqueue: function(upload, cb) {
        var upload_row;
        async.waterfall([
            function(callback) {
                upload.tempFileUri = Uploader.computeTempAreaPath(upload);
                upload_row = {
                    filename: upload.name,
                    project_id: upload.projectId,
                    site_id: upload.siteId,
                    user_id: upload.userId,
                    state: 'initializing',
                    metadata: upload.metadata,
                    datetime: upload.FFI.datetime,
                    channels: upload.info.channels,
                    duration: upload.info.duration
                };
                model.uploads.insertRecToList(upload_row, callback);
            },
            function(result, fields, callback) {
                upload.id = result.insertId;
                upload_row.upload_id = result.insertId;
                callback();
            },
            function storeRawFileInBucket(callback){
                Uploader.moveToTempArea(upload, callback);
            },
            function flagAsWaiting(callback){
                model.uploads.updateState(upload.id, 'waiting', function(err){
                    callback(err);
                });
            },
            function(callback){
                if(config('lambdas').process_uploaded_recording){
                    lambda.invoke({
                        FunctionName: config('lambdas').process_uploaded_recording,
                        InvocationType: 'Event',
                        Payload: JSON.stringify(upload_row),
                    }, callback);
                } else {
                    callback();
                }
            }
        ], cb);
    },
    resume: function(){
        return model.uploads.fetchRandomUploadItems(10).then(function(upload_items){
            if(upload_items.length){
                scheduler.push.apply(scheduler, upload_items.map(uploadFromUploadItemEntry));
            }
        }).catch(console.error);
    }
};
