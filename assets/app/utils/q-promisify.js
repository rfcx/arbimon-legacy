angular.module('a2.utils.q-promisify', [
])
.factory('$qPromisify', function($q){
    function $qPromisify(/*fn, ...args*/){
        var args = Array.prototype.slice.call(arguments);
        var fn = args.shift();
        return $q(function(resolve, reject){
            args.push(function(err, value){
                if(err){
                    reject();
                } else {
                    resolve(value);
                }
            });
            fn.apply(null, args);
        });
    }
    
    $qPromisify.invoke = function(/*object, method, ...args*/){
        var args = Array.prototype.slice.call(arguments);
        var object = args.shift();
        var method = args.shift();
        return $qPromisify(function(cb){
            args.push(cb);
            object[method].apply(object, args);
        });
    };
    
    
    return $qPromisify;
})
;