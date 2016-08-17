angular.module('a2.visualizer.layers.zoom-input-layer', [
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.zoom-input-layer.object:zoom-input-layer
     * @description base image layer. 
     * adds the zoom-input-layer layer_type to layer_types. This layer collects input forEach
     * performin zoom actions on the spectrogram.
     */
    layer_typesProvider.addLayerType({
        type: "zoom-input-layer",
        title: "",
        require: {
            type: ['recording', 'soundscape'],
            selection: true,
            that: function(scope) {
                return scope.visobject && scope.visobject.zoomable;
            }
        },
        display: {
            sidebar: false
        },
        visible: true
    });
})
;