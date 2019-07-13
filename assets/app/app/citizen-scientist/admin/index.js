angular.module('a2.citizen-scientist.admin', [
    'ui.router',
    'a2.citizen-scientist.admin.classification-stats',
    'a2.citizen-scientist.admin.user-stats',
    'a2.citizen-scientist.admin.settings',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('citizen-scientist.admin', {
        url: '/admin',
        template:'<ui-view />',
        abstract:true,
    });
})
;
