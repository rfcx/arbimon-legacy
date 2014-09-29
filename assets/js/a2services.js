angular.module('a2services',[])
.factory('ProjectInfo', ['$location', '$http', function($location, $http) {
    return {
        get: function(callback) {
            var urlparse = document.createElement('a');
            urlparse.href = $location.absUrl();
            var nameRe = /\/project\/([\w\_\-]+)/;
            
            var projectName = nameRe.exec(urlparse.pathname)[1];
            
            $http.get('/api/project/'+projectName+'/getInfo')
            .success(function(data) {
                callback(data);
            });
        }
    };
}]);
