angular.module('a2.orders', [
    'a2.orders.plan-selection',
    'countries-list',
    'ui.bootstrap',
    'humane',
    'a2.directives',
    'a2.services',
])
.service('a2orderUtils', function($http) {
    return {
        /**
            receives a plan activation date and duration period, and calculates 
            how many month are left until the plan is due
            @param [Date] acticationDate
            @param [Number] period
        */
        monthsUntilDue: function(acticationDate, period) {
            
            var d = new Date(acticationDate);
            var totalMonths = period*12;
            var today = new Date();
            var currentMonth;
            
            for(var i=0; i <= totalMonths; i++) {
                var month = new Date(d.getFullYear(), d.getMonth()+i, d.getDate());
                if(today <= month) {
                    currentMonth = i-1;
                    break;
                }
            }

            return totalMonths-currentMonth;
        },
        
        paymentsStatus: function() {
            return $http.get('/api/orders/payments-status', {cache:true});
        },
        
        getOrdersContact: function() {
            return $http.get('/api/orders/contact', {cache:true});
        },
        
        info: {
            recorder: {
                name: 'Arbimon Recorder',
                description: (
                    "includes an Android device preset for acoustic monitoring, "+
                    "waterproof case(IP67), microphone, 6500mAh lithium-ion battery "+
                    "and USB charger"
                ),
                priceWithPlan: 125,
                priceNoPlan: 300
            },
            plan: {
                new: {
                    name: "Project data plan",
                    description: function(plan) {
                        return (
                            "includes storage for " + plan.storage + " minutes of audio "+
                            "and capacity to process " + plan.processing + " minutes of audio "+
                            "per year, for a term of " + plan.duration + " year(s)"
                        );
                    }
                },
                upgrade: {
                    name: "Project data plan upgrade",
                    description: function(plan) {
                        return (
                            "upgrade your plan storage to " + plan.storage + " minutes of audio "+
                            "and capacity to process " + plan.processing + " minutes of audio "+
                            "per year, until this plan due"
                        );
                    }
                }
            },
        }
    };
})
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
        changePlan: function(orderData) {
            var modalInstance = formOpener(orderData, {
                templateUrl: '/partials/orders/change-plan.html',
                controller: 'ChangeProjectPlanCtrl'
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
.directive('tierSelect', function(){
    return {
        restrict: 'E',
        scope: {
            'tier': '=',
            'disableFree': '=',
        },
        templateUrl: '/partials/orders/tier-select.html',
    };
})
.directive('planCapacity', function(){
    return {
        restrict: 'E',
        scope: {
            'minutes': '=',
        },
        templateUrl: '/partials/orders/plan-capacity.html',
    };
})
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
    
    countries.get(function(data) {
        $scope.countries = data;
    });
    
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
.controller('ProcessOrderCtrl', function($scope, $http, $window, $location) {
    var reOrderId = /\/process-order\/([\w\-\d]+)/;
    var result = reOrderId.exec($window.location.pathname);
    var orderId = result !== null ? result[1] : '';
    console.log('orderId:', orderId);
    
    $scope.processing = true;
    
    $http.post('/api/orders/process/'+orderId+$window.location.search)
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
