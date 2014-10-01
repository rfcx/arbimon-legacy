(function(angular){   
    var visualizer = angular.module('visualizer', ['ngAudio']);
    var template_root = '/partials/visualizer/';
    var test_data = {
        recording : {
            file     : "test-2014-08-06_12-20.wav",
            audioUrl : "/data/sample/test-2014-08-06_12-20.wav",
            duration : 60,
            sampling_rate : 44000,
            tags    : [
                'species://coqui', 'awesome'
            ],
            validations : [
                {specie: 'Eleuterodactylus coqui', present : 1},
                {specie: 'Spp 2', present : 0}
            ]
        },
        layers : [
            {   title   : "Recordings",
                visible : true,
                hide_visibility : true,
                type    : "recording-layer",
                file    : "test-2014-08-06_12-20.wav",
                tiles   : [
                    {x:0, y:0, src:'/data/sample/test-2014-08-06_12-20.wav.bmp'}
                ],
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
    
    visualizer.controller('VisualizerCtrl', function ($scope, ngAudio) {
        $scope.layers = []; // current layers in the visualizer
        $scope.recording = null;
        $scope.layout = {
            scale : {
                def_sec2px :    5 / 100.0,
                def_hz2px  : 5000 / 100.0,
                sec2px : 100 / 1.0,
                hz2px  : 100 / 5000.0
            }
        };
        
        $scope.getLayers = function(){
            return $scope.layers;
        }
        $scope.setRecording = function(recording){
            // fix up some stuff
            recording.max_freq = recording.sampling_rate / 2;
            // set it to the scope
            $scope.recording = recording;
            if($scope.recording.audioUrl) {
                $scope.audio_player.load($scope.recording.audioUrl);
            }
        }
        $scope.Math = Math;
        $scope.pointer   = {
            x   : 0, y  : 0,
            sec : 0, hz : 0
        };
        $scope.selection = {
            layer: null,
            select_layer: function(layer){
                $scope.selection.layer = layer;
            }
        }
        $scope.audio_player = {
            is_playing : false,
            is_muted   : false,
            has_recording : true,
            has_next_recording : false,
            has_prev_recording : false,
            resource: null,
            setCurrentTime: function(time){
                console.log('setCurrentTime ', time);
                if(this.resource) {
                    this.resource.currentTime = time;
                }
            },
            load: function(url){
                this.resource = ngAudio.load(url);
                this.has_recording = true;
            },
            mute: function(muted){
                if(this.resource) {
                    this.resource[muted ? 'mute' : 'unmute']();
                }
                this.is_muted = muted;
            },
            play: function(){
                if(this.resource) {
                    this.resource.play();
                    this.is_playing = true;
                }
            },
            pause: function(){
                if(this.resource) {
                    this.resource.pause();
                }
                this.is_playing = false;
            },
            stop: function(){
                if(this.resource) {
                    this.resource.stop();
                }
                this.is_playing = false;
            }
        };
        
        // $scope.setRecording(test_data.recording);
    }).directive('a2Visualizer', function(){
        
        
        return { restrict : 'E', templateUrl: template_root + 'main.html' }
    });

    visualizer.directive('a2Scroll', function() {
        return {
            scope: {
                a2Scroll : '&a2Scroll'
            },
            link : function($scope, $element, $attrs) {
                $element.bind("scroll", function(e) {
                    $scope.a2Scroll(e);
                });
            }
        };
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

    visualizer.directive('a2VisualizerSpectrogram', function(){
        var layout_tmp = {
            gutter     :  20,
            axis_sizew :  60,
            axis_sizeh :  30,
            axis_lead  :  15
        }
        return {
            restrict : 'E',
            templateUrl : template_root + 'visualizer-spectrogram.html',
            replace  : true,
            link     : function($scope, $element, $attrs){
                var views = {
                    viewport : $element.children('.spectrogram-container')
                };
                // console.log('linking a2VisualizerSpectrogram ....', $scope);
                $scope.onPlaying = function(e){
                    $scope.layout.y_axis.left = $element.scrollLeft();
                    $element.children('.axis-y').css({left: $scope.layout.y_axis.left + 'px'});
                    $scope.layout.x_axis.top = Math.min(
                        $scope.layout.spectrogram.top + $scope.layout.spectrogram.height,
                        $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh
                    );
                    $element.children('.axis-x').css({top: $scope.layout.x_axis.top + 'px'});
                };
                $scope.onScrolling = function(e){
                    $scope.layout.y_axis.left = $element.scrollLeft();
                    $element.children('.axis-y').css({left: $scope.layout.y_axis.left + 'px'});
                    $scope.layout.x_axis.top = Math.min(
                        $scope.layout.spectrogram.top + $scope.layout.spectrogram.height,
                        $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh
                    );
                    $element.children('.axis-x').css({top: $scope.layout.x_axis.top + 'px'});
                    $element.find('.a2-visualizer-spectrogram-affixed').each(function(i, el){
                        var $el = $(el);
                        var affix_left = $el.data('affix-left') | 0;
                        var affix_top  = $el.data('affix-top' ) | 0;
                        $el.css({position:'absolute', left : affix_left + $element.scrollLeft(), top  : affix_top  + $element.scrollTop()});
                    });
                };
                $scope.onMouseMove = function (e) {
                    var elOff = $element.offset();
                    var x = e.pageX - elOff.left + $element.scrollLeft() - $scope.layout.spectrogram.left;
                    var y = e.pageY - elOff.top  + $element.scrollTop()  - $scope.layout.spectrogram.top ;
                    x = Math.min(Math.max(                                   x, 0), $scope.layout.spectrogram.width);
                    y = Math.min(Math.max($scope.layout.spectrogram.height - y, 0), $scope.layout.spectrogram.height);
                    $scope.pointer.x = x;
                    $scope.pointer.y = y;
                    $scope.pointer.sec = x / $scope.layout.scale.sec2px;
                    $scope.pointer.hz  = y / $scope.layout.scale.hz2px;
                };
                $scope.layout.apply = function(width, height){
                    var recording = $scope.recording || {duration:60, max_freq:44100};
                    var avail_w = width  - layout_tmp.axis_sizew - layout_tmp.axis_lead;
                    var avail_h = height - layout_tmp.axis_sizeh - 5*layout_tmp.axis_lead;
                    var spec_w = Math.max(avail_w, Math.ceil(recording.duration * $scope.layout.scale.sec2px));
                    var spec_h = Math.max(avail_h, Math.ceil(recording.max_freq * $scope.layout.scale.hz2px ));
                    var scalex = d3.scale.linear().domain([0, recording.duration]).range([0, spec_w]);
                    var scaley = d3.scale.linear().domain([0, recording.max_freq]).range([spec_h, 0]);
                    var l={};
                    $scope.layout.scale.sec2px = spec_w / recording.duration;
                    $scope.layout.scale.hz2px  = spec_h / recording.max_freq;
                    l.spectrogram = { selector : '.spectrogram-container', css:{
                        top    : layout_tmp.axis_lead,
                        left   : layout_tmp.axis_sizew,
                        width  : spec_w,
                        height : spec_h,
                    }};
                    l.y_axis = { selector : '.axis-y',  scale : scaley, css:{
                        top    : 0,
                        left   : $element.scrollLeft()
                    }, attr:{
                        width  : layout_tmp.axis_sizew,
                        height : spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                    }};
                    l.x_axis = { selector : '.axis-x',  scale : scalex,  css:{
                        left : layout_tmp.axis_sizew -  layout_tmp.axis_lead,
                        top  : Math.min(l.spectrogram.css.top + spec_h, $element.scrollTop() + height  - layout_tmp.axis_sizeh)
                    }, attr:{
                        height : layout_tmp.axis_sizeh,
                        width  : spec_w + 2*layout_tmp.axis_lead
                    }};
                    for(var i in l){
                        var li = l[i];
                        $scope.layout[i] = li.css;
                        var $li = $element.children(li.selector);
                        if(li.css){ $li.css(li.css); }
                        if(li.attr){
                            $li.attr(li.attr);
                            $.extend($scope.layout[i], li.attr);
                        }
                        if(li.scale){
                            $scope.layout[i].scale = li.scale;
                        }
                    }
                    var axis = d3.select($element.children(l.x_axis.selector)[0]);
                    axis.append("rect").attr({
                        class : 'bg',
                        x : 0, y : 0,
                        width : l.x_axis.attr.width,
                        height: spec_h + layout_tmp.axis_lead
                    });
                    axis.append("g").
                        attr('class', 'axis').
                        attr('transform', 'translate('+ layout_tmp.axis_lead +', 1)').
                        call(d3.svg.axis().
                            ticks(recording.duration).
                            tickFormat(function(x){return x + ' s';}).
                            scale(scalex).
                            orient("bottom")
                        );
                    axis = d3.select($element.children(l.y_axis.selector)[0]);
                    axis.append("rect").attr({
                        class : 'bg',
                        x : 0, y : 0,
                        width : l.y_axis.attr.width,
                        height: spec_h + layout_tmp.axis_lead + 2
                    });
                    axis.append("rect").attr({
                        class : 'bg',
                        x : 0, y : 0,
                        width : l.y_axis.attr.width - layout_tmp.axis_lead,
                        height: spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                    });
                    axis.append("g").
                        attr('class', 'axis').
                        attr('transform', 'translate('+ (layout_tmp.axis_sizew-1) +', '+ layout_tmp.axis_lead +')').
                        call(d3.svg.axis().
                            tickFormat(function(x){return (x/1000.0) + ' KHz';}).
                            scale(scaley).
                            orient("left")
                        );
                };
                $scope.getElementDimensions = function () {
                    return { 'h': $element.height(), 'w': $element.width() };
                };
                $scope.getRecordingPlaybackTime = function () {
                    var rsc = $scope.audio_player.resource;
                    return rsc && rsc.currentTime;
                };
                $scope.$watch($scope.getElementDimensions, function (newValue, oldValue) {
                    $scope.layout.apply(newValue.w, newValue.h);
                }, true);
                $scope.$watch($scope.getRecordingPlaybackTime, function (newValue, oldValue) {
                    if($scope.audio_player.is_playing) {
                        var pbh = layout_tmp.axis_sizew + $scope.layout.scale.sec2px * newValue;
                        var sl  = $element.scrollLeft(), slw = sl + $element.width()/2;
                        var dx  =  pbh - slw ;
                        if (dx > 0) {
                            $element.scrollLeft(sl + dx);
                        }
                    }
                }, true);
                $element.bind('resize', function () {
                    $scope.$apply();
                });
                $scope.layout.apply($element.width(), $element.height());
                $scope.onScrolling();
            }
        }
    });

    visualizer.directive('a2VisualizerSpectrogramLayer', function($compile, $templateFetch){
        return {
            restrict : 'E',
            templateUrl : template_root + 'visualizer-spectrogram-layer-default.html',
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
    visualizer.directive('a2VisualizerSpectrogramAffixed', function($compile, $templateFetch){
        return {
            restrict :'E',
            template : '<div class="a2-visualizer-spectrogram-affixed" ng-transclude></div>',
            replace  : true,
            transclude : true,
            link     : function($scope, $element, $attrs){
                var $root = $element.closest('.visualizer-root');
                var $eloff = $element.offset(), $roff = $root.offset();
                if($roff) {
                    $element.attr('data-affix-left', $eloff.left - $roff.left);
                    $element.attr('data-affix-top', $eloff.top - $roff.top);
                }
            }
        }
    });


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

    
})(angular);
