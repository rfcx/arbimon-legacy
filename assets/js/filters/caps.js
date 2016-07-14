angular.module('a2.filter.caps', [
    
])
.filter('caps',function() {
    return function(input, type) {
        if(!input){
            return undefined;
        }
            
        switch(type || 'title'){
            case 'title-case':
                return input.replace(/\b\w/g, function(_){
                    return _.toUpperCase();
                });
            default:
                return input;
        }
            
    };
})
;
