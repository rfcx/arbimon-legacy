/* jshint node:true */
"use strict";

var fs = require('fs');
var path = require('path');


var debug = require('debug')('arbimon2:tmpfilecache');
var async = require('async');
var Q = require('q');

var config = require('../config');
var sha256 = require('./sha256');

var root = path.resolve(config("tmpfilecache").path);
if (!fs.existsSync(root)) {
    fs.mkdirSync(root);
}

var filesProcessing = {};

// files that misses after fetch
var CacheMiss = function(cache, key, callback){
    debug('new CacheMiss');
    this.cache = cache;
    this.key = key;
    this.file = cache.key2File(this.key);
    this.deferred = Q.defer();
    this.callback = callback;
    filesProcessing[key] = this.deferred.promise;

    this.deferred.promise.nodeify(this.callback);
};

CacheMiss.prototype.resolveWaiting = function(err, stats) {
    if(err) {
        debug('reject %s', this.key);
        this.deferred.reject(err);
    }
    else {
        debug('resolve %s', this.key);
        this.deferred.resolve(stats);
    }
    delete filesProcessing[this.key];
};

CacheMiss.prototype.set_file_data = function(data){
    debug('set_file_data');
    this.cache.put(this.key, data, (this.resolveWaiting).bind(this));
};

CacheMiss.prototype.retry_get = function(){
    debug('retry_get');
    this.cache.get(this.key, (this.resolveWaiting).bind(this));
};



var cache = {
    hash_key: function(key){
        var match = /^(.*?)((\.[^.\/]*)*)?$/.exec(key);
        return sha256(match[1]) + (match[2] || '');
    },

    key2File: function(key){
        return path.join(root, this.hash_key(key));
    },

    checkValidity: function(file, callback){
        fs.stat(file, function(err, stats){
            if(err) return callback(err);

            var now = (new Date()).getTime();

            if (stats.atime.getTime() + parseInt(config("tmpfilecache").maxObjectLifetime) >= now ) {
                debug('file is fresh %s', file);
                callback(null, {
                    path : file,
                    stat : stats
                });
            }
            else {
                debug('file is expired %s', file);
                fs.unlink(file, function() {
                    callback(null, null);
                });
            }
        });
    },

    get:  function(key, callback){
        cache.checkValidity(cache.key2File(key), callback);
    },

    put: function(key, data, callback){
        var file = cache.key2File(key);
        fs.writeFile(file, data, function(err){
            if(err) return callback(err);

            callback(null, { path: file });
        });
    },

    fetch: function(key, oncachemiss, callback){
        if(filesProcessing[key]) {
            return filesProcessing[key].nodeify(callback);
        }
        this.get(key, function(err, data){
            if(!data || err){
                if(err && err.code && err.code !== "ENOENT"){
                    callback(err);
                }
                else {
                    oncachemiss(new CacheMiss(cache, key, callback));
                }
            }
            else {
                callback(null, data);
            }
        });
    },

    cleanupTimeout: 0,

    cleanup: function(){
        console.info('Cleaning up tmpcache.');
        fs.readdir(root, function(err, files){
            if(err) return console.error(err.stack);
            async.each(files, function(subfile, next){
                if (/\.gitignore|\.placeholder/.test(subfile)) {
                    next();
                    return;
                }
                var file = path.join(root, subfile);
                cache.checkValidity(file, next);
            }, function(err){
                cache.setCleanupTimeout();
            });
        });
    },

    setCleanupTimeout: function(){
        if(cache.cleanupTimeout) {
            return;
        }

        var delay = parseInt(config("tmpfilecache").cleanupInterval);
        debug('tmpfilecache cleanup will run in: %d seconds.', (delay/1000.0));
        cache.cleanupTimeout = setTimeout(function(){
            cache.cleanupTimeout = 0;
            cache.cleanup();
        }, delay);
    }
};

module.exports = cache;
