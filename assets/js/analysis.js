(function(angular)
{ 
    var analysis = angular.module('analysis', [ 
        'models',
        'classification',
        'soundscapes',
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
            template: '<a2-models></a2-models>'
        })
        .state('analysis.classification', {
            url: '/classification',
            template: '<a2-classification></a2-classification>'
        })
        .state('analysis.soundscapes', {
            url: '/soundscapes',
            template: '<a2-soundscapes></a2-soundscapes>'
        });
    });
}
)(angular);
