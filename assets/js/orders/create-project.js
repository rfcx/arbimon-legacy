angular.module('a2.orders.create-project', [
    'a2.orders.orders',
    'a2.orders.order-utils',
    'a2.orders.plan-selection',
    'a2.orders.project-order-service',
    'ui.bootstrap',
    'humane',
])
.controller('CreateProjectCtrl', function($scope, $http, $modalInstance, $modal, notify, a2order, orderData, a2orderUtils, ProjectOrderService) {
    
    $scope.project = orderData.project;
    $scope.recorderQty = orderData.recorderQty;
    
    a2orderUtils.getOrdersContact().then(function(response){
        $scope.ordersContact = response.data;
    });
    
    a2orderUtils.paymentsStatus().then(function(response) {
        $scope.autoPaymentsEnabled = response.data.payments_enable;
    });
    
    $scope.create = function() {
        console.log($scope.isValid);
        if(!$scope.isValid){
            return;
        }

        return ProjectOrderService.makeOrder('create-project', $scope.project, $scope.recorderQty, {
            autoPaymentsEnabled: $scope.autoPaymentsEnabled
        }).then(function(order){
            console.log(order);
            // if user added recorders to paid order show shipping address form
            if(order.hasCoupon){
                return ProjectOrderService.placeOrder(order.data).then(function(){
                    return $modalInstance.close();
                });
            } else if(order.isPaidProject && order.data.recorderQty > 0) {
                a2order.enterShippingAddress(order.data);
                $modalInstance.dismiss();
            } else {
                a2order.reviewOrder(order.data);
                $modalInstance.dismiss();
            }
        });
    };
})
;
