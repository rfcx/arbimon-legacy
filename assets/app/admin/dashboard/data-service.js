angular.module('a2.admin.dashboard.data-service', [
])
.service('AdminDashboardDataService', function($q){
    return {
        getPlotData: function(series, from, to, period){
            return $q.when('/admin/plot-data/data.txt?stat='+series+'&q='+period+'&from='+from.getTime()+'&to='+to.getTime());
        },
    };
})
;
