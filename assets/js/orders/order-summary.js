angular.module('a2.orders.order-summary', [
    'a2.orders.orders',
    'a2.orders.order-utils',
    'ui.bootstrap',
    'humane',
])
.controller('OrderSummaryCtrl', function($scope, $http, $modalInstance, orderData, notify, $window, a2order, a2orderUtils) {
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
        $http.post('/api/orders/'+orderData.action, orderData)
            .success(function(data) {
                console.log(data);
                // if free project notify project was created
                if(data.message) {
                    notify.log(data.message);
                    $modalInstance.close();
                }
                
                // else redirect to paypal
                if(data.approvalUrl) {
                    $window.location.assign(data.approvalUrl);
                }
                $scope.waiting = false;
            })
            .error(function(data) {
                if(!data) {
                    $scope.waiting = false;
                    return;
                }
                
                var responded = false;
                if(data.freeProjectLimit) {
                    $modalInstance.dismiss();
                    notify.error(
                        'You already have own a free project, '+
                        'the limit is one per user'
                    );
                    responded = true;
                }
                
                if(data.nameExists) {
                    notify.error('Name <b>'+$scope.project.name+'</b> not available');
                    responded = true;
                }
                
                if(data.urlExists) {
                    notify.error('URL <b>'+$scope.project.url+'</b> is taken, choose another one');
                    responded = true;
                }
                
                if(!responded)
                    notify.serverError();
                    
                $scope.waiting = false;
            });
    };
})
;
