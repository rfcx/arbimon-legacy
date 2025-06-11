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
.controller('StatusBarNavController', function($scope, $http, $modal, $window, Project, JobsData, notify, a2UserPermit) {
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
    $scope.loading = {jobs: false}
    $scope.loading.jobs = true
    $scope.updateFlags = function() {
        $scope.successInfo = "";
        $scope.showSuccess = false;
        $scope.errorInfo = "";
        $scope.showError = false;
        $scope.infoInfo = "";
        $scope.showInfo = false;
    };

    Project.getInfo(function(info){
        $scope.project = info;
    });

    var hideJob = function(jobId, action) {
        $http.get('/legacy-api/project/' + Project.getUrl() + '/jobs/hide/' + jobId)
            .success(function(data) {
                    JobsData.updateJobs();
                    const message = 'Job ' + action + ' successfully.'
                    notify.log(message);
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
        var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528', '#ffff00', '#5bc0de', '#80BDFF'];
        var job_types_id = [1, 2, 4, 6, 7, 8, 9, 10];
        
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
            $scope.loading.jobs = false
            JobsData.startTimer();
            $scope.infoInfo = "";
            $scope.showInfo = false;
        },
        true
    );

    $scope.$on('$destroy', function() {
        JobsData.cancelTimer();
    });

    $scope.showActiveJobs = function () {
        return !$scope.loading.jobs && $scope.jobs !== undefined && $scope.jobs.length
    }

    $scope.showEmptyList = function () {
        return !$scope.loading.jobs && $scope.jobs !== undefined && !$scope.jobs.length
    }

    $scope.showLoader = function () {
        return $scope.jobs === undefined
    }

    var confirm = function(titlen, action, cb, vl, message) {
            var modalInstance = $modal.open({
                templateUrl: '/common/templates/pop-up.html',
                controller: function() {
                    this.title = titlen + ' running job';
                    this.messages = ["This job has not finished yet. Are you sure?"];
                    this.btnOk = 'Cancel';
                    this.btnCancel = 'Close';
                },
                controllerAs: "popup",
                windowClass: 'modal-element width-490'
            });

            modalInstance.opened.then(function() {
                $scope.infoInfo = "";
                $scope.showInfo = false;
            });

            modalInstance.result.then(function(ok) {
                cb(vl, message);
            });
    };

    $scope.hide = function(job) {
        if (!a2UserPermit.can('manage project jobs') || (a2UserPermit.can('manage project jobs') && !a2UserPermit.can('export report'))) {
            notify.error('You do not have permission to hide or cancel jobs');
            return;
        }

        const jobId = job.job_id;

        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        if (job.percentage < 100) {
            confirm('Cancel', 'cancel', hideJob, jobId, 'canceled');
        }
        else {
            hideJob(jobId, 'hidden');
        }
    };

    $scope.isCompleted = function (row) {
        return row.state === 'completed'
    }

    $scope.isProcessing = function (row) {
        return row.state === 'processing'
    }

    $scope.isWaiting = function (row) {
        return row.state === 'waiting'
    }

    $scope.openJob = function (row) {
        $window.location.href = '/project/' + Project.getUrl() + '/analysis/' + row.url
    }
})
.service('JobsData', function($http, $interval, Project, $q) {
    var jobs;
    var url = Project.getUrl();
    var intervalPromise;
    var isProcessing = false;

    updateJobs = function() {
        if (isProcessing) return
        isProcessing = true;
        $http.get('/legacy-api/project/' + url + '/jobs/progress', { params: { last3Months: true } })
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
                isProcessing = false
            });
    };
    updateJobs();

    return {
        geturl: function() {
            return url;
        },
        getJobs: function() {
            return jobs;
        },
        getJobTypes: function() {
            return $http.get('/legacy-api/jobs/types');
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
                }, 30000);
            }

        },
        cancelTimer: function() {
            $interval.cancel(intervalPromise);
        }
    };

});
