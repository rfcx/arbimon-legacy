angular.module('a2.analysis.cnn', [
    'ui.bootstrap',
//    'a2.srv.patternmatching',
    'a2.services',
    'a2.permissions',
    'humane',
    'c3-charts',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.cnn', {
        url: '/cnn/:cNN??show',
        controller: 'CNN',
        templateUrl: '/app/analysis/cnn/list.html'
    });
})
.controller('CNN' , function($scope, $modal, $filter, Project, ngTableParams, JobsData, a2Playlists, notify, $q, a2UserPermit, $state, $stateParams) {

})