angular.module('a2.orders', [
    'countries-list',
    'ui.bootstrap',
    'humane',
    'a2.directives',
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
                templateUrl: '/partials/orders/create-project.html',
                controller: 'CreateProjectCtrl'
            });
            
            return modalInstance;
        },
        enterShippingAddress: function(orderData) {
            var modalInstance = formOpener(orderData, {
                templateUrl: '/partials/orders/shipping-address.html',
                controller: 'ShippingFormCtrl'
            });
            
            return modalInstance;
        },
        reviewOrder: function(orderData) {
            var modalInstance = formOpener(orderData, {
                templateUrl: '/partials/orders/order-summary.html',
                controller: 'OrderSummaryCtrl'
            });
            
            return modalInstance;
        }
    };
})
.controller('PlanSelectionCtrl', function($scope) {
    
    $scope.freePlan = { 
        cost: 0, 
        storage: 100, 
        processing: 1000, 
    };
    $scope.paidPlan = {};
    $scope.recorderOptions = 0;
    
    if($scope.project && $scope.project.plan && $scope.project.plan.storage) {
        if($scope.project.tier == 'free') {
            $scope.project.plan = $scope.freePlan;
        }
        else {
            $scope.planMinutes = $scope.project.plan.storage;
            $scope.project.plan = $scope.paidPlan;
        }
    }
    else {
        $scope.planMinutes = 10000;
    }
    
    $scope.recorderQty = $scope.recorderQty || 0;
    
    $scope.$watch('planMinutes', function() {
        $scope.paidPlan.cost = $scope.planMinutes*0.03;
        $scope.paidPlan.storage = +$scope.planMinutes;
        $scope.paidPlan.processing = $scope.planMinutes*100;
        
        var recorderCap = Math.floor($scope.planMinutes/10000);
        
        if($scope.recorderQty > recorderCap) {
            $scope.recorderQty = recorderCap;
        }
        
        $scope.recorderOptions = new Array(Math.floor($scope.planMinutes/10000)+1);
    });
    
})
.directive('selectPlan', function(){
    return {
        restrict: 'E',
        scope: {
            'project': '=',
            'recorderQty': '=',
        },
        templateUrl: '/partials/orders/select-plan.html',
        controller: 'PlanSelectionCtrl',
    };
})
.controller('OrderSummaryCtrl', function($scope, $http, $modalInstance, orderData, notify, $window, a2order) {
    if(orderData.address) {
        $scope.address = orderData.address;
    }
    
    $scope.shipping = orderData.shipping || 0;
    $scope.project = orderData.project;
    $scope.plan = orderData.project.plan;
    $scope.recorderQty = orderData.recorderQty || 0;
    
    $scope.changeItems = function() {
        if(orderData.action == 'create-project') {
            a2order.createProject(orderData);
            $modalInstance.dismiss();
        }
        else {
            console.log('update');
        }
    };
    
    $scope.editAddress = function() {
        a2order.enterShippingAddress(orderData);
        $modalInstance.dismiss();
    };
    
    $scope.submit = function() {
        $scope.waiting = true;
        $http.post('/api/orders/'+orderData.action, orderData)
            .success(function(data) {
                $scope.waiting = false;
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
            })
            .error(function(err) {
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
.controller('ShippingFormCtrl', function($scope, $http, $modalInstance, $modal, orderData, countries, a2order) {
    if(!orderData.address) {
        $http.get('/api/user/address')
            .success(function(data) {
                $scope.address = data.address || {};
            });
    }
    else {
        $scope.address = orderData.address;
    }
    
    $scope.countries = countries;
    
    $scope.verify = function() {
        // TODO this method should validate form and call server to get shipping cost
        
        $http.post('/api/orders/calculate-shipping', { 
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
.controller('CreateProjectCtrl', function($scope, $http, $modalInstance, $modal, notify, a2order, orderData) {
    console.log(orderData);
    console.log($scope.project);
    console.log($scope.recorderQty);
    
    $scope.project = orderData.project;
    $scope.recorderQty = orderData.recorderQty;
    
    console.log(orderData);
    console.log($scope.project);
    console.log($scope.recorderQty);
    
    $scope.create = function() {
        console.log($scope.isValid);
        if(!$scope.isValid) return;
        
        if(!$scope.project.tier) {
            return notify.error('You need to select the project tier');
        }
        
        if($scope.project.tier == 'paid' && !$scope.project.plan) {
            return notify.error('You need to select a plan');
        }
        
        console.log($scope.project);
        
        
        orderData = {
            action: 'create-project',
            project: $scope.project,
            recorderQty: $scope.recorderQty,
        };
        
        // if user added recorders to paid order show shipping address form
        if($scope.recorderQty > 0 && $scope.project.tier == 'paid') {
            a2order.enterShippingAddress(orderData);
        }
        else {
            a2order.reviewOrder(orderData);
        }
        
        $modalInstance.dismiss();
    };
})
.controller('ProcessOrderCtrl', function($scope, $http, $window, $location) {
    var reOrderId = /\/process-order\/([\w\-\d]+)/;
    var result = reOrderId.exec($window.location.pathname);
    var orderId = result !== null ? result[1] : '';
    console.log('orderId:', orderId);
    
    $scope.processing = true;
    
    $http.post('/api/orders/process/'+orderId+$window.location.search)
        .success(function(data) {
            $scope.success = true;
            $scope.orderedItems = data.orderedItems;
            $scope.action = data.action;
            
            $scope.processing = false;
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
