angular.module('a2.citizen-scientist', [
    'a2.citizen-scientist.my-stats',
    'a2.citizen-scientist.patternmatching',
    'a2.citizen-scientist.admin',
    'ui.router',
    'ct.ui.router.extras'
]).config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/citizen-scientist", "/citizen-scientist/patternmatching/");
    $stateProvider.state('citizen-scientist', {
        url: '/citizen-scientist',
        views: {
            'citizen-scientist': {
                templateUrl: '/app/citizen-scientist/index.html'
            }
        },
        deepStateRedirect: true,
        sticky: true,
    });
})
;
