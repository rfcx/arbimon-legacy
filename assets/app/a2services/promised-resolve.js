angular.module('a2.srv.resolve', [
])
.factory('$promisedResolve', function($q, $injector){
    return function $resolve(resolveMap, context){
        context = context || {};
        return $q.all(Object.keys(resolveMap).map(function(key){
            return $q.resolve().then(function(){
                return $injector.invoke(resolveMap[key]);
            }).then(function(value){
                context[key] = value;
            });
        })).then(function(){
            return context;
        });
    };
})
;