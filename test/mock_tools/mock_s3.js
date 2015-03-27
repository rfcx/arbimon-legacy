var mock_s3 = function(){
    
};

mock_s3.buckets={};

mock_s3.prototype = {
    putObject: function(params, callback){
        var bucket = mock_s3.buckets[params.Bucket];
        if(!bucket){
            setImmediate(callback, new Error("bucket " + params.Bucket + " not in cache."));
        } else {
            bucket[params.Key] = {
                Key: params.Key,
                ACL: params.ACL,
                Body: params.Body
            };
            setImmediate(callback, null, {Message:"Object added OK"});
        }
    },
    deleteObjects: function(params, callback){
        var bucket = mock_s3.buckets[params.Bucket];
        if(!bucket){
            setImmediate(callback, new Error("bucket " + params.Bucket + " not in cache."));
        } else {
            var not_found=[];
            params.Delete.Objects.forEach(function(obj){
                var objKey = obj.Key;
                if(bucket[objKey]){
                    delete bucket[objKey];
                } else {
                    not_found.push(objKey);
                }
            });
            if(not_found.length > 0){
                setImmediate(callback, new Error('Some not found ' + not_found.join(',') ));
            } else {
                setImmediate(callback, null, {Message:'Deleted OK'});
            }
        }
    }
};

module.exports = mock_s3;
