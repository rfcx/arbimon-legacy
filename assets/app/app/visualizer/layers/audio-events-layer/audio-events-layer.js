angular.module('a2.visualizer.layers.audio-events-layer', [
])
.config(function(layer_typesProvider){
    layer_typesProvider.addLayerType({
        type: "audio-events-layer",
        title: "",
        controller: 'a2VisualizerAudioEventsController as audio_events',
        require: {
            type: ['recording'],
            selection: true
        },
        visible: true,
    });
})
.controller('a2VisualizerAudioEventsController', function($scope, a2AudioEventDetectionsClustering, Project){
    var self = this;
    self.audioEvents = null;
    self.isPlaylist = false;
    self.fetchAudioEvents = function() {
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        if (rec) {
            self.isPlaylist = $scope.visobject.extra && $scope.visobject.extra.playlist;
            a2AudioEventDetectionsClustering.list(
                $scope.visobject.extra && $scope.visobject.extra.playlist && $scope.visobject.extra.playlist.id ?
                {playlist: $scope.visobject.extra.playlist.id} : {rec_id: rec}).then(function(audioEvents) {
                if (audioEvents) {
                    self.audioEvents = audioEvents.map(event => {
                        return {
                            rec_id: event.rec_id,
                            x1: event.time_min,
                            x2: event.time_max,
                            y1: event.freq_min,
                            y2: event.freq_max,
                            display: event.rec_id === rec? "block" : "none"
                        }
                    });
                    return audioEvents;
                }
            });
        }
    };
    $scope.$watch('visobject', self.fetchAudioEvents);
});
