angular.module('audiodata', [
    'ui.router', 
    'ct.ui.router.extras',
    'audiodata.sites',
    'audiodata.species',
    'audiodata.uploads',
    'audiodata.recordings',
    'audiodata.training-sets',
    'audiodata.playlists'
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/audiodata", "/audiodata/sites");

    $stateProvider.state('audiodata', {
        url: '/audiodata',
        views: {
            'audiodata': {
                templateUrl: '/partials/audiodata/index.html'
            }
        },
        deepStateRedirect: true, 
        sticky: true,
    })
    .state('audiodata.sites', {
        url: '/sites',
        controller:'SitesCtrl',
        templateUrl: '/partials/audiodata/sites.html'
    })
    .state('audiodata.recordings', {
        url: '/recordings',
        controller: 'RecsCtrl',
        templateUrl: '/partials/audiodata/recordings.html'
    })
    .state('audiodata.uploads', {
        url: '/uploads',
        controller: 'UploadCtrl',
        templateUrl: '/partials/audiodata/upload.html'
    })
    .state('audiodata.species', {
        url: '/species',
        controller:'SpeciesCtrl',
        templateUrl: '/partials/audiodata/species.html'
    })
    .state('audiodata.trainingSets', {
        url: '/training-sets',
        controller: 'TrainingSetsCtrl',
        templateUrl: '/partials/audiodata/training-sets.html'
    })
    .state('audiodata.playlists', {
        url: '/playlists',
        controller: 'PlaylistCtrl',
        templateUrl: '/partials/audiodata/playlists.html'
    });
})
;
