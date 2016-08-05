#!/usr/bin/env nodejs

console.log('Script for making sure that all uploaded recordings in the buckets are public.');

var async = require('async');
var config = require('../../app/config');

var AWS    = require('aws-sdk');
AWS.config.update({
    accessKeyId: config('aws').accessKeyId, 
    secretAccessKey: config('aws').secretAccessKey,
    region: config('aws').region
});
var s3 = new AWS.S3();

function promisedLoop(condition, loopFn){
    return new Promise(function(resolve, reject){
        var loopPromise = Promise.all([]);
        function loop(){
            return Promise.all([])
                .then(condition)
                .catch(reject)
                .then(function(conditionValue){
                    if(conditionValue){
                        return Promise.all([])
                            .then(loopFn)
                            .catch(reject)
                            .then(function(){
                                loopPromise = loopPromise.then(loop);
                            });
                    } else {
                        resolve();
                    }
                });
        }
        
        loopPromise = loopPromise.then(loop);
    });
}
function promisedCall(/*fn, args*/){
    var args = Array.prototype.slice.call(arguments);
    var fn = args.shift();
    return new Promise(function(resolve, reject){
        args.push(function(err, value){
            if(err){
                reject(err);
            } else {
                resolve(value);
            }
        });
        fn.apply(null, args);
    });
}
function promisedInvoke(/*context, member, args*/){
    var args = Array.prototype.slice.call(arguments);
    var context = args.shift();
    var member = args.shift();
    args.unshift(context[member].bind(context));
    return promisedCall.apply(null, args);
}

var bucketName = config('aws').bucketName;
var markers={};
var object_list=[];
var first_run = true;

promisedLoop(function(){
    return first_run || (object_list && object_list.length > 0);
}, function(){
    first_run = false;
    console.log('s3.listObjects from ', markers.next || '[beginning]', ' max 1000');
    var params = {
        Bucket : bucketName
    };
    if(markers.next){
        params.Marker = markers.next;
    }
    
    return promisedInvoke(s3, 'listObjects', params).then(function(data){
        object_list = data.Contents;
        markers.current = data.Marker;
        markers.next = object_list.length && object_list[object_list.length - 1].Key;
        
        console.log("List of length ", object_list.length," obtained.");
        console.log("Markers : ", markers);
        
        return Promise.all(object_list.map(function(object, nextEach){
            if(/(\.flac|\.wav)$/.test(object.Key)){
                // console.log('> Checking ', object.Key);
                return promisedInvoke(s3, 'getObjectAcl', {
                    Bucket : bucketName,
                    Key    : object.Key
                }).then(function(acl){
                    if(acl.Grants.reduce(function(_, grant){
                        return _ || (
                            grant.Grantee.Type == 'Group' &&
                            grant.Grantee.URI == 'http://acs.amazonaws.com/groups/global/AllUsers' &&
                            /read/i.test(grant.Permission)
                        );
                    }, false)){
                        return;
                    }
                    
                    console.log('> Setting ', object.Key, ' to public-read.');
                    return promisedInvoke(s3, 'putObjectAcl', {
                        Bucket : bucketName,
                        Key    : object.Key,
                        ACL    : 'public-read'
                    });
                });
            }
        }));
    });    
}).then(function(){
    console.log("All done.");
}).catch(function(err){
    console.log("Error : ", err);
    console.log("Markers : ", markers);
});
// async.doWhilst(function(nextWhilstLoop){
//     console.log('s3.listObjects from ', markers.next || '[beginning]', ' max 1000');
//     var params = {
//         Bucket : bucketName
//     };
//     if(markers.next){
//         params.Marker = markers.next;
//     }
//     s3.listObjects(params, function(err, data){
//         if(err) {
//             nextWhilstLoop(err); 
//             return; 
//         }
//         object_list = data.Contents;
//         markers.current = data.Marker;
//         markers.next = object_list.length && object_list[object_list.length - 1].Key;
//         
//         console.log("List of length ", object_list.length," obtained.");
//         console.log("Markers : ", markers);
//         
//         async.each(object_list, function(object, nextEach){
//             if(/(\.flac|\.wav)$/.test(object.Key)){
//                 // console.log('> Checking ', object.Key);
//                 s3.getObjectAcl({
//                     Bucket : bucketName,
//                     Key    : object.Key
//                 }, function(err, acl){
//                     if(err){ nextEach(err); return; }
//                     var all_users_read_grants = acl.Grants.filter(function(grant){
//                         return grant.Grantee.Type == 'Group' &&
//                             grant.Grantee.URI == 'http://acs.amazonaws.com/groups/global/AllUsers' &&
//                             /read/i.test(grant.Permission);
//                     });
//                     
//                     if(all_users_read_grants.length === 0 ){
//                         console.log('> Setting ', object.Key, ' to public-read.');
//                         s3.putObjectAcl({
//                             Bucket : bucketName,
//                             Key    : object.Key,
//                             ACL    : 'public-read'
//                         }, function(err, data){
//                             nextEach(err, data);
//                         });
//                     } else {
//                         nextEach();
//                     }
//                 });
//             } else {
//                 nextEach();
//             }
//         }, nextWhilstLoop);
//     });    
// }, function(){
//     console.log('whilst check : ', !!object_list, object_list && object_list.length);
//     return object_list && object_list.length > 0;
// }, function(err){
//     if(err){
//         console.log("Error : ", err);
//         console.log("Markers : ", markers);
//     } else {
//         console.log("All done.");
//     }    
// });
