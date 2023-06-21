angular.module('a2.audiodata', [
    'ui.router',
    'ct.ui.router.extras',
    'a2.directive.sidenav-bar',
    'a2.directive.audio-bar',
    'a2.audiodata.sites',
    'a2.audiodata.species',
    'a2.audiodata.uploads',
    'a2.audiodata.recordings',
    'a2.audiodata.training-sets',
    'a2.audiodata.playlists',
    'a2.audiodata.templates',
    'a2.audiodata.soundscape-composition-classes',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/audiodata", "/audiodata/sites");

    $stateProvider.state('audiodata', {
        url: '/audiodata',
        views: {
            'audiodata': {
                controller: 'AudiodataIndexCtrl as controller',
                templateUrl: '/app/audiodata/index.html'
            }
        },
        deepStateRedirect: true,
        sticky: true,
    })
    .state('audiodata.sites', {
        url: '/sites?site&show',
        controller:'SitesCtrl',
        templateUrl: '/app/audiodata/sites.html'
    })
    .state('audiodata.species', {
        url: '/species',
        controller:'SpeciesCtrl',
        templateUrl: '/app/audiodata/species.html'
    })
    .state('audiodata.trainingSets', {
        url: '/training-sets?set&show',
        controller: 'TrainingSetsCtrl as controller',
        templateUrl: '/app/audiodata/training-sets.html'
    });
}).controller('AudiodataIndexCtrl', function(
    $scope,
    Project,
    a2UserPermit
){
    Project.getInfo(function(info){
        $scope.project = info;
    });
})
;
