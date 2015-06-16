var a2 = angular.module('arbimon2', [
    'templates-arbimon2',
    'a2.dashboard', 
    'a2.audiodata',
    'a2.visualizer', 
    'a2.analysis',
    'a2.jobs',
    'a2.settings',
    'angularytics',
    'ui.router', 
    'ct.ui.router.extras',
    'a2.permissions',
    'humane'
])
.run(function($rootScope, Angularytics, a2UserPermit, notify) {
    $rootScope.Math = Math; // export math library to angular :-)
    Angularytics.init();

    $rootScope.$on('$stateChangeStart', function(e, to) {
        console.log(to);
        
        if(!angular.isFunction(to.allowAccess)) return;
        
        if(!to.allowAccess(a2UserPermit)) {
            e.preventDefault();
            
            notify.log('You do not have access to this section');
        }
    });
})
.config(function($urlRouterProvider, AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
    $urlRouterProvider.otherwise("/dashboard");
})
.controller('MainCtrl', function($scope, $state){
    $scope.$state = $state;
});
