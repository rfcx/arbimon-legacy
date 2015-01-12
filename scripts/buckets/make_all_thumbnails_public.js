console.log('Script for making sure that all thumbnails in the buckets are public.');

var async = require('async');
var config = require('../../config');

var AWS    = require('aws-sdk');
AWS.config.update({
    accessKeyId: config('aws').accessKeyId, 
    secretAccessKey: config('aws').secretAccessKey,
    region: config('aws').region
});
var s3 = new AWS.S3();

var bucketName = config('aws').bucketName;
var markers={};
var object_list=[];
async.doWhilst(function(nextWhilstLoop){
    console.log('s3.listObjects from ', markers.next || '[beginning]', ' max 1000');
    var params = {
        Bucket : bucketName
    };
    if(markers.next){
        params.Marker = markers.next;
    }
    s3.listObjects(params, function(err, data){
        if(err) {
            nextWhilstLoop(err); 
            return; 
        }
        object_list = data.Contents;
        markers.current = data.Marker;
        markers.next = object_list.length && object_list[object_list.length - 1].Key;
        
        console.log("List of length ", object_list.length," obtained.");
        console.log("Markers : ", markers);
        
        async.each(object_list, function(object, nextEach){
            if(/\.png$/.test(object.Key)){
                // console.log('> Checking ', object.Key);
                s3.getObjectAcl({
                    Bucket : bucketName,
                    Key    : object.Key
                }, function(err, acl){
                    if(err){ nextEach(err); return; }
                    var all_users_read_grants = acl.Grants.filter(function(grant){
                        return grant.Grantee.Type == 'Group' &&
                            grant.Grantee.URI == 'http://acs.amazonaws.com/groups/global/AllUsers' &&
                            /read/i.test(grant.Permission);
                    });
                    
                    if(all_users_read_grants.length === 0 ){
                        console.log('> Setting ', object.Key, ' to public-read.');
                        s3.putObjectAcl({
                            Bucket : bucketName,
                            Key    : object.Key,
                            ACL    : 'public-read'
                        }, function(err, data){
                            nextEach(err, data);
                        });
                    } else {
                        nextEach();
                    }
                });
            } else {
                nextEach();
            }
        }, nextWhilstLoop);
    });    
}, function(){
    console.log('whilst check : ', !!object_list, object_list && object_list.length);
    return object_list && object_list.length > 0;
}, function(err){
    if(err){
        console.log("Error : ", err);
        console.log("Markers : ", markers);
    } else {
        console.log("All done.");
    }    
});
