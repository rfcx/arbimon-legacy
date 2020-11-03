angular.module('a2.analysis.clustering-jobs', [
  'ui.bootstrap',
  'a2.srv.clustering-jobs',
  'a2.services',
  'a2.permissions',
  'humane',
])
.config(function($stateProvider) {
    $stateProvider.state('analysis.clustering-jobs', {
        url: '/clustering-jobs/',
        controller: 'ClusteringJobsModelCtrl',
        templateUrl: '/app/analysis/clustering-jobs/list.html'
    })
})
.controller('ClusteringJobsModelCtrl' , function($scope, a2ClusteringJobs) {
    $scope.loadClusteringJobs = function() {
        $scope.loading = true;

        return a2ClusteringJobs.list().then(function(data) {
            $scope.clusteringJobsOriginal = data;
            $scope.clusteringJobsData = data;
            $scope.loading = false;
            $scope.infopanedata = "";

            if(data && !data.length) {
                $scope.infopanedata = "No clustering jobs found.";
            }
        });
    };

    $scope.loadClusteringJobs();

    $scope.selectItem = function(clusteringJob) {

    }
})
