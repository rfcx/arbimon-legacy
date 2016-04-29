angular.module('a2.filter.time-from-now', [
    
])
.filter('timeFromNow',function() {
    return function(input, fmt) {
        if(!input)
            return undefined;
            
        return moment(input).fromNow();
    };
})
;
