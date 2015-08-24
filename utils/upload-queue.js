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
                model.uploads.insertRecToList({
                    filename: upload.name,
                    project_id: upload.projectId,
                    site_id: upload.siteId,
                    user_id: upload.userId,
                    state: 'waiting',
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
};
