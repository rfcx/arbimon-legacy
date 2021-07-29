angular.module('a2.admin', [
    'a2.directives',
    'a2.admin.dashboard',
    'a2.admin.projects',
    'a2.admin.jobs',
])
.controller('AdminCtrl', function($http, $scope, $state, $window){
    $scope.$state = $state;

    $scope.q = '';

    $scope.findProject = function() {
        if (!$scope.q || $scope.q.trim() === '') return;
        if ($scope.q && $scope.q.length < 2) return;
        var config = {
            params: {
                allAccessibleProjects: true
            }
        };
        if ($scope.q !== '') {
            config.params.q = $scope.q;
        }
        $scope.projects = [];
        $scope.isLoading = true;
        return $http.get('/api/user/projectlist', config).then(function(result) {
            $scope.isLoading = false;
            $scope.projects = result.data;
            return result.data;
        })

    };

    $scope.selectProject = function() {
        if (!$scope.q || $scope.q && !$scope.q.is_enabled) {
            return;
        }
        $window.location.assign('/project/' + $scope.q.url + '/');
    };

});
