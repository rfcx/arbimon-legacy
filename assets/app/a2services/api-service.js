angular.module('a2.srv.api', [])
.factory('a2APIServiceClass', function($location, $q, $http){
    var a2APIServiceClass = function(prefix){
        this.prefix = prefix;
    };

    function returnData(response){
        return response.data;
    }

    a2APIServiceClass.prototype = {
        getUrl: function(apiRoute){
            return this.prefix + apiRoute;
        },
        get : function(apiRoute, params){
            return $q.when($http.get(this.prefix + apiRoute, params)).then(returnData);
        },
        post : function(apiRoute, data){
            return $q.when($http.post(this.prefix + apiRoute, data)).then(returnData);
        },
        delete : function(apiRoute, data){
            return $q.when($http.delete(this.prefix + apiRoute)).then(returnData);
        },
        put : function(apiRoute, data){
            return $q.when($http.put(this.prefix + apiRoute, data)).then(returnData);
        }
    };

    return a2APIServiceClass;
})
.factory('a2APIService', function($location, $q, a2APIServiceClass){
    var nrm = /\/?(project|citizen-scientist|visualizer)\/([\w\_\-]+)/.exec($location.absUrl());
    var projectName = nrm ? nrm[2] : '';
    var apiURLPrefix = '/legacy-api/project/'+projectName;
    function returnData(response){
        return response.data;
    }

    var a2APIService = new a2APIServiceClass(apiURLPrefix);
    a2APIService.api = new a2APIServiceClass('/legacy-api');
    a2APIService.project = new a2APIServiceClass('/project/' + projectName);

    a2APIService.getProjectName = function() {
        return projectName
    }

    return a2APIService;
})
;
