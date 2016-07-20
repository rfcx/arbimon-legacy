angular.module('a2.audiodata', [
    'ui.router', 
    'ct.ui.router.extras',
    'a2.audiodata.sites',
    'a2.audiodata.species',
    'a2.audiodata.uploads',
    'a2.audiodata.recordings',
    'a2.audiodata.training-sets',
    'a2.audiodata.playlists',
    'a2.audiodata.soundscape-composition-classes',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/audiodata", "/audiodata/sites");
    
    $stateProvider.state('audiodata', {
        url: '/audiodata',
        views: {
            'audiodata': {
                templateUrl: '/audiodata/index.html'
            }
        },
        deepStateRedirect: true, 
        sticky: true,
    })
    .state('audiodata.sites', {
        url: '/sites?site&show',
        controller:'SitesCtrl',
        templateUrl: '/audiodata/sites.html'
    })
    .state('audiodata.recordings', {
        url: '/recordings',
        controller: 'RecsCtrl as controller',
        templateUrl: '/audiodata/recordings.html'
    })
    .state('audiodata.species', {
        url: '/species',
        controller:'SpeciesCtrl',
        templateUrl: '/audiodata/species.html'
    })
    .state('audiodata.trainingSets', {
        url: '/training-sets?set&show',
        controller: 'TrainingSetsCtrl as controller',
        templateUrl: '/audiodata/training-sets.html'
    })
    .state('audiodata.playlists', {
        url: '/playlists',
        controller: 'PlaylistCtrl',
        templateUrl: '/audiodata/playlists.html'
    });
})
;
