angular.module('a2.directive.warning-banner', [])
.directive('warningBanner', function($http, $window) {
    var message = 0;

    return {
        templateUrl: '/directives/warning-banner.html',
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
