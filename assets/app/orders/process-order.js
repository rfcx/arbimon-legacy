angular.module('a2.orders.process-order', [
])
.controller('ProcessOrderCtrl', function($scope, $http, $window, $location) {
    var reOrderId = /\/process-order\/([\w\-\d]+)/;
    var result = reOrderId.exec($window.location.pathname);
    var orderId = result !== null ? result[1] : '';
    console.log('orderId:', orderId);
    
    $scope.processing = true;
    
    $http.post('/legacy-api/orders/process/'+orderId+$window.location.search)
        .success(function(data) {
            console.log('data', data);
            $scope.invoice = {
                items: data.invoice.item_list.items,
                amount: data.invoice.amount,
                number: data.orderNumber,
                user: data.user,
            };
            
            if(data.invoice.item_list.shipping_address) {
                $scope.invoice.address = data.invoice.item_list.shipping_address;
            }
            
            $scope.action = data.action;
            
            $scope.processing = false;
            $scope.success = true;
        })
        .error(function(data, status) {
            if(status == 404) {
                $scope.notFound = true;
            }
            else if(status == 400 && data.error == 'APPROVAL_NEEDED') {
                $scope.needApproval = true;
                $scope.approvalLink = data.approvalLink;
            }
            else if(status == 400 && data.error == 'ALREADY_PROCESSED') {
                $scope.alreadyProcessed = true;
            }
            else {
                $scope.errorOcurred = true;
            }
            
            $scope.processing = false;
        });
})
;
