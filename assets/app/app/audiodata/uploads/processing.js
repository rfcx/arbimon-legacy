angular.module('a2.audiodata.uploads.processing', [
    'a2.services', 
    'a2.srv.uploads',
    'a2.directives', 
    'ui.bootstrap', 
    'angularFileUpload',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('audiodata.uploads.processing', {
        url: '/processing',
        controller: 'A2AudioDataUploadsProcessingCtrl as controller',
        templateUrl: '/app/audiodata/uploads/processing.html'
    });
})
.controller('A2AudioDataUploadsProcessingCtrl', function($scope, a2UploadsService) { 
    this.loadPage = function(){
        this.loading = true;
        a2UploadsService.getProcessingList().then((function(data){
            this.loading = false;
            this.list = data.list;
            this.count = data.count;
        }).bind(this));
    };
    
    this.loadPage();
})
;
