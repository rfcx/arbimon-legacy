angular.module('a2.orders.directives.plan-capacity', [
    'a2.orders.plan-selection',
    'countries-list',
    'ui.bootstrap',
    'humane',
    'a2.directives',
    'a2.services',
])
.directive('planCapacity', function(){
    return {
        restrict: 'E',
        scope: {
            'minutes': '=',
        },
        templateUrl: '/partials/orders/plan-capacity.html',
    };
})
;
