angular.module('a2.admin.jobs', [
    'ui.router', 
    'templates-arbimon2',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise("/dashboard");
    
    $stateProvider
        .state('jobs', {
            url: '/jobs',
            controller:'AdminJobsCtrl',
            templateUrl: '/admin/jobs/index.html'
        });
})
.controller('AdminJobsCtrl', function($scope, $http, $interval, Project) {
    
    var getJobQueueInfo = function(argument) {
        $http.get('/admin/job-queue')
            .success(function(data) {
                $scope.jobsStatus = data;
            });
    };
    
    $scope.findJobs = function() {
        var query = {};
        var getTags = /(\w+):["'](.+)["']|(\w+):([\w\-]+)/g;
        
        if($scope.params.search) {
            // iterate over getTags results
            $scope.params.search.replace(getTags, function(match, key1, value1, key2, value2) {
                // key1 matches (\w+):["'](.+)["']
                // key2 matches (\w+):([\w\-]+)
                
                var key = key1 ? key1 : key2;
                var value = value1 ? value1 : value2;
                
                if(!query[key]) 
                    query[key] = [];
                
                query[key].push(value);
            });
        }
        
        if($scope.params.states) {
            query.states = $scope.params.states.map(function(s) { return s.name; });
        }
        if($scope.params.types) {
            query.types = $scope.params.types.map(function(t) { return t.id; });
        } 
        
        $http.get('/admin/jobs', {
                params: query
            })
            .success(function(data) {
                $scope.activeJobs = data;
                // console.log(query);
            });
    };
    
    $scope.initParams = function() {
        $scope.params = {
            search: "is:visible "
        };
    };
    
    
    $scope.job_types = [];
    $scope.states = [
        {
            name: 'waiting',
            color: 'black',
            show: true
        },
        {
            name: 'initializing',
            color: 'blue',
            show: true
        },
        {
            name: 'ready',
            color: '#007777',
            show: true
        },
        {
            name: 'processing',
            color: 'olive',
            show: true
        },
        {
            name: 'completed',
            color: 'green',
            show: false
        },
        {
            name: 'error',
            color: 'red',
            show: true
        },
        {
            name: 'canceled',
            color: 'gray',
            show: false
        },
        {
            name: 'stalled',
            color: 'gray',
            show: false
        },
    ];
    
    $scope.initParams();
    getJobQueueInfo();
    
    
    $http.get('/legacy-api/jobs/types')
        .success(function(jobTypes) {
            var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528'];
            
            $scope.colors = {};
            
            for(var i = 0; i < jobTypes.length; i++) {
                
                var t = jobTypes[i];
                $scope.colors[t.name] = colors[i % colors.length];
            }
            
            $scope.job_types = jobTypes;
        });
    

    $scope.findJobs();
    
})
;
