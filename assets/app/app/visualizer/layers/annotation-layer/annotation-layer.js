angular.module('a2.visualizer.layers.annotation-layer', [
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.annotation-layer.object:annotation-layer
     * @description base image layer.
     * adds the annotation-layer layer_type to layer_types. This layer shows a set of images
     * associated to the visobject (such as the spectrogram or a soundscape's rendering).
     * The layer only has a spectrogram component.
     * The layer requires a selected visobject of recording or soundscape type.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "annotation-layer",
        title: "",
        controller: 'a2VisualizerAnnotationController as controller',
        require: {
            type: ['recording'],
            selection: true
        },
        display: {
            sidebar: false
        },
        visible: true,
    });
})
.controller('a2VisualizerAnnotationController', function($scope){
})
;
