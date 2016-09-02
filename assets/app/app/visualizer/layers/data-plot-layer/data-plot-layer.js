angular.module('a2.visualizer.layers.data-plot-layer', [
    'a2.directive.plotly-plotter',
    'arbimon2.directive.a2-dropdown',
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.data-plot-layer.object:data-plot-layer
     * @description base image layer. 
     * adds the data-plot-layer layer_type to layer_types. This layer shows a set of plots
     * related to the visobject.
     * The layer only has a spectrogram component.
     * The layer requires a visobject of type audio-event-detection.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "data-plot-layer",
        title: "",
        controller: 'a2VisualizerDataPlotLayerController as controller',
        require: {
            type: ['audio-event-detection'],
            selection: true
        },
        visible: true,
        hide_visibility: true
    });
})
.controller('a2VisualizerDataPlotLayerController', function($scope){
})
;