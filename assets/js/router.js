var a2 = angular.module('arbimon2', [
    'a2.permissions',
    'templates-arbimon2',
    'a2.dashboard', 
    'a2.audiodata',
    'a2.visualizer', 
    'a2.analysis',
    'a2.jobs',
    'a2.settings',
    'a2.login',
    'angularytics',
    'ui.router', 
    'ct.ui.router.extras',
    'humane'
])
.run(function($rootScope, Angularytics, a2UserPermit, notify, $state) {
    $rootScope.Math = Math; // export math library to angular :-)
    Angularytics.init();

    $rootScope.$on('$stateChangeStart', function(e, to, params) {
        // only check permissions if state have allowAccess
        if(!angular.isFunction(to.allowAccess)) return;
        
        var allowed = to.allowAccess(a2UserPermit);
        
        if(allowed === undefined) { // if permissions have not loaded go dashboard
            e.preventDefault();
            $state.go('dashboard');
        }
        else if(allowed === false){
            e.preventDefault();
            notify.log('You do not have access to this section');
        }
    });
})
.config(function($urlRouterProvider, $locationProvider, AngularyticsProvider) {
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
    $locationProvider.html5Mode(true);
    $urlRouterProvider.otherwise("/dashboard");
})
.controller('MainCtrl', function($scope, $state){
    $scope.$state = $state;
});
