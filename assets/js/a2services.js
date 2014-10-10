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
        }
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
