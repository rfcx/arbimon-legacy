angular.module('a2.filter.as-csv', [
])
.filter('asCSV', function(){
    return function(value, delimiter, filter){
        if(!(value instanceof Array)){
            if(typeof value == 'object'){
                value = Object.keys(value).map(function(key){
                    return key + "=" + (value[key] === undefined ? '' : value[key]);
                });
            } else {
                value = [value];
            }
        }
        
        if(filter){
            value = value.filter(function(v){
                return !!v;
            });
        }
        
        return value.join(delimiter || ', ');
    };
});