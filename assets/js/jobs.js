(function(angular) {
    angular.module('a2-job-data', ['a2services', 'a2utils'])
        .service('JobsData', function($http, $interval, Project, $q) {
            var jobslength = 0;
            var jobs = [];
            var job_types;
            var url = Project.getUrl();
            var intervalPromise;
            $http.get('/api/project/' + url + '/progress').success(function(data) {
                jobs = data;
                jobslength = jobs.length;
            });

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
                    var d = $q.defer();
                    if (job_types) {
                        d.resolve(job_types);
                    }
                    else {
                        $http.get('/api/job/types')
                            .success(function(_job_types) {
                                job_types = _job_types;
                                d.resolve(job_types);
                            })
                            .error(function() {
                                d.reject("Could not retrieve job types.");
                            });
                    }
                    return d.promise;
                },
                updateJobs: function() {
                    $http.get('/api/project/' + url + '/progress').success(function(data) {
                        jobs = data;
                        jobslength = jobs.length;
                    });
                },
                startTimer: function() {
                    $interval.cancel(intervalPromise);
                    if (typeof jobs != 'undefined' && jobs.length > 0) {
                        intervalPromise =
                            $interval(function() {
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
                                else
                                    $http.get('/api/project/' + url + '/progress')
                                    .success(
                                        function(data) {
                                            jobs = data;
                                            jobslength = jobs.length;
                                        }
                                    );
                            }, 1000);
                    }

                },
                cancelTimer: function() {
                    $interval.cancel(intervalPromise);
                }
            };

        });

    angular.module('jobs', ['a2services', 'a2-job-data'])
        .config(function($stateProvider) {
            $stateProvider.state('jobs', {
                url: '/jobs',
                controller: 'StatusBarNavController',
                templateUrl: '/partials/jobs/index.html'
            });
        })
        .controller('StatusBarNavIndexController',
            function($scope, $http, $timeout, JobsData) {
                $scope.$watch(
                    function() {
                        return JobsData.getjobLength();
                    },
                    function() {
                        $scope.jobslength = JobsData.getjobLength();

                    }
                );
            }
        )

    .controller('StatusBarNavController', function($scope, $http, $modal, Project, JobsData, notify) {
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


        var hideJob = function(jobId) {
            $http.get('/api/project/' + Project.getUrl() + '/job/hide/' + jobId)
                .success(
                    function(data) {
                        if (data.err) {
                            notify.serverError();
                        }
                        else {
                            JobsData.updateJobs();
                            notify.log("Job hidden successfully");
                        }
                    }
                )
                .error(function() {
                    notify.serverError();
                });
        };


        JobsData.getJobTypes().then(function(job_types) {
            // TODO use CSS classes instead of hard coded colors
            var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528']; 

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

        $scope.hide = function(job) {

            var jobId = job.job_id;

            $scope.infoInfo = "Loading...";
            $scope.showInfo = true;

            if (job.percentage < 100) {

                $scope.popup = {
                    title: "Hide running job",
                    messages: ["This job has not finished yet. Are you sure?"],
                    btnOk: "Yes, hide it",
                    btnCancel: "No"
                };

                var modalInstance = $modal.open({
                    templateUrl: '/partials/pop-up.html',
                    scope: $scope
                });

                modalInstance.opened.then(function() {
                    $scope.infoInfo = "";
                    $scope.showInfo = false;
                });

                modalInstance.result.then(function(ok) {
                    if (ok) {
                        hideJob(jobId);
                    }
                });
            }
            else {
                hideJob(jobId);
            }
        };
        
    });
})(angular);
