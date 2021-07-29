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
    'a2.injected.data'
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
            notify.log('You do not have access to this section');
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
    $scope.q = '';

    $scope.findProject = function() {
        if (!$scope.q || $scope.q.trim() === '') return;
        if ($scope.q && $scope.q.length < 2) return;
        var config = {
            params: {
                allAccessibleProjects: true
            }
        };
        if ($scope.q !== '') {
            config.params.q = $scope.q;
        }
        $scope.projects = [];
        $scope.isLoading = true;
        return $http.get('/api/user/projectlist', config).then(function(result) {
            $scope.isLoading = false;
            $scope.projects = result.data;
            return result.data;
        })

    };

    $scope.selectProject = function() {
        if (!$scope.q || $scope.q && !$scope.q.is_enabled) {
            return;
        }
        $window.location.assign('/project/' + $scope.q.url + '/');
    };
});
