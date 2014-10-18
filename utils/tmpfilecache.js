var fs = require('fs');
var path = require('path');
var async = require('async');
var config = require('../config');
var sha256 = require('./sha256');

var cache_miss = function(cache, key, callback){
    this.cache = cache;
    this.key = key;
    this.file = cache.key2File(this.key);
    this.callback = callback;
};

cache_miss.prototype.set_file_data = function(data){
    this.cache.put(this.key, data, this.callback);
};

cache_miss.prototype.retry_get = function(){
    this.cache.get(this.key, this.callback);
};


var cache = {
    hash_key : function(key){
        var match = /^(.*?)((\.[^.\/]*)*)?$/.exec(key);
        return sha256(match[1]) + (match[2] || '');
    },
    key2File : function(key){
        var root = path.resolve(config("tmpfilecache").path);
        return path.join(root, this.hash_key(key));
    },
    checkValidity : function(file, callback){
        fs.stat(file, function(err, stats){
            if (err) { callback(err); return ; }
            var now = (new Date()).getTime();
            if (stats.atime.getTime() + config("tmpfilecache").maxObjectLifetime >= now ) { 
                callback(null, {
                    path : file,
                    stat : stats
                });
            } else {
                fs.unlink(file, function(){
                    callback(null, null);
                });                
            }
        })
    },
    get :  function(key, callback){
        cache.checkValidity(cache.key2File(key), function(err, stats){
            callback(err, stats);
        });
    },
    put : function(key, data, callback){
        var file = cache.key2File(key);
        fs.writeFile(file, data, function(err){
            var stats = err ? null : {path : file};
            callback(err, stats);
        });
    },
    fetch : function(key, oncachemiss, callback){
        this.get(key, function(err, data){
            if(!data || err){
                oncachemiss(new cache_miss(cache, key, callback));
            } else {
                callback(null, data);
            }
        })
    },
    
    cleanupTimeout : 0,
    cleanup : function(){
        console.log('Cleaning up tmpcache.');
        var root = path.resolve(config("tmpfilecache").path);
        var setCleanupTimeout = function(){
            if (cache.cleanupTimeout) {
                return;
            }
            var delay = config("tmpfilecache").cleanupInterval;
            console.log('Running tmpcache cleanup in : ', (delay/1000.0), ' seconds.');
            cache.cleanupTimeout = setTimeout(function(){
                cache.cleanupTimeout = 0;
                cache.cleanup();
            }, delay);
        };
        
        fs.readdir(root, function(err, files){
            async.each(files, function(subfile, callback){
                if (subfile == '.gitignore') {
                    return;
                }
                var file = path.join(root, subfile);
                cache.checkValidity(file, function (err, filestats){
                    if(!filestats) {
                        fs.unlink(file);
                        console.log('   tmpcache file removed : ', file);
                    }
                });
            }, function(err){
                setCleanupTimeout();
            });
        })
    }
};

module.exports = cache;
