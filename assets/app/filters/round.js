angular.module('a2.filter.round', [
])
.filter('round', function(){
    return function(val, precision){
        precision = precision || 1;
        return (((val / precision) | 0) * precision) || 0;
    };
});