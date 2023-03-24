angular.module('a2.analysis', [
    'a2.analysis.patternmatching',
    'a2.directive.audio-bar',
    'a2.analysis.random-forest-models',
    'a2.analysis.cnn',
    'a2.analysis.soundscapes',
    'a2.analysis.audio-event-detection',
    'a2.analysis.audio-event-detections-clustering',
    'a2.analysis.clustering-jobs',
    'ui.router',
    'ct.ui.router.extras',
    'a2.srv.api'
]).config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/analysis", "/analysis/patternmatching", "/analysis/clustering-jobs");
    $stateProvider.state('analysis', {
        url: '/analysis',
        views: {
            'analysis': {
                controller: 'AnalysisIndexCtrl as controller',
                templateUrl: '/app/analysis/index.html'
            }
        },
        deepStateRedirect: true,
        sticky: true,
    });
}).controller('AnalysisIndexCtrl', function(
    a2APIService,
    $scope
){})
;
