module.exports = function(object){
    if(typeof object != 'object'){
        return object;
    }
    var keys = Object.keys(object);
    keys.forEach(function(key){
        if(object[key] === undefined){
            delete object[key];
        }
    });
    return object;
}
