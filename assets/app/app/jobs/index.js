angular.module('a2.jobs', [
    'a2.services',
    'a2.permissions',
])
.config(function($stateProvider) {
    $stateProvider.state('jobs', {
        url: '/jobs',
        controller: 'StatusBarNavController',
        templateUrl: '/app/jobs/index.html'
    });
})
.controller('StatusBarNavIndexController',function($scope, $http, $timeout, JobsData) {
    $scope.$watch(function() {
        return JobsData.getjobLength();
    },
    function() {
        $scope.jobslength = JobsData.getjobLength();
    });
})
.controller('StatusBarNavController', function($scope, $http, $modal, Project, JobsData, notify, a2UserPermit) {
    $scope.show = {};
    $scope.showClassifications = true;
    $scope.showTrainings = true;
    $scope.showSoundscapes = true;
    $scope.url = '';
    $scope.successInfo = "";
    $scope.showSuccesss = false;
    $scope.errorInfo = "";
    $scope.showErrors = false;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.jobs = [];

    $scope.updateFlags = function() {
        $scope.successInfo = "";
        $scope.showSuccess = false;
        $scope.errorInfo = "";
        $scope.showError = false;
        $scope.infoInfo = "";
        $scope.showInfo = false;
    };

    // $scope.cancel = function(job) {
    //     var jobId = job.job_id;
    //     $scope.infoInfo = "Loading...";
    //     $scope.showInfo = true;
    //     if (job.percentage < 100) {
    //         confirm('Cancel','cancel',cancelJob,jobId);
    //     }
    //     else {
    //         cancelJob(jobId);
    //     }
    // };

    // var cancelJob = function(jobId) {
    //     $http.get('/api/project/' + Project.getUrl() + '/jobs/cancel/' + jobId)
    //         .success(function(data) {
    //             if (data.err) {
    //                 notify.serverError();
    //             }
    //             else {
    //                 JobsData.updateJobs();
    //                 notify.log("Job canceled successfully");
    //             }
    //         })
    //         .error(function() {
    //             notify.serverError();
    //         });
    // };

    var hideJob = function(jobId) {
        $http.get('/api/project/' + Project.getUrl() + '/jobs/hide/' + jobId)
            .success(function(data) {
                    JobsData.updateJobs();
                    notify.log("Job hidden successfully");
            })
            .error(function(data) {
                if(data.error) {
                    notify.error(error);
                }
                else {
                    notify.serverError();
                }
            });
    };


    JobsData.getJobTypes().success(function(data) {
        var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528', '#ffff00', '#5bc0de'];
        var job_types_id = [1, 2, 4, 6, 7, 8, 9];

        var job_types = data.filter(function(type) {
            return job_types_id.includes(type.id);
        });

        $scope.job_types = {};
        $scope.job_types.types = job_types;
        $scope.job_types.show = {};
        $scope.job_types.for = {};
        $scope.job_types.types.forEach(function(c, i) {
            $scope.show[c.id] = true;
            $scope.job_types.for[c.id] = c;
            c.color = colors[i % colors.length];
        });
    });


    $scope.$watch(
        function() {
            return JobsData.getJobs();
        },
        function(new_jobs) {
            $scope.jobs = new_jobs;
            JobsData.startTimer();
            $scope.infoInfo = "";
            $scope.showInfo = false;
        },
        true
    );

    $scope.$on('$destroy', function() {
        JobsData.cancelTimer();
    });

    var confirm = function(titlen, action, cb, vl) {
            var modalInstance = $modal.open({
                templateUrl: '/common/templates/pop-up.html',
                controller: function() {
                    this.title = titlen+"running job";
                    this.messages = ["This job has not finished yet. Are you sure?"];
                    this.btnOk = "Yes, "+action+" it";
                    this.btnCancel = "No";
                },
                controllerAs: "popup"
            });

            modalInstance.opened.then(function() {
                $scope.infoInfo = "";
                $scope.showInfo = false;
            });

            modalInstance.result.then(function(ok) {
                cb(vl);
            });
    };

    $scope.hide = function(job) {
        if(!a2UserPermit.can('manage project jobs')) {
            notify.log("You do not have permission to hide jobs");
            return;
        }

        var jobId = job.job_id;

        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        if (job.percentage < 100) {
            confirm('Hide', 'hide', hideJob, jobId);
        }
        else {
            hideJob(jobId);
        }
    };

})
.service('JobsData', function($http, $interval, Project, $q) {
    var jobslength = 0;
    var jobs = [];
    var job_types;
    var url = Project.getUrl();
    var intervalPromise;

    updateJobs = function() {
        $http.get('/api/project/' + url + '/jobs/progress')
            .success(function(data) {
                data.forEach(item => {
                    if (item.job_type_id === 1 && item.completed === 0 && item.state === 'error') {
                        item.state = 'error: insufficient validations';
                    }
                    if (item.job_type_id === 2 && item.completed === 0 && item.state === 'completed') {
                        item.state = 'processing';
                    }
                })
                jobs = data;
                jobslength = jobs.length;
            });
    };
    updateJobs();
  
    return {
        geturl: function() {
            return url;
        },
        getjobLength: function() {
            return jobslength;
        },
        getJobs: function() {
            return jobs;
        },
        getJobTypes: function() {
            return $http.get('/api/jobs/types');
        },
        updateJobs: function() {
            return updateJobs();
        },
        startTimer: function() {
            $interval.cancel(intervalPromise);
            if(typeof jobs != 'undefined' && jobs.length > 0) {
                intervalPromise = $interval(function() {
                    var cancelInterval = true;

                    for (var i = 0; i < jobs.length; i++) {
                        if (jobs[i].percentage < 100) {
                            cancelInterval = false;
                            break;
                        }
                    }

                    if (cancelInterval) {
                        $interval.cancel(intervalPromise);
                    }
                    else if (jobs.length < 1) {
                        $interval.cancel(intervalPromise);
                    }
                    else {
                        updateJobs();
                    }
                }, 5000);
            }

        },
        cancelTimer: function() {
            $interval.cancel(intervalPromise);
        }
    };

});
