angular.module('a2.orders', [
    'countries-list',
    'ui.bootstrap',
    'humane',
    'a2.directives',
    'a2.services',
])
.service('a2orderUtils', function() {
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
.controller('PlanSelectionCtrl', function($scope, a2orderUtils) {
    $scope.freePlan = { 
        cost: 0, 
        storage: 100, 
        processing: 1000, 
    };
    $scope.recorderOptions = 0;
    $scope.planMinutes = $scope.planMinutes || 10000;
    $scope.planYears = $scope.planYears || 1;
    $scope.upgradeOnly = false;
    $scope.recorderQty = $scope.recorderQty || 0;
    
    console.log($scope.plan);
    
    $scope.$watch('currentPlan', function() {
        if(!$scope.currentPlan) return;
        
        var due = new Date($scope.currentPlan.activation);
        due.setFullYear(due.getFullYear()+$scope.currentPlan.duration);
        
        $scope.planYears = $scope.currentPlan.duration || 1;
        $scope.planMinutes = $scope.currentPlan.storage >= 10000 ? $scope.currentPlan.storage : 10000;
        
        if($scope.currentPlan.tier == 'paid' && (!$scope.currentPlan.activation || (new Date()) < due) ) {
            $scope.upgradeOnly = true;
            $scope.plan.tier = 'paid';
        }
    });
    
    $scope.$watch('plan', function(value) {
        if($scope.plan && $scope.plan.storage) {
            $scope.planMinutes = $scope.plan.storage;
        }
    });
    
    $scope.$watch('plan.tier', function(value) {
        if(!$scope.plan) return;
        
        if($scope.plan.tier == 'paid') {
            $scope.plan.cost = $scope.planMinutes * 0.03 * $scope.planYears;
            $scope.plan.storage = +$scope.planMinutes;
            $scope.plan.processing = $scope.planMinutes * 100;
            $scope.plan.duration = $scope.planYears;
            console.log($scope.plan);
        }
        else if($scope.plan.tier == 'free'){
            $scope.plan.cost = $scope.freePlan.cost;
            $scope.plan.storage = $scope.freePlan.storage;
            $scope.plan.processing = $scope.freePlan.processing;
            $scope.plan.duration =  null;
        }
    });
    
    
    var updatePlan = function() {
        $scope.plan = $scope.plan || {};
        
        if($scope.upgradeOnly) {
            if($scope.currentPlan.storage > $scope.planMinutes) {
                $scope.planMinutes = $scope.currentPlan.storage;
            }
            
            var planStarts = $scope.currentPlan.activation || $scope.currentPlan.creation;
            var monthsLeft = a2orderUtils.monthsUntilDue(planStarts, $scope.currentPlan.duration);
            console.log('planStarts', planStarts);
            console.log('monthsLeft', monthsLeft);
            
            $scope.plan.cost = ($scope.planMinutes - $scope.currentPlan.storage) * monthsLeft * (0.03/12);
            $scope.plan.storage = +$scope.planMinutes;
            $scope.plan.processing = $scope.planMinutes * 100;
            $scope.plan.duration = $scope.planYears;
        }
        else {
            if($scope.usage && $scope.usage > $scope.planMinutes) {
                $scope.planMinutes = Math.ceil($scope.usage/5000)*5000;
            }
            
            $scope.plan.cost = $scope.planMinutes * $scope.planYears * 0.03;
            $scope.plan.storage = +$scope.planMinutes;
            $scope.plan.processing = $scope.planMinutes * 100;
            $scope.plan.duration = $scope.planYears;
            
            var recorderCap = Math.floor($scope.planMinutes/10000)*$scope.planYears;
            
            $scope.recorderQty = $scope.recorderQty || 0;
            
            if($scope.recorderQty > recorderCap) {
                $scope.recorderQty = recorderCap;
            }
            
            $scope.recorderOptions = new Array(recorderCap+1);
        }
    };
    
    $scope.$watch('planMinutes', updatePlan);
    $scope.$watch('planYears', updatePlan);
    
})
.directive('planSelect', function(){
    return {
        restrict: 'E',
        scope: {
            'plan': '=',
            'recorderQty': '=',
            'currentPlan':'=?',
            'usage': '=?',
        },
        templateUrl: '/partials/orders/select-plan.html',
        controller: 'PlanSelectionCtrl',
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
.controller('CreateProjectCtrl', function($scope, $http, $modalInstance, $modal, notify, a2order, orderData) {
    console.log(orderData);
    console.log($scope.project);
    console.log($scope.recorderQty);
    
    $scope.project = orderData.project;
    $scope.recorderQty = orderData.recorderQty;
    
    $scope.create = function() {
        console.log($scope.isValid);
        if(!$scope.isValid) return;
        
        if(!$scope.project.plan) {
            return notify.error('You need to select a plan');
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
    
    // $scope.orderNumber = '201507151707';
    // $scope.orderAction = "create-project";
    // $scope.orderData = JSON.parse('{"recorderQty":0,"project":{"is_private":false,"name":"test paid","url":"paid12","description":"lakjs laksj dlajs lkja sldk jalskdj alks djlkasdjglkasjd","plan":{"storage":20000,"cost":600,"processing":2000000},"tier":"paid","project_type_id":1}}');
    // 
    // 
    // $scope.success = true;
    // $scope.processing = false;
    
    $http.post('/api/orders/process/'+orderId+$window.location.search)
        .success(function(data) {
            console.log(data);
            $scope.success = true;
            $scope.invoice = {
                items: data.invoice.item_list.items,
                address: data.invoice.item_list.shipping_address,
                amount: data.invoice.amount,
            };
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
.controller('ChangeProjectPlanCtrl', function($scope, orderData, Project, $window, a2order, $modalInstance, notify) {
    $scope.today = new Date();
    
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
        
        $scope.project.plan = {};
        
        Project.getUsage().success(function(usage) {
            $scope.minUsage = usage.min_usage;
        });
    });
    
    
    $scope.upgrade = function() {
        
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
        
        console.log('review');
        
        orderData = {
            action: 'update-project',
            project: $scope.project,
            recorderQty: $scope.recorderQty,
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
