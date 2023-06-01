angular.module('a2.analysis.audio-event-detection', [
    'a2.filter.as-csv',
    'a2.filter.time-from-now',
    'a2.srv.resolve',
    'a2.srv.open-modal',
    'a2.service.audio-event-detection',
    'a2.analysis.audio-event-detection.new-modal',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('analysis.audio-event-detection', {
        url: '/audio-event-detection',
        controller: 'AudioEventDetectionAnalysisStateCtrl as controller',
        templateUrl: '/app/analysis/audio-event-detection/index.html'
    });
})
.controller('AudioEventDetectionAnalysisStateCtrl', function($q, $promisedResolve, $openModal, a2UserPermit){
    this.initialize = function(){
        return this.reload();
    };
        
    this.reload = function(){
        this.loading = true;
        return $promisedResolve({
            audioEventDetectionsList : ["AudioEventDetectionService", function(AudioEventDetectionService){
                return AudioEventDetectionService.getList();
            }]
        }, this).then((function(){
            this.loading = false;
        }).bind(this));
    };

    this.new = function () {
        if(!a2UserPermit.can('manage soundscapes')) {
            notify.error('You do not have permission to create audio event detections.');
            return;
        }
        
        return $openModal('audio-event-detection.new-modal', {
            resolve: { 
                onSubmit : ["AudioEventDetectionService", function(AudioEventDetectionService){
                    return AudioEventDetectionService.new;
                }]
            }
        });
    };
    
    this.initialize();
})
;
