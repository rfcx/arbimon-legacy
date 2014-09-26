var starter = angular.module('starter', ['ui.router','controllerModule'])
.config(function($stateProvider, $urlRouterProvider) {

  $stateProvider
    .state('dashboard', {
      url: '/dashboard',
       template: '<h4>DASHBOARD</h4>'
    })
     .state('audiodata', {
      url: '/audiodata',
      template: '<h4>AUDIO DATA</h4>'
    })
     .state('visualizer', {
      url: '/visualizer',
      template: '<h4>VISUALIZER</h4>'
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
