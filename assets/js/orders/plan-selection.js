angular.module('a2.orders.plan-selection', [
    'countries-list',
    'ui.bootstrap',
    'humane',
    'a2.directives',
    'a2.services',
])
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
    this.hasCouponCode = false;
    this.planData = {
        yearOptions: [1,2,3,4,5,6,7,8,9,10]
    };
    
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
        if($scope.plan) {
            if($scope.plan.storage)
                $scope.planMinutes = $scope.plan.storage;
            
            if($scope.plan.duration)
                $scope.planYears = $scope.plan.duration;
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
            $scope.plan.duration =  undefined;
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
    this.updatePlan = updatePlan;
    $scope.$watch('planMinutes', updatePlan);
    $scope.$watch('planYears', updatePlan);
    
})
.directive('planSelect', function(){
    return {
        restrict: 'E',
        scope: {
            'plan': '=',
            'recorderQty': '=',
            'availablePlans' : '=',
            'ordersContact': '=',
            'autoPaymentsEnabled':'=',
            'currentPlan':'=?',
            'usage': '=?',
        },
        templateUrl: '/partials/orders/select-plan.html',
        controller: 'PlanSelectionCtrl as controller',
    };
})
;
