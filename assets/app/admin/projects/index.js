angular.module('a2.admin.projects', [
    'ui.router', 
    'templates-arbimon2',
    'a2.admin.projects.list',
    'a2.admin.projects.codes',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise("/dashboard");
    
    $stateProvider
        .state('projects', {
            url: '/projects',
            abstract:true,
            templateUrl: '/admin/projects/index.html'
        });
})
;
