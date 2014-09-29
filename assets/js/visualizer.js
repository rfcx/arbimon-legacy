(function(angular){   
    var visualizer = angular.module('visualizer', []);
    var template_root = '/partials/visualizer/';
    var test_data = {
        recording : {
            file     : "test-2014-08-06_12-20.wav",
            duration : 60,
            sampling_rate : 44000
        },
        layers : [
            {   title   : "Recordings",
                visible : true,
                type    : "recording-layer",
                file    : "test-2014-08-06_12-20.wav",
                tiles   : [
                    {x:0, y:0, src:'/data/sample/test-2014-08-06_12-20.wav.bmp'}
                ],
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
        ]
    };
    
    visualizer.factory('$templateFetch', function($http, $templateCache){
        return function $templateFetch(templateUrl, linker){
            var template = $templateCache.get(templateUrl);
            if(template) {
                if (template.promise) {
                    template.linkers.push(linker);
                } else {
                    linker(template);
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
        $scope.layers = test_data.layers; // current layers in the visualizer
        $scope.layout = {
            scale : {
                def_sec2px :    5 / 100.0,
                def_hz2px  : 5000 / 100.0,
                sec2px : 100 / 1.0,
                hz2px  : 100 / 5000.0
            }
        };
        $scope.recording = test_data.recording; // current layers in the visualizer
        $scope.recording.max_freq = $scope.recording.sampling_rate / 2;
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
            replace  : true,
            templateUrl : template_root + 'visualizer-layer-item-default.html',
            link     : function(scope, element, attrs){
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
    visualizer.directive('a2VisualizerSpectrogramLayer', function($compile, $templateFetch){
        return {
            restrict : 'E',
            template : '<div class="spectrogram-layer"></div>',
            replace  : true,
            link     : function(scope, element, attrs){
                var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
                var layer_key  = layer_types[layer_type] === true ? layer_type : layer_types[layer_type];
                element.addClass(layer_type);
                if(layer_key && layer_key != 'default') {
                    var layer_url  = template_root + 'visualizer-spectrogram-layer-' + layer_key + '.html';
                    var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                        var layer_el   = $compile(layer_tmp)(scope);
                        element.append(layer_el);
                    });
                }
            }
        }
    });

    visualizer.directive('a2VisualizerSpectrogram', function(){
        var layout_tmp = {
            defaults : {
                rec_len : 60 // seconds
            },
            gutter    :  20,
            axis_size : 100
        }
        return {
            restrict : 'E',
            templateUrl : template_root + 'visualizer-spectrogram.html',
            replace  : true,
            link     : function($scope, $element, $attrs){
                var views = {
                    viewport : $element.children('.spectrogram-container')
                };
                console.log('linking a2VisualizerSpectrogram ....', $scope);
                $scope.Math = Math;
                $scope.layout.apply = function(width, height){
                    console.log('setting visualizer layout....', width, height, $scope);
                    var l={};
                    l.spectrogram = { selector : '.spectrogram-container', css:{
                        top    : 0,
                        left   : layout_tmp.gutter + layout_tmp.axis_size,
                        width  : Math.ceil($scope.recording.duration * $scope.layout.scale.sec2px),
                        height : Math.ceil($scope.recording.max_freq * $scope.layout.scale.hz2px),
                    }};
                    l.y_axis = { selector : '.axis-y', css:{
                        top    : 0,
                        left   : layout_tmp.gutter,
                        width  : layout_tmp.axis_size,
                        height : l.spectrogram.css.height
                    }};
                    l.x_axis = { selector : '.axis-x', css:{
                        left : layout_tmp.gutter + layout_tmp.axis_size,
                        top  : l.spectrogram.css.top + l.spectrogram.css.height,
                        height : layout_tmp.axis_size,
                        width  : l.spectrogram.css.width
                    }};
                    for(var i in l){
                        var li = l[i];
                        $scope.layout[i] = li.css;
                        $element.children(li.selector).css(li.css);
                    }
                };
                $scope.getElementDimensions = function () {
                    return { 'h': $element.height(), 'w': $element.width() };
                };
                $scope.$watch($scope.getElementDimensions, function (newValue, oldValue) {
                    $scope.layout.apply(newValue.w, newValue.h);
                }, true);
                $element.bind('resize', function () {
                    $scope.$apply();
                });
            }
        }
    });
    
})(angular);
