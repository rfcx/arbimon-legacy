angular.module('a2.analysis.random-forest-models', [
    'ui.router',
    'a2.analysis.random-forest-models.models',
    'a2.analysis.random-forest-models.classification',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.random-forest-models', {
        url: '/random-forest-models',
        template:'<ui-view />',
        abstract:true,
    });
})
;
