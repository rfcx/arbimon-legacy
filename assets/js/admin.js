angular.module('admin', [
    'ui.router', 
    'ui.bootstrap', 
    'a2utils',
    'templates-arbimon2',
    'humane',
    'ui.select',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise("/projects");
    
    $stateProvider
        .state('projects', {
            url: '/projects',
            controller:'AdminProjectsCtrl',
            templateUrl: '/partials/admin/projects.html'
        })
        .state('users', {
            url: '/users',
            controller:'AdminUsersCtrl',
            templateUrl: '/partials/admin/users.html'
        })
        .state('jobs', {
            url: '/jobs',
            controller:'AdminJobsCtrl',
            templateUrl: '/partials/admin/jobs.html'
        });
})
.controller('AdminJobsCtrl', function($scope, $http, $interval) {
    
    var getJobQueueInfo = function(argument) {
        $http.get('/admin/job-queue')
            .success(function(data) {
                $scope.jobsStatus = data;
            });
    };
    
    $scope.findJobs = function() {
        
        var query = {};
        var getTags = /(\w+):["'](.+)["']|(\w+):([\w\-]+)/g;
        
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
        
        console.log($scope.params.search);
        console.table(query);
        
        $http.get('/admin/jobs', {
                params: query
            })
            .success(function(data) {
                // $scope.activeJobs = data;
                console.log(query);
            });
    };
    
    $scope.params = {};
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
    ];
    
    getJobQueueInfo();
    // findJobs();
    
    
    $http.get('/api/job/types')
        .success(function(jobTypes) {
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
    

    
    $scope.queueLoop = $interval(function() {
        getJobQueueInfo();
    }, 5000);
    // 
    // $scope.jobsLoop = $interval(function() {
    //     findJobs();
    // }, 5000);
    
    // kill loops after page is exited
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.queueLoop);
        // $interval.cancel($scope.jobsLoop);
    });
})
.controller('AdminProjectsCtrl', function($scope, $http, notify) {
    $scope.loadProject = function() {
        $http.get('/admin/projects')
            .success(function(data) {
                $scope.projects = data;
            });
    };
        
    $scope.getProjectInfo = function(project) {
        $http.get('/api/project/'+project.url+'/info')
            .success(function(data) {
                
                data.is_enabled = !!data.is_enabled;
                $scope.currentProject = data;
                
            });
            
        $http.get('/api/project/'+project.url+'/sites')
            .success(function(data) {
                $scope.sites = data;
            });
            
        $http.get('/api/project/'+project.url+'/recordings/count')
            .success(function(data) {
                $scope.recCount = data.count;
            });
        
    };
    
    $scope.updateProject = function() {
        $http.put('/admin/projects/' + $scope.currentProject.project_id, 
            {
                project: $scope.currentProject
            })
            .success(function(data) {
                $scope.loadProject();
                notify.log('project updated');
            })
            .error(function(data) {
                notify.error(data);
            });
    };
    
    $scope.closeProjectInfo = function() {
        $scope.currentProject = null;
    };
    
    $scope.loadProject();
})
.controller('AdminUsersCtrl', function($scope, $http) {
    $http.get('/admin/users')
        .success(function(data) {
            $scope.users = data;
        });
})
;
