angular.module('a2.orders.order-utils', [
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
            return $http.get('/legacy-api/orders/payments-status', {cache:true});
        },

        checkCouponCode: function(code, project) {
            return $http.post('/legacy-api/orders/check-coupon', {
                hash:code, project:project
            }).then(function(response){
                return response.data;
            });
        },
        
        getOrdersContact: function() {
            return $http.get('/legacy-api/orders/contact', {cache:true});
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
;
