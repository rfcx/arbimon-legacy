var arbimon2 = angular.module('arbimon2', [
    'templates-arbimon2',
    'dashboard', 
    'audiodata',
    'visualizer', 
    'analysis',
    'jobs',
    'angularytics',
    'ui.router', 
    'ct.ui.router.extras'
])
.run(function($rootScope, Angularytics){
    $rootScope.Math = Math; // export math library to angular :-)
    Angularytics.init();
})
.config(function($urlRouterProvider, AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
    $urlRouterProvider.otherwise("/dashboard");
})
.controller('MainCtrl', function($scope, $state){
    $scope.$state = $state;
});
