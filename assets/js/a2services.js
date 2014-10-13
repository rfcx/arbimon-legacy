angular.module('a2services',[])
.factory('Project', ['$location', '$http', function($location, $http) {    
    var urlparse = document.createElement('a');
    urlparse.href = $location.absUrl();
    var nameRe = /\/project\/([\w\_\-]+)/;
    
    var url = nameRe.exec(urlparse.pathname)[1];
    
    return {
        getInfo: function(callback) {            
            $http.get('/api/project/'+url+'/info')
            .success(function(data) {
                callback(data);
            });
        },
        
        getSites: function(callback) {
            $http.get('/api/project/'+url+'/sites')
            .success(function(data) {
                callback(data);
            });
        },
        
        getSpecies: function(callback) {
            $http.get('/api/project/'+url+'/species')
            .success(function(data) {
                
            });
        },
        
        getClasses: function(callback) {
            $http.get('/api/project/'+url+'/classes')
            .success(function(data) {
                callback(data);
            });
        },
        
        getRecs: function(query, callback) {
            if(typeof query === "function") {
                callback = query;
                query = "";
            }
            
            $http.get('/api/project/'+url+'/recordings/'+query)
            .success(function(data) {
                callback(data);
            });
        },
        
        getRecTotalQty: function(callback) {
            $http.get('/api/project/'+url+'/recordings/count/')
            .success(function(data) {
                callback(data[0].count);
            });
        },
        
        getName: function(){
            var urlparse = document.createElement('a');
            urlparse.href = $location.absUrl();
            var nameRe = /\/project\/([\w\_\-]+)/;
            
            return nameRe.exec(urlparse.pathname)[1];
        },
        getRecordings: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/'+key).success(function(data) {
                callback(data);
            });
        },
        getOneRecording: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/find/'+key).success(function(data) {
                callback(data);
            });
        },
        getRecordingAvailability: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/available/'+key).success(function(data) {
                callback(data);
            });
        },
        getRecordingInfo: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/info/'+key).success(function(data) {
                callback(data);
            });
        },
        getNextRecording: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/next/'+key).success(function(data) {
                callback(data);
            });
        },
        getPreviousRecording: function(key, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/recordings/previous/'+key).success(function(data) {
                callback(data);
            });
        },
        validateRecording: function(recording_uri, validation, callback){
            var projectName = this.getName();
            $http.post('/api/project/'+projectName+'/recordings/validate/'+recording_uri, validation).success(function(data) {
                callback(data);
            });
        },
        getTrainingSets: function(callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/training-sets/').success(function(data) {
                callback(data);
            });
        },
        addTrainingSet: function(tset_data, callback) {
            var projectName = this.getName();
            $http.post('/api/project/'+projectName+'/training-sets/add', tset_data).success(function(data) {
                callback(data);
            });
        },
        getTrainingSetDatas: function(training_set, recording_uri, callback) {
            var projectName = this.getName();
            $http.get('/api/project/'+projectName+'/training-sets/list/'+training_set+'/'+recording_uri).success(function(data) {
                callback(data);
            });
        },

    };
}]);

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
