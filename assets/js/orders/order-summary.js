angular.module('a2.orders.order-summary', [
    'a2.orders.orders',
    'a2.orders.order-utils',
    'a2.orders.project-order-service',
    'ui.bootstrap',
    'humane',
])
.controller('OrderSummaryCtrl', function($scope, $http, $modalInstance, orderData, notify, $window, a2order, a2orderUtils, ProjectOrderService) {
    if(orderData.address) {
        $scope.address = orderData.address;
    }
    
    $scope.type = orderData.mode == 'upgrade' ? 'upgrade' : 'new';
    $scope.info = a2orderUtils.info;
    $scope.shipping = orderData.shipping || 0;
    $scope.project = orderData.project;
    $scope.plan = orderData.project.plan;
    $scope.recorderQty = orderData.recorderQty || 0;
    
    $scope.changeItems = function() {
        if(orderData.action == 'create-project') {
            a2order.createProject(orderData);
        }
        else {
            a2order.changePlan(orderData);
        }
        $modalInstance.dismiss();
    };
    
    $scope.editAddress = function() {
        a2order.enterShippingAddress(orderData);
        $modalInstance.dismiss();
    };
    
    $scope.submit = function() {
        $scope.waiting = true;
        console.log(orderData);
        return ProjectOrderService.placeOrder(orderData).then(function(data){
            console.log(data);
            if(data.message) { // if free project notify project was created
                $modalInstance.close();
            } else if(data.approvalUrl) { // else redirect to paypal
                $window.location.assign(data.approvalUrl);
            }
            $scope.waiting = false;
        }).catch(function(err){
            $scope.waiting = false;
        });
    };
})
;
