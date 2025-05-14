angular.module('a2.visualizer.layers.species-presence', [
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.species-presence.object:species-presence
     * @description species presence validation layer.
     * Adds the species-presence layer_type to layer_types. This layer shows a
     * species presence validation interface.
     * The layer has spectrogram component.
     * The layer requires a selected visobject of recording type.
     * The layer has visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "species-presence",
        title: "",
        controller: 'a2VisualizerSpeciesPresenceController as species_presence',
        require: {
            type: 'recording',
            selection: true
        },
        visible: true
    });
})
.controller('a2VisualizerSpeciesPresenceController', function($scope, a2PatternMatching, a2AudioEventDetectionsClustering) {
    var self = this;
    self.speciesPresence = null;
    self.isRemoving = false;
    self.checkSpectroWidth = function(leftBox, widthBox, widthSpectro) {
        return leftBox + widthBox + 200 < widthSpectro;
    };
    self.togglePopup = function(roi) {
        roi.isPopupOpened = !roi.isPopupOpened;
    };
    self.confirmPopup = function(roi) {
        self.isRemoving = true;
        if (roi.aed_id) {
            return a2AudioEventDetectionsClustering.unvalidate({ aed: [roi.aed_id] }).then(function(){
                self.closePopup(roi)
                roi.name = ''
            })
        }
        else return a2PatternMatching.validateRois(roi.pattern_matching_id, roi.pattern_matching_roi_id, null).then(function(){
            self.closePopup(roi)
            roi.display = "none"
        })
    };
    self.closePopup = function(roi) {
        self.isRemoving = false;
        roi.isPopupOpened = false;
    };
    self.fetchSpeciesPresence = function() {
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        if (rec) {
            a2PatternMatching.list({rec_id: rec, validated: 1}).then(function(rois) {
                self.speciesPresence = rois.map(roi => {
                    return {
                        rec_id: roi.recording_id,
                        pattern_matching_id: roi.pattern_matching_id,
                        pattern_matching_roi_id: roi.pattern_matching_roi_id,
                        name: roi.species_name + ' ' + roi.songtype_name,
                        species: roi.species_name,
                        songtype: roi.songtype_name,
                        x1: roi.x1,
                        x2: roi.x2,
                        y1: roi.y1,
                        y2: roi.y2,
                        display: roi.recording_id === rec? "block" : "none",
                        isPopupOpened: false
                    }
                });
                // Add validated aed species boxes
                if ($scope.visobject && $scope.visobject.aedValidations && $scope.visobject.aedValidations.length) {
                    self.speciesPresence = self.speciesPresence.concat($scope.visobject.aedValidations)
                }
            });
        }
    };
    $scope.$watch('visobject', self.fetchSpeciesPresence);
});
