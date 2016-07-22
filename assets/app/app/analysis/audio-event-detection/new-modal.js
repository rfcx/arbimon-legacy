angular.module('a2.analysis.audio-event-detection.new-modal', [
    'a2.srv.open-modal',
    'a2.srv.resolve', 
    'a2.srv.playlists',
    'humane',
    'a2.directive.require-non-empty',
    'a2.analysis.audio-event-detection.service',
])
.config(function($openModalProvider){
    $openModalProvider.define('audio-event-detection.new-modal', {
        templateUrl: '/app/analysis/audio-event-detection/new-modal.html',
        controllerAs: 'controller',
        controller: 'NewAudioEventDetectionModalCtrl',
        resolve: {onSubmit: function(){ return null;}}
    });
})
.constant('AudioEventDetectionParametersEditTemplateUrls', {
    fltr: '/app/analysis/audio-event-detection/algorithm-fltr-edit-parameters.html'
})
.controller('NewAudioEventDetectionModalCtrl', function(
    $q, $modalInstance, $promisedResolve, $parse,
    notify,
    AudioEventDetectionParametersEditTemplateUrls,
    onSubmit
){
    this.playlists=[];
    this.algorithmsList=[];
    this.statisticsList=[];
    var getDefaultName = $parse("[" +
        "(playlist.name || '[Playlist]'), " +
        "(algorithm.name || '[Algorithm]'), " + 
        "(parameters ? '(' + (parameters  | asCSV) + ')' : ''), " + 
        "(date | moment:'ll')" + 
    "] | asCSV:' / '");

    this.initialize = function(){
        
        return this.reload().then((function(){
            this.aed = {
                algorithm: this.algorithmsList[0],
                statistics: this.statisticsList.slice(),
                playlist:null,
                date : new Date()
            };
            this.notifyAedAlgorithmChanged();
        }).bind(this));
    };

    this.reload = function(){
        this.loading = true;
        return $promisedResolve({
            playlists: ["a2Playlists", function(a2Playlists){
                return a2Playlists.getList();
            }],
            algorithmsList: function(AudioEventDetectionService){
                return AudioEventDetectionService.getAlgorithmsList();
            },
            statisticsList: function(AudioEventDetectionService){
                return AudioEventDetectionService.getStatisticsList();
            }
        }, this).then((function(){
            this.loading = false;            
        }).bind(this));
    };

    this.notifyAedAlgorithmChanged = function(){
        var algorithm = this.aed.algorithm || {};
        this.aed.parameters = algorithm.defaults || {};
        this.algorithmParametersTemplate = AudioEventDetectionParametersEditTemplateUrls[algorithm.name];
        this.recomputeDefaultName();
    };
    
    this.recomputeDefaultName = function(){
        this.aed.defaultName = getDefaultName(this.aed);
    };

    this.ok = function() {
        return $q.resolve().then((function(){
            return onSubmit && onSubmit(this.aed);
        }).bind(this)).then((function(){
            return $modalInstance.close(this.aed);
        }).bind(this)).catch(function(error){
            notify.error(error);
        });
    };

    this.cancel = function() {
        $modalInstance.dismiss('cancel');
    };

    this.initialize();
})
;