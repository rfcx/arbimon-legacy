angular.module('a2utils', [])
.factory('$templateFetch', function($http, $templateCache){
    return function $templateFetch(templateUrl, linker){
        var template = $templateCache.get(templateUrl);
        if(template) {
            if (template.promise) {
                template.linkers.push(linker);
            } else {
                linker(template);
            }
        } else {
            var tmp_promise = {
                linkers : [linker],
                promise : $http.get(templateUrl).success(function(template){
                    $templateCache.put(templateUrl, template);
                    for(var i=0, l=tmp_promise.linkers, e=l.length; i < e; ++i){
                        l[i](template);
                    }
                })
            };
            $templateCache.put(templateUrl, tmp_promise);
        }
    }
})
.factory('itemSelection', function(){
    return {
        make : function make_itemSelection_obj(item_name){
            var sel = {};
            if(typeof item_name == 'undefined') {
                item_name = 'value';
            }
            sel[item_name] = null;
            sel.select = function(newValue){
                sel[item_name] = newValue;
            };
            return sel;
        }
    };
})
.service('a2BrowserMetrics', function(){
    var metrics = {};
    
    var css = {
        "border":  "none",
        "height":  "200px",
        "margin":  "0",
        "padding": "0",
        "width":   "200px"
    };

    var inner = $("<div>").css($.extend({}, css));
    var outer = $("<div>").css($.extend({
        "left":       "-1000px",
        "overflow":   "scroll",
        "position":   "absolute",
        "top":        "-1000px"
    }, css)).append(inner).appendTo("body")
    .scrollLeft(1000)
    .scrollTop(1000);

    metrics.scrollSize = {
        height : (outer.offset().top  - inner.offset().top ) | 0,
        width  : (outer.offset().left - inner.offset().left) | 0
    };

    outer.remove();
    
    return metrics;
})
.filter('moment', function(){
    return function(x, fmt){
        if(!x)
            return undefined;
            
        return moment(x).utc().format(fmt);
    };
})
.filter('paginate', function() {
    return function(arr, currentPage, limitPerPage) {
        if(!arr)
            return undefined;
        
        return arr.slice((currentPage-1)*limitPerPage, currentPage*limitPerPage);
    };
})
/** Pluralizes singular words accoring to some heuristics that (hopefully)
 *  look like english grammar.
 */
.filter('plural', function(){
    return function(x, fmt){
        if(!x)
            return undefined;
            
        return x +'s';
    }
})
;



angular.module('a2Infotags', [])
.factory('InfoTagService', ['$location', '$http', function($location, $http){
    return {
        getSpecies: function(species_id, callback){
            $http.get('/api/species/'+species_id).success(function(data) {
                callback(data);
            });
        },
        getSongtype: function(songtype_id, callback) {
            $http.get('/api/songtypes/'+songtype_id).success(function(data) {
                callback(data);
            });
        }
    };
}])
.directive('a2Species', function (InfoTagService, $timeout) {
    return {
        restrict : 'E',
        scope : {
            species : '='
        },
        template : '{{data.scientific_name}}',
        link     : function($scope, $element, $attrs){
            $scope.$watch('species', function(newVal, oldVal){
                $scope.data = null;
                if(newVal){
                    InfoTagService.getSpecies(newVal, function(data){
                        $timeout(function(){
                            $scope.data = data;
                        })
                    })
                }
            });
        }
    };
})
.directive('a2Songtype', function (InfoTagService, $timeout) {
    return {
        restrict : 'E',
        scope : {
            songtype : '='
        },
        template : '{{data.name}}',
        link     : function($scope, $element, $attrs){
            $scope.$watch('songtype', function(newVal, oldVal){
                $scope.data = null;
                if(newVal){
                    InfoTagService.getSongtype(newVal, function(data){
                        $timeout(function(){
                            $scope.data = data;
                        });
                    });
                }
            });
        }
    };
});


angular.module('a2Classy', [])
.factory('makeClass', function($inheritFrom){
    var slice=Array.prototype.slice;
    return function makeClass(classdef){
        if(!classdef.constructor){
            classdef.constructor = classdef.super && classdef.super.constructor ? 
                function super_constructor(){
                    this.super.constructor.apply(this, slice.call(arguments));
                } : 
                function empty_constructor(){}
            ;
        }
        if(classdef.static){
            angular.extend(classdef.constructor, classdef.static);
            delete classdef.static;
        }        
        if(classdef.super){
            classdef = $inheritFrom(classdef.super, classdef);
        }
        classdef.constructor.prototype = classdef;
        (window.qc||(window.qc=[])).push(classdef);

        return classdef.constructor;
    };        
})
.value('$inheritFrom', function $inheritFrom(object){
    var fn = function(){};
    fn.prototype = object;
    if(arguments.length > 1){
        var args = Array.prototype.slice.call(arguments);
        args[0] = new fn();
        return angular.extend.apply(angular, args);
    } else {
        return new fn();
    }
})
;

angular.module('humane', [])
.service('notify', function() {
    humane.error = humane.spawn({ addnCls: 'humane-libnotify-error' });

    return humane;
});
