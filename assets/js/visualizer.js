window.q={};
(function(angular){   
    var qt = window.q;
    var visualizer = angular.module('visualizer', []);
    var template_root = '/partials/visualizer/';
    var test_data = [
        {   title   : "Recording",
            visible : true,
            type    : "recording-layer",
            file    : "test-2014-08-06_12-20.wav"
        },
        {   title     : "Data Analysis",
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
        {   title   : "Frequency Filter",
            visible : true,
            type    : "frequency-adjust-layer",
            params  : {
                minfreq : 5000,
                maxfreq : 15000
            }
        }
    ];
    
    visualizer.controller('VisualizerCtrl', function ($scope) {
        $scope.layers = test_data; // current layers in the visualizer
    }).directive('a2Visualizer', function(){
        return { restrict : 'E', templateUrl: template_root + 'main.html' }
    });
    
    var layer_types = {
        default           : true,
        'recording-layer' : true,
        'frequency-adjust-layer' : true
    };
    
    visualizer.directive('a2VisualizerLayerItem', function($compile, $http, $templateCache){
        return {
            restrict : 'E',
            template : '{{layer.type}}',
            link     : function(scope, element, attrs){
                var layer_type = layer_types[scope.layer.type] ? scope.layer.type : 'default';
                var layer_url  = template_root + 'visualizer-layer-item-' + (layer_types[layer_type] === true ? layer_type : layer_types[layer_type]) + '.html';
                var linker = function(layer_tmp){
                    var layer_el   = $compile(layer_tmp)(scope);
                    element.replaceWith(layer_el);
                }
                var layer_tmp  = $templateCache.get(layer_url);
                if(layer_tmp) {
                    if (layer_tmp.promise) {
                        layer_tmp.linkers.push(linker);
                    } else {
                    }                    
                } else {
                    var tmp_promise = {
                        linkers : [linker],
                        promise : $http.get(layer_url).success(function(layer_tmp){
                            $templateCache.put(layer_url, layer_tmp);
                            for(var i=0, l=tmp_promise.linkers, e=l.length; i < e; ++i){
                                l[i](layer_tmp);
                            }
                        })                        
                    };
                    $templateCache.put(layer_url, tmp_promise);
                    
                }
            }
        }
    });
    
})(angular);

/**

*/