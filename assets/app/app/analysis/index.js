angular.module('a2.analysis', [
    'a2.analysis.models',
    'a2.directive.audio-bar',
    'a2.analysis.classification',
    'a2.analysis.patternmatching',
    'a2.analysis.cnn',
    'a2.analysis.soundscapes',
    'a2.analysis.audio-event-detection',
    'a2.analysis.audio-event-detections-clustering',
    'a2.analysis.clustering-jobs',
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
