var arbimon2 = angular.module('arbimon2', ['ui.router', 'visualizer', 'dashboard'])
.config(function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise("/dashboard");

    $stateProvider.state('dashboard', {
        url: '/dashboard',
        templateUrl: '/partials/dashboard/index.html',
    })
    .state('audiodata', {
        url: '/audiodata',
        template: '<h4>AUDIO DATA</h4>'
    })
    .state('visualizer', {
        url: '/visualizer',
        controller : 'VisualizerCtrl',
        template: '<a2-visualizer></a2-visualizer>'
    })
    .state('models', {
        url: '/models',
        template: '<h4>MODELS</h4>'
    })
    .state('classify', {
        url: '/classify',
        template: '<h4>CLASSIFY</h4>'
    });
});
