angular.module('a2.srv.api', [])
.factory('a2APIService', function($location, $q, $http){
    var nrm = /\/?project\/([\w\_\-]+)/.exec($location.absUrl());
    var projectName = nrm ? nrm[1] : '';
    var apiURLPrefix = '/api/project/'+projectName;
    function returnData(response){
        return response.data;
    }
    return {
        get : function(apiRoute){
            return $q.when($http.get(apiURLPrefix + apiRoute)).then(returnData);
        },
        post : function(apiRoute, data){
            return $q.when($http.post(apiURLPrefix + apiRoute, data)).then(returnData);
        },
        delete : function(apiRoute, data){
            return $q.when($http.delete(apiURLPrefix + apiRoute)).then(returnData);
        },
        put : function(apiRoute, data){
            return $q.when($http.put(apiURLPrefix + apiRoute, data)).then(returnData);
        }
    };
})
;