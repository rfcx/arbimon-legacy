angular.module('a2.audiodata.uploads', [
    'ui.router', 
    'a2.audiodata.uploads.upload',
    'a2.audiodata.uploads.processing',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('audiodata.uploads', {
        url: '/uploads',
        template:'<ui-view />',
        abstract:true,
    });
})
;
