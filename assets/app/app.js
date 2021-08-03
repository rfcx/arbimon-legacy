try {
    angular.module("angularytics"); // this throws if GA script is not loaded
} catch(e){
    console.error("GA not available, likely adblocker", e);
    (function () {
        angular.module('angularytics', []).provider('Angularytics', function () {
            this.setEventHandlers = function () {
            };
            this.$get = [
                function () {
                    var service = {};
                    service.init = function () {
                    };
                    return service;
                }
            ];
        }).filter('trackEvent', ['Angularytics', function () {
            return function () {
                return null;
            };
        }
      ]);
  }());
}

var a2 = angular.module('a2.app', [
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
    'a2.injected.data',
    'a2.directive.search-bar'
])
.run(function($rootScope, Angularytics, a2UserPermit, notify, $state) {
    $rootScope.Math = Math; // export math library to angular :-)
    Angularytics.init();

    $rootScope.$on('$stateChangeStart', function (e, to, params) {
        if (to.name.startsWith('visualizer')) {
            document.getElementsByTagName('body')[0].classList.add('visualizer-page');
        } else {
            document.getElementsByTagName('body')[0].classList.remove('visualizer-page');
        }

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
.config(function($urlRouterProvider, $locationProvider, AngularyticsProvider, a2GoogleMapsLoaderProvider, a2InjectedData) {
    a2GoogleMapsLoaderProvider.setAPIKey(a2InjectedData.googleAPI.key);
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
    $locationProvider.html5Mode(true);
    $urlRouterProvider.otherwise("/dashboard");
})
.controller('MainCtrl', function($scope, $state, Project, a2UserPermit){
    $scope.$state = $state;
    $scope.getUrlFor = function(page){
        if(page == 'citizen-scientist'){
            return '/citizen-scientist/' + Project.getUrl() + '/';
        }
    }
    $scope.citizenScientistUser = a2UserPermit.all && a2UserPermit.all.length === 1 && a2UserPermit.all.includes('use citizen scientist interface') && !a2UserPermit.can('delete project') && !a2UserPermit.isSuper();

});
