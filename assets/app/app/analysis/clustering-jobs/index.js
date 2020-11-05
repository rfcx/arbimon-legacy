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
.controller('ClusteringJobsModelCtrl' , function($scope, a2ClusteringJobs, JobsData, notify, $location, $modal) {
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

    $scope.createNewClusteringJob = function () {
        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/clustering-jobs/new-clustering-job.html',
            controller: 'CreateNewClusteringJobCtrl as controller',
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.create) {
                JobsData.updateJobs();
                notify.log("Your new clustering job is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };
})
.controller('CreateNewClusteringJobCtrl', function($modalInstance, a2ClusteringJobs, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                jobs: false
            };

            var list = this.list = {};

            this.data = {
                name: null,
                aed_job: {},
                params: {
                    minPoints: 2,
                    distanceThreshold: 10
                }
            };

            this.loading.jobs = true;
            a2ClusteringJobs.audioEventDetections().then((function(jobs){
                this.loading.jobs = false;
                list.jobs = jobs.map(job => {
                    return {
                        name: job.name,
                        jobId: job.job_id
                    }
                });
            }).bind(this));
        },
        create: function () {
            try {
                return a2ClusteringJobs.create({
                    name: this.data.name,
                    aed_job: this.data.aed_job,
                    params: this.data.params
                }).then(function(clusteringModel) {
                    $modalInstance.close({create:true, clusteringModel: clusteringModel});
                }).catch(notify.serverError);
            } catch(error) {
                console.error("a2ClusteringJobs.create error: " + error);
            }
        },
        cancel: function (url) {
            $modalInstance.close({ cancel: true, url: url });
        },
        isJobValid: function () {
            return this.data && this.data.name && this.data.name.length > 3 && this.data.aed_job;
        }
    });
    this.initialize();
  })
