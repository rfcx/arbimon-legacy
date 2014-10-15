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
});


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
                        })
                    })
                }
            });
        }
    };
});
;
