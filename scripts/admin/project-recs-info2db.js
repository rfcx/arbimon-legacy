#!/usr/bin/env nodejs

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

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


var db = mysql.createConnection({
    host : config('db').host,
    user : config('db').user,
    password : config('db').password,
    database : config('db').database
});
db.connect();

var s3 = new aws.S3();

var currentRec, projectId;

var getNextRec = function(callback) {
    var q = 'SELECT r.recording_id AS id, r.uri \n'+
            'FROM recordings AS r \n'+
            'JOIN sites AS s ON r.site_id = s.site_id \n'+
            'WHERE sample_rate IS NULL \n';
            
    if(projectId)
        q += 'AND s.project_id = ? \n';
                
    q += 'LIMIT 0, 1';
    
    q = mysql.format(q, [projectId]);
    
    // console.log(q);
    db.query(q, function(err, rows) {
        if(err) return callback(err);
        
        currentRec = rows.length ? rows[0] : null;
        console.log('currentRec:', currentRec);
        callback();
    });
};

var updateRecInfo = function(callback) {
    // console.log('updateInfo:', currentRec);
    var q = 'UPDATE recordings \n'+
            'SET `sample_rate` = ?, '+
            '`duration` = ?, '+
            '`samples` = ?, '+
            '`file_size` = ?, '+
            '`bit_rate` = ?, '+
            '`precision` = ?, '+
            '`sample_encoding` = ? \n'+
            'WHERE recording_id = ?';
            
    q = mysql.format(q, [
        currentRec.info.sample_rate, 
        currentRec.info.duration, 
        currentRec.info.samples, 
        currentRec.info.file_size, 
        currentRec.info.bit_rate, 
        currentRec.info.precision, 
        currentRec.info.sample_encoding,
        currentRec.id
    ]);
    // console.log(q);
    db.query(q, function(err, results) {
        if(err) return callback(err);
        
        // console.log('update done:', results);
        
        callback();
    });
};

var loop = function(next) {
    
    async.waterfall([
        function(callback) {
            s3.getObject({
                Bucket : config('aws').bucketName,
                Key    : currentRec.uri
            }, callback);
        },
        function(data, callback) {
            currentRec.path = path.join(os.tmpdir(), path.basename(currentRec.uri));
            
            fs.writeFile(currentRec.path, data.Body, callback);
        },
        function(callback) {
            audioTools.info(currentRec.path, function(err, info) {
                if(err) return callback(err);
                
                currentRec.info = info;
                callback();
            });
        },
        function(callback) {
            fs.stat(currentRec.path, function(err, stat) {
                if(err) return callback(err);
                
                currentRec.info.file_size = stat.size;
                callback();
            });
        },
        updateRecInfo,
        function(callback) {
            fs.unlinkSync(currentRec.path);
            callback();
        },
    ], function(err) {
        if(err) return next(err);
        
        console.log('recording data succesfully updated\n');
        getNextRec(next);
    });
    
};

var run = function() {
    getNextRec(function() {
        async.whilst(
            function test() {
                return currentRec !== null;
            },
            loop,
            function done(err) {
                if(err) console.error(err);
                
                db.end();
                rl.close();
            }
        );
    });
};



var question1 = "You want to verify information of recordings on\n"+
                " [1] system\n"+
                " [2] a single project\n\n: ";

rl.question(question1, function(answer) {
    if(answer === "2") {
        rl.question('Enter the project id: ', function(answer) {
            projectId = Number(answer);
            run();
        });
    }
    else {
        run();
    }
});
