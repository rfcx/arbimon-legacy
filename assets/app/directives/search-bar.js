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
            isUnsafe:"@"
        },
        link: function($scope) {
            $scope.q = q;
            $scope.projectsLoading = projectsLoading;
            $scope.projects = projects;

            $scope.findProject = function() {
                var config = {
                    params: {
                        publicTemplates: true
                    }
                };
                if ($scope.q !== '') {
                    config.params.q = $scope.q;
                }
                $scope.projectsLoading = true;
                return $http.get('/legacy-api/user/projectlist', config).then(function(result) {
                    $scope.projectsLoading = false;
                    $scope.projects = result.data;
                    return result.data;
                })

            };

            $scope.selectProject = function() {
                if (!$scope.q || $scope.q) {
                    return;
                }
                $window.location.assign('/project/' + $scope.q.url + '/');
            };

        }
    };
});
