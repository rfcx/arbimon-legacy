(function(angular){   
    
    var visualizer = angular.module('visualizer', []);
    var template_root = '/partials/visualizer/';
    
    visualizer.controller('VisualizerCtrl', function ($scope) {
        $scope.layers = [
            {
                title   : "Recording",
                visible : true,
                type    : "recording-layer",
                file    : "test-2014-08-06_12-20.wav"
            },
            {
                title     : "Data Analysis",
                visible   : true,
                type    : "data-analysis-layer",
                sublayers : {
                    collapsed : false,
                    layers    : [
                        {
                            title   : "Regions of Interest",
                            visible : true
                        }, {
                            title   : "New Model",
                            visible : true
                        }, {
                            title   : "New Model Data",
                            visible : true
                        }
                    ]
                }
            },
            {
                title   : "Frequency Filter",
                visible : true,
                type    : "frequency-adjust-layer",
                params  : {
                    minfreq : 5000,
                    maxfreq : 15000
                }
            }
        ]; // current layers in the visualizer
    }).directive('a2Visualizer', function(){
        return { restrict : 'E', templateUrl: template_root + 'main.html' }
    });
    
    var layer_types = {
        default           : true,
        'recording-layer' : true
    };
    
    visualizer.directive('a2VisualizerLayerItem', function($compile, $templateCache){
        return {
            restrict : 'E',
            template : '{{layer.type}}',
            link     : function(scope, element, attrs){
                var layer_type = layer_types[scope.layer.type] ? scope.layer.type : 'default';
                var layer_url  = template_root + 'visualizer-layer-item-' + (layer_types[layer_type] === true ? layer_type : layer_types[layer_type]) + '.html';
                var layer_tmp  = $templateCache.get(layer_url);
                var layer_el   = $compile(layer_tmp)(scope);
                console.log('layer item directive link ' + layer_type, scope, layer_el);
                element.replaceWith(layer_el);
            }
        }
    });
    
    for(layer_type in layer_types){
        (function(directive){
            console.log('making directive ', directive);
            visualizer.directive(directive.name, function(){
                return {restrict : 'E', template : directive.template}
            });
        })({
            layer_type : layer_type,
            name       : 'a2VisualizerLayerItem' + layer_type.replace(/(^|-)(\w)/g, function(_1,_2,_3){ return _3.toUpperCase()}),
            templateUrl: template_root + 'visualizer-layer-item-' + (layer_types[layer_type] === true ? layer_type : layer_types[layer_type]) + '.html'
        });
    }
    
})(angular);

/**

*/