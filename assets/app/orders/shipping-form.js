angular.module('a2.orders.shipping-form', [
    'a2.orders.orders',
    'countries-list',
    'ui.bootstrap',
])
.controller('ShippingFormCtrl', function($scope, $http, $modalInstance, $modal, orderData, countries, a2order) {
    if(!orderData.address) {
        $http.get('/legacy-api/user/address')
            .success(function(data) {
                $scope.address = data.address || {};
            });
    }
    else {
        $scope.address = orderData.address;
    }
    
    countries.get(function(data) {
        $scope.countries = data;
    });
    
    $scope.verify = function() {
        // TODO this method should validate form and call server to get shipping cost
        
        $http.post('/legacy-api/orders/calculate-shipping', {
                address: $scope.address,
                recorderQty: orderData.recorderQty,
            })
            .success(function(data) {
                
                orderData.shipping = data.shipping_cost;
                orderData.address = data.address;
                
                a2order.reviewOrder(orderData);
                $modalInstance.dismiss();
            });
    };
})
;
