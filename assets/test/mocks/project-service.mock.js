// mock project service module
angular.module('a2-project-service-mock', [])
.factory('Project', function($location, $http) {
    var url = 'test';
    
    return {
        getUrl: function() {
            return url;
        },
    };
});
