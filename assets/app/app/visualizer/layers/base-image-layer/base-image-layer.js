angular.module('a2.visualizer.layers.base-image-layer', [
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.base-image-layer.object:base-image-layer
     * @description base image layer. 
     * adds the base-image-layer layer_type to layer_types. This layer shows a set of images
     * associated to the visobject (such as the spectrogram or a soundscape's rendering).
     * The layer only has a spectrogram component.
     * The layer requires a selected visobject of recording or soundscape type.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "base-image-layer",
        title: "",
        require: {
            type: ['recording', 'soundscape'],
            selection: true
        },
        display: {
            sidebar: false
        },
        visible: true,
    });
})
;