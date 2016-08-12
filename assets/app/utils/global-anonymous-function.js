angular.module('a2.utils.global-anonymous-function', [
])
.factory('globalAnonymousFunction', function($window){
    var ct=0;
    return function(fn, options){
        // console.log("return function(fn, options)", fn, options);
        var wrapperFn = function(){
            if(options && options.oneTime){
                wrapperFn.remove();
            }
            fn.apply(this, Array.prototype.slice.call(arguments));
        };
        
        wrapperFn.id = '__g_a_f_'+(ct++);
        $window[wrapperFn.id] = wrapperFn;        
        
        wrapperFn.remove = function(){
            if($window[wrapperFn.id] == wrapperFn){
                delete $window[wrapperFn.id];
            }
        };
        
        return wrapperFn;        
    };
});