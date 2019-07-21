var a2 = angular.module('a2.cs-app', [
    'a2.permissions',
    'templates-arbimon2',
    'a2.app.dashboard',
    'a2.audiodata',
    'a2.visualizer',
    'a2.analysis',
    'a2.citizen-scientist',
    'a2.jobs',
    'a2.directive.sidenav-bar',
    'a2.settings',
    'a2.login',
    'angularytics',
    'ui.router',
    'ct.ui.router.extras',
    'a2.filters',
    'humane',
    'a2.googlemaps',
    'a2.injected.data'
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
            $state.go('citizen-scientist.patternmatching');
        }
        else if(allowed === false){
            e.preventDefault();
            notify.log('You do not have access to this section');
        }
    });
})
.config(function($urlRouterProvider, $locationProvider, AngularyticsProvider, a2GoogleMapsLoaderProvider, a2InjectedData) {
    a2GoogleMapsLoaderProvider.setAPIKey(a2InjectedData.googleAPI.key);
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
    $locationProvider.html5Mode(true);
    $urlRouterProvider.otherwise("/citizen-scientist/patternmatching/");
})
.controller('MainCtrl', function($scope, $state, Project){
    $scope.$state = $state;
    $scope.onCitizenScientistPage = true;
    $scope.getUrlFor = function(page){
        if(page == 'citizen-scientist'){
            return '/citizen-scientist/' + Project.getUrl() + '/';
        }
    }
});
