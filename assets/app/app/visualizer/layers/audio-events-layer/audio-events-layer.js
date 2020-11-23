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
.controller('a2VisualizerAudioEventsController', function($scope, $modal, $controller, $timeout, a2AudioEventDetectionsClustering, a2UserPermit, a22PointBBoxEditor, Project, notify){
    var self = this;
    self.audioEvents = null;

    Project.getClasses(function(project_classes){
        self.project_classes = project_classes;
    });

    var fetchAudioEvents = function() {
        var aset= self.audioEvents && self.audioEvents.length;
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        if (rec && !aset) {
            a2AudioEventDetectionsClustering.list(rec).then(function(audioEvents) {
                if (audioEvents) {
                    self.audioEvents = audioEvents.map(event => {
                        return {
                            rec_id: event.rec_id,
                            x1: event.time_min,
                            x2: event.time_max,
                            y1: event.frec_min,
                            y2: event.frec_max
                        }
                    });
                    return audioEvents;
                }
            });
        }
    };
    $scope.$watch('visobject', fetchAudioEvents);
});
