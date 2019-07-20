angular.module('a2.filter.range', [
])
.filter('a2Range',function() {
    return function(from, to, step) {
        if(!to){
            to = from;
            from = 0;
        }

        if(!step){
            step = Math.sign(to - from);
        }

        var stepSign = Math.sign(step);

        var list = [];

        if (step != 0) {
            for (var i=from; (i - to) * stepSign < 0; i += step){
                list.push(i);
            }
        }

        return list;
    };
})
;
