var async = require('async');
var AWS = require('aws-sdk');
var model = require('../../models');
var tmpfilecache = require('../../utils/tmpfilecache');
var fs = require('fs');
var path = require('path');
var recs;

if(process.argv.length < 4){
    console.log("Usage: \n",process.argv[0],process.argv[1], "plistid outdir");
    process.exit(1);
}

var plist  = process.argv[2] | 0;
var outdir = process.argv[3];

AWS.config.loadFromPath('./config/aws.json');

async.waterfall([
    function(){
        var next = arguments[arguments.length-1];
        if(!fs.existsSync(outdir)){
            console.log("Making folder "  + outdir); 
            fs.mkdir(outdir, 0777, next);
        } else {
            next();
        }
    },    
    function(){
        var next = arguments[arguments.length-1];
        model.playlists.fetchData({id:plist}, function(_,a){ 
            if(_){next(_); return;}
            recs=a; 
            next();
        });
    },
    function(){
        var next = arguments[arguments.length-1];
        async.forEachLimit(recs, 5, function(r, next_rec){ 
            console.log("Fetching " + r.file + " to tmpfilecache.");
            model.recordings.fetchRecordingFile(r, next_rec);
        }, function(_){
            console.log("done", arguments);
            if(_){next(_);} else {next();}
        });
    },
    function(){
        var next = arguments[arguments.length-1];
        async.forEachLimit(recs, 5, function(r, next_rec){
            var file = tmpfilecache.key2File(r.uri);
            var destfile = path.join(outdir, r.file);
            console.log(file + " -> " + destfile);
            fs.rename(file, destfile, next_rec);
        }, next);
    }
], function(err){
    if(err){
        console.log("Error!!", err);
        process.exit(-1);
    } else {
        console.log("Done!!");
        process.exit(0);
    }
});
