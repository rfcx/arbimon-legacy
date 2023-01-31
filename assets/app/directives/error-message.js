angular.module('a2.directive.error-message', [])
.directive('errorMessage', function($http, $window) {
    var message = '';

    return {
        templateUrl: '/directives/error-message.html',
        restrict: 'E',
        replace: true,
        scope: {
            message: "=",
        },
        link: function($scope) {
            message = $scope.message;
        }
    };
});
