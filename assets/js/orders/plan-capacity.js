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
            'disabled': '=',
            'minutes': '=',
        },
        templateUrl: '/partials/orders/plan-capacity.html',
        link:function(scope, element, attrs){
            if(!attrs.enabled){
                scope.enabled = true;
            }
        }
    };
})
;
