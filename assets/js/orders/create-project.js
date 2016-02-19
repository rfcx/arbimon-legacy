angular.module('a2.orders.create-project', [
    'a2.orders.orders',
    'a2.orders.order-utils',
    'a2.orders.plan-selection',
    'ui.bootstrap',
    'humane',
])
.controller('CreateProjectCtrl', function($scope, $http, $modalInstance, $modal, notify, a2order, orderData, a2orderUtils) {
    
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
        if(!$scope.isValid) return;
        
        if(!$scope.project.plan) {
            return notify.error('You need to select a plan');
        }
        
        if(!$scope.autoPaymentsEnabled && $scope.project.plan.tier == 'paid') {
            return notify.log('Payments are unavailable');
        }
        
        // don't process orders over $10,000
        if($scope.project.plan.cost + ($scope.recorderQty * 125) > 10000) return;
        
        orderData = {
            action: 'create-project',
            project: $scope.project,
            recorderQty: $scope.recorderQty,
        };
        console.log(orderData);
        // if user added recorders to paid order show shipping address form
        if($scope.recorderQty > 0 && $scope.project.plan.tier == 'paid') {
            a2order.enterShippingAddress(orderData);
        }
        else {
            a2order.reviewOrder(orderData);
        }
        
        $modalInstance.dismiss();
    };
})
;
