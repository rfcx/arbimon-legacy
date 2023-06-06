angular.module('a2.directive.error-banner-message', [])
.directive('errorBannerMessage', function($http, $window) {
    var message = '';

    return {
        templateUrl: '/directives/error-banner-message.html',
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
