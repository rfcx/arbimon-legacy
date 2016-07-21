angular.module('a2.orders.orders', [
    'a2.orders.create-project',
    'a2.orders.change-project-plan',
    'a2.orders.shipping-form',
    'a2.orders.order-summary',
    'ui.bootstrap',
])
.service('a2order', function($modal) {
    var formOpener = function(orderData, view) {
        var modalOptions = {
            resolve: {
                orderData: function() {
                    return orderData;
                }
            },
            backdrop: 'static',
            templateUrl: view.templateUrl,
            controller: view.controller,
        };
        
        return $modal.open(modalOptions);
    };
    
    
    return {
        createProject: function(orderData) {
            var modalInstance = formOpener(orderData, {
                templateUrl: '/orders/create-project.html',
                controller: 'CreateProjectCtrl'
            });
            
            return modalInstance;
        },
        changePlan: function(orderData) {
            var modalInstance = formOpener(orderData, {
                templateUrl: '/orders/change-plan.html',
                controller: 'ChangeProjectPlanCtrl'
            });
            
            return modalInstance;
        },
        enterShippingAddress: function(orderData) {
            var modalInstance = formOpener(orderData, {
                templateUrl: '/orders/shipping-address.html',
                controller: 'ShippingFormCtrl'
            });
            
            return modalInstance;
        },
        reviewOrder: function(orderData) {
            var modalInstance = formOpener(orderData, {
                templateUrl: '/orders/order-summary.html',
                controller: 'OrderSummaryCtrl'
            });
            
            return modalInstance;
        }
    };
})
;
