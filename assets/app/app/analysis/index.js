angular.module('a2.analysis', [
    'a2.analysis.models',
    'a2.analysis.classification',
    'a2.analysis.patternmatching',
    'a2.analysis.cnn',
    'a2.analysis.soundscapes',
    'a2.analysis.audio-event-detection',
    'ui.router',
    'ct.ui.router.extras'
]).config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/analysis", "/analysis/models");
    $stateProvider.state('analysis', {
        url: '/analysis',
        views: {
            'analysis': {
                templateUrl: '/app/analysis/index.html'
            }
        },
        deepStateRedirect: true,
        sticky: true,
    });
})
;
