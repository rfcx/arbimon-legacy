angular.module('a2.orders.directives.tier-select', [
])
.directive('tierSelect', function(){
    return {
        restrict: 'E',
        scope: {
            'tier': '=',
            'disableFree': '=',
        },
        templateUrl: '/partials/orders/tier-select.html',
    };
})
;
