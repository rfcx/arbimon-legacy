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
            'LIMIT ?, 1000';
    
    db.query(q, [offset], function(err, rows) {
        if(err) return nextBlock(err);
        
        if(!rows.length) {
            done = true;
            return nextBlock();
        }
        
        async.eachSeries(rows, updateACL, function(err) {
            if(err) return nextBlock(err);
            
            offset += 1000;
            nextBlock();
        });
    });
};

var updateACL = function(rec, nextRec) {
    console.log('updating ' + rec.uri);
    
    var params = {
        Bucket: config('aws').bucketName,
        Key: rec.uri,
        ACL: 'public-read',
    };

    s3.putObjectAcl(params, function(err, data) {
        if(err) {
            return nextRec(err);
        }
        
        console.log(data);
      
        nextRec();
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
