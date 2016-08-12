angular.module('a2.orders.change-project-plan', [
    'a2.orders.order-utils',
    'a2.orders.orders',
    'ui.bootstrap',
    'humane',
    'a2.directives',
    'a2.services',
])
.controller('ChangeProjectPlanCtrl', function($scope, orderData, Project, $window, a2order, $modalInstance, notify, a2orderUtils) {
    $scope.today = new Date();
    console.log(orderData);
    $scope.recorderQty = orderData.recorderQty;
    
    a2orderUtils.getOrdersContact().then(function(response){
        $scope.ordersContact = response.data;
    });
    
    a2orderUtils.paymentsStatus().then(function(response) {
        $scope.autoPaymentsEnabled = response.data.payments_enable;
    });
    
    Project.getInfo(function(info) {
        $scope.project = info;
        $scope.currentPlan = {
            storage: info.storage_limit,
            processing: info.processing_limit,
            duration: info.plan_period,
            tier: info.tier,
            activation: info.plan_activated,
            creation: info.plan_created,
        };
        
        if($scope.currentPlan.activation && $scope.currentPlan.duration) {
            var due = new Date($scope.currentPlan.activation);
            due.setFullYear(due.getFullYear()+$scope.currentPlan.duration);
            $scope.currentPlan.due = due;
        }
        
        if($scope.currentPlan.due && $scope.currentPlan.due < $scope.today) {
            $scope.mode = 'renew';
        }
        else if($scope.currentPlan.duration) {
            $scope.mode = 'upgrade';
        }
        else {
            $scope.mode = 'new';
        }
        
        $scope.project.plan = (orderData.project && orderData.project.plan) || {};
        
        Project.getUsage().success(function(usage) {
            $scope.minUsage = usage.min_usage;
        });
    });
    
    
    $scope.upgrade = function() {
        if(!$scope.autoPaymentsEnabled) {
            return notify.log('Payments are unavailable');
        }
        
        if($scope.mode == 'renew') {
            if($scope.project.plan.storage < $scope.minUsage) {
                notify.error('Please select a plan with more capacity or delete recordings from the project');
                return;
            }
        }
        else {
            if($scope.currentPlan.storage && ($scope.project.plan.storage - $scope.currentPlan.storage) <= 0) {
                notify.error('To upgrade select a plan with more capacity than the current');
                return;
            }
        }
        
        orderData = {
            action: 'update-project',
            project: $scope.project,
            recorderQty: $scope.recorderQty,
            mode: $scope.mode,
        };
        
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
