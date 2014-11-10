var arbimon2 = angular.module('arbimon2', [
    'templates-arbimon2',
    'ui.router', 
    'visualizer', 
    'dashboard', 
    'audiodata',
    'models',
    'classification',
    'jobs'
])
.config(function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider
        .rule(function ($injector, $location) {
            var m, path = $location.path();
            if(m=/visualizer\/?(.*)/.exec(path)){
                var params = {location:m[1]};
                $injector.invoke(function($state){ 
                    $state.go('visualizer', params, {location:false}); 
                });
                return m[0];
            }
        })
        .otherwise("/dashboard")
    ;
    
    $stateProvider.state('dashboard', {
        url: '/dashboard',
        templateUrl: '/partials/dashboard/index.html',
    })
    .state('audiodata', {
        url: '/audiodata',
        templateUrl: '/partials/audiodata/index.html'
    })
    .state('visualizer', {
        url: '/visualizer',
        params : {location:''},
        reloadOnSearch : false,
        template: '<a2-persistent name="visualizer"><a2-visualizer></a2-visualizer></a2-persistent>'
    })
    .state('models', {
        url: '/models',
        template: '<a2-models></a2-models>'
    })
    .state('classify', {
        url: '/classify',
        template: '<a2-classification></a2-classification>'
    })
    .state('jobs', {
        url: '/jobs',
        controller : 'StatusBarNavController' ,
        templateUrl: '/partials/jobs/index.html'
    });
});
