angular.module('admin', ['ui.bootstrap','angularytics']).
config(function(AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
}).
run(function(Angularytics) {
    Angularytics.init();
})
.controller('AdminCtrl', function($scope, $http, $interval) { 
    
    $interval(function(){ 
        $http.get('/admin/job-queue')
        .success(function(data) {
            $scope.jobsStatus = data;
        });
        
        $http.get('/admin/active-jobs')
        .success(function(data) {
            $scope.activeJobs = data;
        });
    }, 1000);
    
    
});
