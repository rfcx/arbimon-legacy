var a2 = angular.module('a2.visualizer-app', [
    'a2.permissions',
    'templates-arbimon2',
    'a2.visualizer',
    'angularytics',
    'ui.router',
    'ct.ui.router.extras',
    'a2.filters',
    'humane',
    'a2.googlemaps',
    'a2.injected.data',
    'a2.directive.search-bar'
])
.run(function($rootScope, Angularytics, a2UserPermit, notify, $state) {
    $rootScope.Math = Math; // export math library to angular :-)
    Angularytics.init();

    $rootScope.$on('$stateChangeStart', function(e, to, params) {
        // only check permissions if state have allowAccess
        if(!angular.isFunction(to.allowAccess)) return;

        var allowed = to.allowAccess(a2UserPermit);

        if(!allowed) { // if permissions have not loaded go dashboard
            e.preventDefault();
            notify.error('You do not have access to this section');
        }
    });
})
.config(function($urlRouterProvider, $locationProvider, AngularyticsProvider, a2GoogleMapsLoaderProvider, a2InjectedData) {
    a2GoogleMapsLoaderProvider.setAPIKey(a2InjectedData.googleAPI.key);
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
    $locationProvider.html5Mode(true);
    $urlRouterProvider.otherwise("/visualizer");
})
.controller('MainCtrl', function($scope, $state, Project, $http, $window){
    $scope.$state = $state;
    $scope.getUrlFor = function(page){
        if(page == 'visualizer'){
            return '/visualizer/' + Project.getUrl() + '/';
        }
    }

});
