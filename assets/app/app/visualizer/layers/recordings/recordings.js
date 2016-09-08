angular.module('a2.visualizer.layers.recordings', [
    'a2.filter.round',
    'a2.directive.frequency_filter_range_control',
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.recordings.object:recordings-layer
     * @description Recordings layer. 
     * adds the recordings-layer layer_type to layer_types. This layer uses
     * a2.visualizer.layers.recordings.controller:a2VisualizerRecordingLayerController as controller,
     * and requires a visobject of type recording to be selected.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "recording-layer",
        title: "",
        controller: 'a2VisualizerRecordingLayerController as controller',
        require: {
            type: 'recording',
            selection: true
        },
        visible: true,
        hide_visibility: true
    });
})
.controller('a2VisualizerRecordingLayerController', function($scope, $modal, $location){
    this.setGain = function(gain){
        $scope.audio_player.setGain(gain).then(function(){
            var gain=$scope.audio_player.gain;
            $scope.location.updateParams({
                gain: gain >= 1 ? gain : undefined
            });
        });
    };
    this.openFreqFilterModal = function(){
        if(!$scope.visobject){
            return;
        }
        $modal.open({
            templateUrl : '/app/visualizer/layers/recordings/frequency_filter_modal.html',
            controller  : 'a2VisualizerFrequencyFilterModalController',
            size        : 'sm',
            resolve     : {
                data : function(){ return {
                    recording : $scope.visobject,
                    filter: $scope.audio_player.freq_filter
                }; }
            }
        }).result.then(
            $scope.audio_player.setFrequencyFilter.bind($scope.audio_player)
        ).then(function(){
            var filter=$scope.audio_player.freq_filter;
            $scope.location.updateParams({
                filter: filter ? (filter.min + '-' + filter.max) : undefined
            });
        });
    };
})
.controller('a2VisualizerFrequencyFilterModalController', function($scope, $modalInstance, data){
    $scope.recording = data.recording;
    $scope.max_freq = data.recording.sample_rate / 2;
    
    $scope.has_previous_filter = true; //!!data.filter;
    $scope.filter = data.filter ? angular.copy(data.filter) : {min:0, max:$scope.max_freq};
    
    $scope.remove_filter = function(){
        $modalInstance.close();
    };
    $scope.apply_filter = function(){
        $modalInstance.close($scope.filter);
    };
})
;