angular.module('a2.orders.project-order-service', [
])
.factory("ProjectOrderService", function($q, $filter, $http){
    var currencyFilter = $filter('currency');
    return {
        placeOrder: function(orderData){
            if(!/(create|update)-project/.test(orderData.action)){
                return $q.reject("Invalid action " + orderData.action);
            }
            var data = angular.merge({}, orderData);
            delete data.action;
            return $http.post('/api/orders/'+orderData.action, orderData);
        },
        makeOrder: function(action, project, recorderQty, settings){
            console.log("makeOrder", action, project, recorderQty, settings);
            if(!project || !project.plan) {
                return $q.reject(new Error('You need to select a plan'));
            }

            var isPaidProject = project.plan.tier == 'paid';
            var coupon = project.plan.coupon && project.plan.coupon.valid ? project.plan.coupon: undefined;
            settings.recorderCost = settings.recorderCost || 125;
            settings.projectCostLimit = settings.projectCostLimit || 10000;

            if(coupon){
                project = angular.merge({}, project);
                delete project.plan;                
            } else if(isPaidProject){
                if(!settings.autoPaymentsEnabled){
                    return $q.reject(new Error('Payments are unavailable'));
                }
                // don't process orders over $10,000
                if(project.plan.cost + (recorderQty * settings.recorderCost) > settings.projectCostLimit){
                    return $q.reject(new Error('Cannot process order greater than ' + currencyFilter(settings.projectCostLimit)));
                }
            }
            
            

            return $q.resolve({
                hasCoupon : !!coupon,
                isPaidProject : isPaidProject,
                data:{
                    action: action,
                    coupon : coupon ? coupon.hash : undefined,
                    project: project,
                    recorderQty: recorderQty,
                }
            });
        }
    };
})
;