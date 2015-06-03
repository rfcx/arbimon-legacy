#!/usr/bin/env nodejs
/* jshint node:true */
"use strict";

var readline = require('readline');
var fs = require('fs');
var os = require('os');
var path = require('path');
var mysql = require('mysql');
var async = require('async');
var aws = require('aws-sdk');

var audioTools = require('../../utils/audiotool');
var config = require('../../config');

aws.config.update({
    accessKeyId: config('aws').accessKeyId, 
    secretAccessKey: config('aws').secretAccessKey,
    region: config('aws').region
});

var db = mysql.createConnection({
    host : config('db').host,
    user : config('db').user,
    password : config('db').password,
    database : config('db').database,
    timezone : config('db').timezone
});
db.connect();

var s3 = new aws.S3();

var done = false;
var offset = 0;


var checkRecBlock = function(nextBlock) {
    console.log('checkRecBlock offset:', offset);
    var q = 'SELECT * \n'+
            'FROM recordings AS r \n'+
            'WHERE upload_time IS NULL \n'+
            'LIMIT ?, 1000';
    
    db.query(q, [offset], function(err, rows) {
        if(err) return nextBlock(err);
        
        if(!rows.length) {
            done = true;
            return nextBlock();
        }
        
        async.eachSeries(rows, updateRecInfo, function(err) {
            if(err) return nextBlock(err);
            
            offset += 1000;
            nextBlock();
        });
    });
};

var updateRecInfo = function(rec, nextRec) {
    console.log('verifying rec: %s', rec.uri);
    var newRecInfo = {};
    
    var params = {
        Bucket: config('aws').bucketName,
        Key: rec.uri
    };
    
    async.waterfall([
        function(callback) {
            if(rec.sample_rate) {
                s3.headObject(params, callback);
            }
            else {
                s3.getObject(params, callback);
            }
        },
        function(data, callback) {
            newRecInfo.upload_time = new Date(Date.parse(data.LastModified));
            newRecInfo.file_size = data.ContentLength;
            
            if(rec.sample_rate) {
                callback();
            }
            else {
                var recPath = path.join(os.tmpdir(), path.basename(rec.uri));
                fs.writeFileSync(recPath, data.Body);
                
                audioTools.info(recPath, function(code, info) {
                    fs.unlinkSync(recPath);
                    if(code !== 0) {
                        return callback(new Error('audiotools.info() failed'));
                    }
                    
                    newRecInfo.sample_rate = info.sample_rate;
                    newRecInfo.duration = info.duration;
                    newRecInfo.samples = info.samples;
                    newRecInfo.bit_rate = info.bit_rate;
                    newRecInfo.precision = info.precision;
                    newRecInfo.sample_encoding = info.sample_encoding;
                    
                    callback();
                });
            }
        },
        function(callback) {
            var q = 'UPDATE recordings \n'+
                    'SET ? WHERE recording_id = ?';
            db.query(q, [newRecInfo, rec.recording_id], function(err, results) {
                if(err) return callback(err);
                
                console.log('update done:', results);
                
                callback();
            });
        }
    ],
    function(err) {
        if(err) {
            if(err.code === 'NoSuchKey' || err.code === 'NotFound') {
                console.log('%s not found on bucket', rec.uri);
                
                var q = 'DELETE FROM recordings \n'+
                        'WHERE recording_id = ?';
                        
                db.query(q, [rec.recording_id], function(err, results) {
                    if(err) return nextRec(err);
                    
                    console.log('%s deleted from DB', rec.uri);
                    
                    offset--;
                    
                    nextRec();
                });
            }
            else {
                nextRec(err);
            }
        }
        else {
            nextRec();
        }
    });
};


var main = function() {
    console.log('Started');
    async.doUntil(
        checkRecBlock,
        function() { return done; },
        function (err) {
            if(err) console.error(err.stack);
            
            db.end();
        }
    );
};

if(require.main === module) {
    main();
}
