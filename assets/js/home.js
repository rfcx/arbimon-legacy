angular.module('home', ['ui.bootstrap'])
    .controller('HomeCtrl', function($scope, $http) {
        
        $http.get('api/user/projectlist')
        .success(function(data) {
                $scope.projects = data;
        });
        
        $scope.feed = [
            "afdsg",            // dummy data
            "sdjhfbsjdgf",
            "sdjhfgf",
            "sdjhfaagf",
            "sdjhfbasdgf",
            "sdjhdgf",
            "shfbsjdgf",
            "sdjhsjdgf",
            "sdjhjdgf"
        ];
    });
