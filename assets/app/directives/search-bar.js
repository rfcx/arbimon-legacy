angular.module('a2.directive.search-bar', [])
.directive('searchBar', function($http, $window) {
    var q = '';

    var projectsLoading;

    var projects = [];

    return {
        templateUrl: '/directives/search-bar.html',
        restrict: 'E',
        scope: {
            projectsLoading:"=?",
            q:"=?",
            homePage:"@"
        },
        link: function($scope) {
            $scope.q = q;
            $scope.projectsLoading = projectsLoading;
            $scope.projects = projects;

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
                $scope.projectsLoading = true;
                return $http.get('/api/user/projectlist', config).then(function(result) {
                    $scope.projectsLoading = false;
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

        }
    };
});
