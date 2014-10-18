var arbimon2 = angular.module('arbimon2', ['ui.router', 'visualizer', 'dashboard' ,'models','classification', 'a2services'])
.config(function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise("/dashboard");

    $stateProvider.state('dashboard', {
        url: '/dashboard',
        templateUrl: '/partials/dashboard/index.html',
    })
    .state('audiodata', {
        url: '/audiodata',
        templateUrl: '/partials/audiodata/index.html'
    })
    .state('visualizer', {
        url: '/visualizer/:recording',
        controller : 'VisualizerCtrl',
        reloadOnSearch : false,
        template: '<a2-visualizer></a2-visualizer>'
    })
    .state('models', {
        url: '/models',
        template: '<a2-models></a2-models>'
    })
    .state('classify', {
        url: '/classify',
        template: '<a2-classification></a2-classification>'
    });
})
.controller('ProgressController',
    function ($scope,$http,Project)
    {
        $scope.showButtonProgress = true;
        $scope.showProgressBar =
        function()
        {
            var p = Project.getInfo(
            function(data)
            {                
                $http.get('/api/project/'+data.url+'/progress')
                .success
                (
                    function(data) 
                    {
                        $scope.jobs = data;
                        $(".progressbar").height(250);
                        $scope.showButtonProgress = false;
                        /*
                        $scope.interval = setInterval(
                        function()
                        {
                            $http.get('/api/project/'+data.url+'/progress')
                            .success
                            (
                            function(data) 
                            {
                                $scope.jobs = data;
                            }
                            );
                        }, 2500);*/
                     }
                );
            });

        };
        
        $scope.closeProgressBar =
        function()
        {
           // clearInterval( $scope.interval);
            $(".progressbar").height(30);
            $scope.showButtonProgress = true;
        };
    }
);
