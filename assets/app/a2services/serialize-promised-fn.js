angular.module('a2.service.serialize-promised-fn', [
])
/** serializePromisedFn function decorator.
 * Decorates a promise-returning function so that
 * concurrent calls occur in a serialized manner, 
 * that is, each call takes turn in a queue and gets
 * processed one at a time, in call order.
 */
.service('serializePromisedFn', function($q){
    return function serializePromisedFn(fn){
        var series = $q.resolve();
        return function serializedPromisedFn(){
            var context = this;
            var args = Array.prototype.slice.call(arguments);
            series = series.then(function(){
                return fn.apply(context, args);
            });
            return series;
        };
    };
})
;