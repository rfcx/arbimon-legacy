var fs = require('fs');
var path = require('path');
var async = require('async');
var config = require('../config');
var sha256 = require('./sha256');

var cache = {
    hash_key : function(key){
        var match = /^(.*?)(\..*)?$/.exec(key);
        return sha256(match[1]) + (match[2] || '');
    },
    checkValidity : function(file, callback){
        fs.stat(file, function(err, stats){
            if (err) { callback(err); return ; }
            var now = (new Date()).getTime();
            console.log(stats.atime.getTime(), " + ", config("tmpfilecache").maxObjectLifetime, " >= " , now, " ? ", stats.atime.getTime() + config("tmpfilecache").maxObjectLifetime >= now);
            if (stats.atime.getTime() + config("tmpfilecache").maxObjectLifetime >= now ) { 
                callback(null, {
                    path : file,
                    stat : stats
                });
            } else {
                callback(null, null);
            }
        })
    },
    get :  function(key, callback){
        var root = path.resolve(config("tmpfilecache").path);
        var file = path.join(root, this.hash_key(key));
        
        cache.checkValidity(file, function(err, stats){
            callback(err, stats);
        });
    },
    put : function(key, data, callback){
        var root = path.resolve(config("tmpfilecache").path);
        var file = path.join(root, this.hash_key(key));
        
        fs.writeFile(file, data, callback);
        
    },
    fetch : function(key, oncachemiss, callback){
        this.get(key, function(err, data){
            if(!data || err){
                oncachemiss(function(data){
                    cache.put(key, data, callback);
                });
            } else {
                callback(null, data);
            }
        })
    },
    
    cleanupTimeout : 0,
    cleanup : function(){
        var root = path.resolve(config("tmpfilecache").path);
        var setCleanupTimeout = function(){
            if (cache.cleanupTimeout) {
                return;
            }
            cache.cleanupTimeout = setTimeout(function(){
                cache.cleanupTimeout = 0;
                cache.cleanup();
            }, config("tmpfilecache").cleanupInterval);
        };
        
        fs.readdir(root, function(err, files){
            async.each(files, function(subfile, callback){
                var file = path.join(root, subfile);
                cache.checkValidity(file, function (err, filestats){
                    if(!filestats) {
                        fs.unlink(file);
                        console.log('cleanup tmpcache file : ', file, err, filestats);
                        
                    }
                });
            }, function(err){
                setCleanupTimeout();
            });
        })
    }
};

cache.cleanup();

module.exports = cache;