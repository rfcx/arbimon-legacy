(function(angular)
{ 
    var analysis = angular.module('a2.analysis', [ 
        'a2.analysis.models',
        'a2.analysis.classification',
        'a2.analysis.soundscapes',
        'ui.router', 
        'ct.ui.router.extras'
    ]);
    
    var template_root = '/partials/analysis/';
    
    analysis.config(function($stateProvider, $urlRouterProvider) {
        
        $urlRouterProvider.when("/analysis", "/analysis/models");
         
         $stateProvider.state('analysis', {
            url: '/analysis',
            views: {
                'analysis': {
                    templateUrl: '/partials/analysis/index.html'
                }
            },
            deepStateRedirect: true, 
            sticky: true,
        })
        .state('analysis.models', {
            url: '/models',
            controller: 'ModelsCtrl',
            templateUrl: '/partials/models/list.html'
        })
        .state('analysis.modeldetails', {
            url: '/model/:modelId',
            controller: 'ModelDetailsCtrl',
            templateUrl: '/partials/models/modelinfo.html'
        })
        .state('analysis.classification', {
            url: '/classification',
            controller: 'ClassificationCtrl',
            templateUrl: '/partials/classification/list.html'
        })
        .state('analysis.soundscapes', {
            url: '/soundscapes',
            controller: 'SoundscapesCtrl as controller',
            templateUrl: '/partials/soundscapes/list.html'
        });
    });
}
)(angular);
