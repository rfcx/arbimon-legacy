var a2 = angular.module('a2.app', [
    'a2.permissions',
    'templates-arbimon2',
    'a2.audiodata',
    'a2.visualizer',
    'a2.analysis',
    'a2.citizen-scientist',
    'a2.jobs',
    'a2.directive.sidenav-bar',
    'a2.settings',
    'a2.login',
    'ui.router',
    'ct.ui.router.extras',
    'a2.filters',
    'humane',
    'a2.googlemaps',
    'a2.injected.data',
    'a2.directive.search-bar',
    'a2.directive.side-bar'
])
.run(function($rootScope, a2UserPermit, notify, $state) {
    $rootScope.Math = Math; // export math library to angular :-)

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
            $state.go('audiodata');
        }
        else if(allowed === false){
            e.preventDefault();
            notify.error('You do not have access to this section');
        }
    });
})
.config(function($urlRouterProvider, $locationProvider, a2GoogleMapsLoaderProvider, a2InjectedData) {
    a2GoogleMapsLoaderProvider.setAPIKey(a2InjectedData.googleAPI.key);
    $locationProvider.html5Mode(true);
    $urlRouterProvider.otherwise("/audiodata");
})
.controller('MainCtrl', function($scope, $state, Project, a2UserPermit, $window){
    $scope.$state = $state;
    Project.getInfo(function(data) {
        $scope.bioAnalyticsBaseUrl = data.bioAnalyticsBaseUrl
    })
    $scope.getUrlFor = function(page){
        const projectUrl = Project.getUrl()
        if(page == 'citizen-scientist'){
            return '/citizen-scientist/' + projectUrl + '/';
        } else if (page == 'reports') {
            return $scope.bioAnalyticsBaseUrl + '/' + projectUrl
        }
    }
    $scope.citizenScientistUser = a2UserPermit.all && a2UserPermit.all.length === 1 && a2UserPermit.all.includes('use citizen scientist interface') && !a2UserPermit.can('delete project') && !a2UserPermit.isSuper();
});
