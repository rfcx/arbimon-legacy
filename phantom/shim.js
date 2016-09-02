// phantom js shim script for running plotly.js plots

// mockfill ArrayBuffer.isArray
if(ArrayBuffer && !ArrayBuffer.isView){
    ArrayBuffer.isView = function(){
        return false;
    };
}


// mock angular
window.angular = window.angular || (function(){
    var slice = Array.prototype.slice;
    var str = Object.prototype.toString;
    function extend_base(base, list, recurse){
        (list || []).forEach(function(obj){
            if(!obj || !/object|function/.test(typeof obj)){
                return;
            }
            Object.keys(obj).forEach(function(key){
                var val = obj[key];

                if(recurse && val && (typeof val) === 'object') {
                    if(str.call(val) === '[object Date]') {
                        base[key] = new Date(val.valueOf());
                    } else if (str.call(val) === '[object RegExp]') {
                        base[key] = new RegExp(val);
                    } else {
                        if(!base[key] || (typeof val) !== 'object'){
                            base[key] = Array.isArray(val) ? [] : {};
                        }
                        extend_base(base[key], [val], true);
                    }
                } else {
                    base[key] = val;
                }
            });
        });

        return base;
    }

    function copy(obj){
        if(Array.isArray(obj)){
            return obj.map(copy);
        } else if(typeof obj === 'number' || typeof obj === 'string'){
            return obj;
        } else {
            console.log(typeof obj);
            return Object.keys(obj).reduce(function(_, key){
                if(obj.hasOwnProperty(key)){
                    _[key] = copy(obj[key]);
                }
                return _;
            }, {});
        }        
    }


    var angular = {
        modules    : {},
        service    : {}, 
        controller : {},
        directive  : {},
        provider   : {},
        merge: function(base){
            return extend_base(base, slice.call(arguments, 1), true);
        },
        copy: copy,
        module : function(name, deps){
            var m = angular.modules[name] || (angular.modules[name] = {
                name : name,
                service    : {}, 
                controller : {},
                directive  : {},
                provider   : {},
            });
            var mobj = {};
            ['service', 'controller', 'directive'].forEach(function(type){
                mobj[type] = function(name, fn){
                    m[type][name] = fn;
                    angular[type][name] = fn;
                    return mobj;
                };
            });
            mobj.factory = mobj.service;
            mobj.provider = function(name, fn){
                mobj.provider[name + 'Provider'] = function(){
                    var args = slice.call(arguments);
                    var result = fn.apply(null, args);
                    mobj.service[name] = result.$get;
                    return result;
                };
                return mobj;
            };
            return mobj;
        },
    };
    return angular;
})();
