angular.module('dashboard',['a2services'])
.config(function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.when("/dashboard", "/dashboard/summary");
    
    $stateProvider.state('dashboard.summary', {
        url: '/summary',
        controller:'SummaryCtrl',
        templateUrl: '/partials/dashboard/summary.html'
    })
    .state('dashboard.sites', {
        url: '/sites',
        templateUrl: '/partials/dashboard/sites.html'
    })
    .state('dashboard.species', {
        url: '/species',
        templateUrl: '/partials/dashboard/species.html'
    })
    .state('dashboard.settings', {
        url: '/settings',
        templateUrl: '/partials/dashboard/settings.html'
    })
    .state('dashboard.users', {
        url: '/users',
        templateUrl: '/partials/dashboard/users.html'
    })

})
.controller('SummaryCtrl', function($scope, ProjectInfo) {
    ProjectInfo.get(function(info){
         $scope.project = info;
    });
});
