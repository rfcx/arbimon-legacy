angular.module('a2.visualizer.layers.species-presence', [
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.species-presence.object:species-presence
     * @description species presence validation layer. 
     * Adds the species-presence layer_type to layer_types. This layer shows a 
     * species presence validation interface.
     * The layer has no spectrogram component.
     * The layer requires a selected visobject of recording type.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "species-presence",
        title: "",
        require: {
            type: 'recording',
            selection: true
        },
        display: {
            spectrogram: false
        },
        sidebar_only: true,
        visible: false,
        hide_visibility: true,
    });
})
;