/**
 * @ngdoc overview
 * @name a2-sidenav
 * @description
 * Directive for specifying a sidenav bar.
 * this bar specifies a list of links that can be added
 * whenever a corresponding sidenavbar anchor resides
 */
angular.module('a2.directive.percentage-bars', [
    'a2.utils'
])
.directive('a2PercentageBars', function(a2SidenavBarService, $parse){
    return {
        restrict: 'E',
        templateUrl: '/directives/a2-percentage-bars.html',
        scope: {
            data:"=",
            colors:"=",
        },
        controller: 'a2PercentageBarsCtrl as bars'
    };
})
.controller('a2PercentageBarsCtrl', function($scope, $filter){
    var DEFAULT_COLORS = [ '0', '1', '2' ];
    var numberFilter = $filter('number');
    $scope.getColorClass = function(index){
        var colors = $scope.colors || DEFAULT_COLORS;
        return 'bar-' + colors[index % colors.length];
    };
    $scope.getTotal = function(){
        return $scope.data.reduce(function(a, b){ return a + b; });
    }
    $scope.asPercent = function(value, rounding){
        return numberFilter(value * 100 / $scope.getTotal(), rounding) + '%';
    }
})
;
