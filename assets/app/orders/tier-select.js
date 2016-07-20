angular.module('a2.orders.directives.tier-select', [
])
.directive('tierSelect', function(){
    return {
        restrict: 'E',
        scope: {
            'tier': '=',
            'disableFree': '=',
        },
        templateUrl: '/orders/tier-select.html',
    };
})
;
