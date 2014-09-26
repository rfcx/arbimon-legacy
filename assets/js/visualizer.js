//(function(angular){   
    var visualizer = angular.module('visualizer', []);
    var template_root = '/partials/visualizer/';
    var test_data = [
        {   title   : "Recordings",
            visible : true,
            type    : "recording-layer",
            file    : "test-2014-08-06_12-20.wav",
            tags    : [
                'species://coqui', 'awesome'
            ]
        },
        {   title     : "Data Analysis",
            visible   : false,
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
    
    visualizer.factory('$templateFetch', function($http, $templateCache){
        return function $templateFetch(templateUrl, linker){
            var template = $templateCache.get(templateUrl);
            if(template) {
                if (template.promise) {
                    template.linkers.push(linker);
                } else {
                    linker();
                }
            } else {
                var tmp_promise = {
                    linkers : [linker],
                    promise : $http.get(templateUrl).success(function(template){
                        $templateCache.put(templateUrl, template);
                        for(var i=0, l=tmp_promise.linkers, e=l.length; i < e; ++i){
                            l[i](template);
                        }
                    })                        
                };
                $templateCache.put(templateUrl, tmp_promise);                
            }
        }
    });
    
    visualizer.controller('VisualizerCtrl', function ($scope) {
        $scope.layers = test_data; // current layers in the visualizer
    }).directive('a2Visualizer', function(){
        
        
        return { restrict : 'E', templateUrl: template_root + 'main.html' }
    });
    
    var layer_types = {
        'recording-layer' : true,
        'frequency-adjust-layer' : true
    };
    
    visualizer.directive('a2VisualizerLayerItem', function($compile, $templateFetch){
        return {
            restrict : 'E',
            templateUrl : template_root + 'visualizer-layer-item-default.html',
            link     : function(scope, element, attrs){
                element.children().children().unwrap();
                var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
                var layer_key  = layer_types[layer_type] === true ? layer_type : layer_types[layer_type];
                if(layer_key && layer_key != 'default') {
                    var layer_url  = template_root + 'visualizer-layer-item-' + layer_key + '.html';
                    var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                        var layer_el   = $compile(layer_tmp)(scope);
                        element.append(layer_el.children().unwrap());
                    });
                }
            }
        }
    });
    
//})(angular);

/**

*/