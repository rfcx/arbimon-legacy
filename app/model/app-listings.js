var q = require('q');
var config = require('../config'); 
var aws = require('aws-sdk');
var debug = require('debug')('arbimon2:models:app-listings');
// var s3 = new aws.S3();



var AppListings = {
    cache: undefined,
    types : {
        deb : 'linux',
        dmg : 'osx',
        msi : 'windows'
    },
    fetchCache: function(){
        if(AppListings.cache && AppListings.cache.expires > new Date().getTime()){
            debug("fetchCache() :: cache is still fresh");
            return q.resolve(AppListings.cache);
        }
        
        var s3 = new aws.S3();
        
        debug("fetchCache() :: fetching objects from " + config('aws').bucketName + '/software/');
        return q.ninvoke(s3, 'listObjects', {
            Bucket : config('aws').bucketName,
            Prefix : 'software/',
        }).then(function(data){
            AppListings.cache = {
                list: data.Contents.reduce(function(_, item){
                    var app = item.Key.replace(/^software\//, '').split('/').shift();
                    var m = /([^\/]+)-(\d+\.\d+\.\d+)\.(msi|deb|dmg)$/.exec(item.Key);
                    if(m){
                        (_[app] || (_[app] = [])).push({
                            url : 'https://' + config('aws').bucketName + '.s3.' + config('aws').region + '.amazonaws.com/' + item.Key,
                            file : m[0],
                            version : m[2],
                            type : AppListings.types[m[3]]
                        });
                    }
                    return _;
                }, {}),
                expires : new Date().getTime() + (3 * 60 * 60 * 1000)
            };
            debug("fetchCache() :: " + JSON.stringify(AppListings.cache));
            return AppListings.cache;
        });
        
    },
    getListFor: function(appName){
        return AppListings.fetchCache().then(function(cache){
            return cache.list[appName] || [];
        });
    },
};

module.exports = AppListings;