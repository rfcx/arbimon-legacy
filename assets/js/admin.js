angular.module('admin', ['ui.bootstrap', 'a2utils'])
    .controller('AdminCtrl', function($scope, $http, $interval) {
        
        var getJobQueueInfo = function(argument) {
            $http.get('/admin/job-queue')
                .success(function(data) {
                    $scope.jobsStatus = data;
                });
        };
        
        var getActiveJobs = function(argument) {
            $http.get('/admin/active-jobs')
                .success(function(data) {
                    $scope.activeJobs = data;
                });
        };
        
        
        getJobQueueInfo();
        getActiveJobs();
        
        $http.get('/api/job/types')
            .success(function(jobTypes) {
                // TODO use CSS classes instead of hard coded colors
                var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528'];
                
                $scope.show = {};
                $scope.colors = {};
                
                for(var i = 0; i < jobTypes.length; i++) {
                    var t = jobTypes[i];
                    $scope.show[t.id] = true;
                    $scope.colors[t.id] = colors[i % colors.length];
                }
                
                $scope.job_types = jobTypes;
            });
        
        // TODO use CSS classes instead of hard coded colors
        $scope.states = {
            waiting: {
                color: 'black',
                show: true
            },
            initializing: {
                color: 'blue',
                show: true
            },
            ready: {
                color: '#007777',
                show: true
            },
            processing: {
                color: 'olive',
                show: true
            },
            completed: {
                color: 'green',
                show: false
            },
            error: {
                color: 'red',
                show: true
            },
            canceled: {
                color: 'gray',
                show: false
            },
        };

        $interval(function() {
            getJobQueueInfo();
        }, 5000);
        
        $interval(function() {
            getActiveJobs();
        }, 5000);

    });
