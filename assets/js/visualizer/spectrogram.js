
angular.module('visualizer-spectrogram', ['visualizer-services', 'a2utils'])
.service('a2AffixCompute', function(){
    return function($viewport, $el, layout){
        var v;
        
        var affix_c = $el.attr('data-affix-container');
        if(affix_c){
            v = layout[affix_c];
        }
        
        if(!v){
            v = {
                left : 0, top : 0, 
                width  : $viewport.width(), 
                height : $viewport.height()
            };
        }
        
        var e = {
            width  : $el.width(),
            height : $el.height()
        }
        
        var affix_left    = $el.attr('data-affix-left') | 0;
        var affix_right   = $el.attr('data-affix-right');
        var affix_align_h = $el.attr('data-affix-align-h');
        if(affix_right != undefined){
            affix_left = v.width - $el.width() - (affix_right|0);
        } else if(affix_align_h != undefined){
            affix_left = v.left + (v.width - $el.width()) * affix_align_h;
        }
        var affix_top     = $el.attr('data-affix-top' ) | 0;
        var affix_bottom  = $el.attr('data-affix-bottom');
        var affix_align_v = $el.attr('data-affix-align-v');
        if(affix_bottom != undefined){
            affix_top = v.height - $el.height() - (affix_bottom|0);
        } else if(affix_align_v != undefined){
            affix_top = v.top + (v.height - $el.height()) * affix_align_v;
        }
        $el.css({position:'absolute', left : affix_left + $viewport.scrollLeft(), top  : affix_top  + $viewport.scrollTop()});
    }
})
.directive('a2VisualizerSpectrogram', function(a2BrowserMetrics, a2AffixCompute){
    var layout_tmp = {
        gutter       :  a2BrowserMetrics.scrollSize.height,
        axis_sizew   :  60,
        axis_sizeh   :  60,
        legend_axis_w : 45,
        legend_width  : 60,
        legend_gutter : 30,
        axis_lead    :  15
    };
    
    return {
        restrict : 'E',
        templateUrl : '/partials/visualizer/visualizer-spectrogram.html',
        replace  : true,
        link     : function($scope, $element, $attrs){
            var views = {
                viewport : $element.children('.spectrogram-container')
            };
            var linear_interpolate = function(x, levels){
                var l = x * (levels.length-1);
                var f=Math.floor(l), c=Math.ceil(l), m=l-f;
                
                return levels[f] * (1-m) + levels[c] * m;
            };
            
            var interpolate = linear_interpolate;
            
            
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
                $scope.layout.bbox = {
                    s1   : ($element.scrollLeft() - $scope.layout.spectrogram.left) / $scope.layout.scale.sec2px,
                    s2   : ($element.scrollLeft() - $scope.layout.spectrogram.left + $element.width()) / $scope.layout.scale.sec2px,
                    hz1  : ($scope.layout.spectrogram.top + $scope.layout.spectrogram.height - $element.scrollTop() - $element.height()) / $scope.layout.scale.hz2px,
                    hz2  : ($scope.layout.spectrogram.top + $scope.layout.spectrogram.height - $element.scrollTop()) / $scope.layout.scale.hz2px
                };
                $scope.layout.center = {
                    s  : ($element.scrollLeft() - $scope.layout.spectrogram.left + $element.width()/2.0) / $scope.layout.scale.sec2px,
                    hz : ($scope.layout.spectrogram.top + $scope.layout.spectrogram.height - $element.scrollTop() - $element.height()/2.0) / $scope.layout.scale.hz2px,
                };
                $scope.layout.y_axis.left = $element.scrollLeft();
                $element.children('.axis-y').css({left: $scope.layout.y_axis.left + 'px'});
                $scope.layout.x_axis.top = $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh - layout_tmp.gutter;
                $element.children('.axis-x').css({top: $scope.layout.x_axis.top + 'px'});
                if($scope.layout.legend){
                    $scope.layout.legend.left = $element.scrollLeft() + $element.width() - a2BrowserMetrics.scrollSize.width - layout_tmp.legend_width - layout_tmp.legend_gutter;
                    $element.children('.legend').css({left: $scope.layout.legend.left + 'px'});
                }
                $element.find('.a2-visualizer-spectrogram-affixed').each(function(i, el){
                    a2AffixCompute($element, $(el), $scope.layout);
                });
            };
            $scope.onMouseMove = function (e) {
                var elOff = $element.offset();
                var x = e.pageX - elOff.left + $element.scrollLeft() - $scope.layout.spectrogram.left;
                var y = e.pageY - elOff.top  + $element.scrollTop()  - $scope.layout.spectrogram.top ;
                x = Math.min(Math.max(x, 0), $scope.layout.spectrogram.width);
                y = Math.min(Math.max(y, 0), $scope.layout.spectrogram.height);
                $scope.pointer.x = x;
                $scope.pointer.y = y;
                $scope.pointer.sec = $scope.layout.x2sec(x);
                $scope.pointer.hz  = $scope.layout.y2hz(y);
            };
            
            var make_scale = function(domain, range){
                var s;
                if(domain.ordinal){
                    var dd = domain.to - domain.from;
                    var dr = range[1] - range[0];
                    var scale = dr / dd;
                    s = d3.scale.linear().domain([domain.from, domain.to]).range([
                        scale/2 + range[0], range[1] - scale/2
                    ]);
                } else {
                    s = d3.scale.linear().domain([domain.from, domain.to]).range(range);
                }
                return s;
            };

            var make_axis  = function(domain, scale, orientation){
                var axis = d3.svg.axis();
                if(domain.ticks){
                    axis.ticks(domain.ticks);
                }
                if(domain.tick_format){
                    axis.tickFormat(domain.tick_format);
                } else if(domain.unit_format){
                    axis.tickFormat(domain.unit_format);
                }
                axis.scale(scale).orient(orientation);
                return axis;
            };
            
            $scope.layout.apply = function(width, height, fix_scroll_center){
                var visobject = $scope.visobject;
                var domain = (visobject && visobject.domain) || {
                    x : {
                        from : 0, to : 60, span : 60, ticks : 60,
                        unit : 'Time ( s )'
                    },
                    y : {
                        from : 0, to : 22050, span : 22050,
                        unit : 'Frequency ( kHz )',
                        tick_format : function(v){return (v/1000) | 0; }
                    }
                };
                
                var avail_w = width  - layout_tmp.axis_sizew - layout_tmp.axis_lead;
                if(domain.legend){
                    avail_w -= layout_tmp.legend_width + layout_tmp.legend_gutter;
                }
                var avail_h = height - layout_tmp.axis_sizeh - layout_tmp.axis_lead - layout_tmp.gutter;
                var cheight = $element[0].clientHeight;
                var zoom_levels_x = [
                    avail_w/domain.x.span,
                    $scope.layout.scale.max_sec2px
                ];
                var zoom_levels_y = [
                    avail_h/domain.y.span,
                    $scope.layout.scale.max_hz2px
                ];
                var zoom_sec2px = interpolate($scope.layout.scale.zoom.x, zoom_levels_x);
                var zoom_hz2px  = interpolate($scope.layout.scale.zoom.y, zoom_levels_y);
                
                var spec_w = Math.max(avail_w, Math.ceil(domain.x.span * zoom_sec2px));
                var spec_h = Math.max(avail_h, Math.ceil(domain.y.span * zoom_hz2px ));
                
                
                var scalex = make_scale(domain.x, [0, spec_w]);
                var scaley = make_scale(domain.y, [spec_h, 0]);
                var scalelegend;
                var l={};                
                l.spectrogram = { selector : '.spectrogram-container', css:{
                    top    : layout_tmp.axis_lead,
                    left   : layout_tmp.axis_sizew,
                    width  : spec_w,
                    height : spec_h,
                }};
                l.y_axis = { selector : '.axis-y',  scale : scaley, 
                    css:{
                        top    : 0,
                        left   : $element.scrollLeft()
                    }, attr:{
                        width  : layout_tmp.axis_sizew,
                        height : spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                    }
                };
                l.x_axis = { selector : '.axis-x',  scale : scalex,  
                    css:{
                        left : layout_tmp.axis_sizew -  layout_tmp.axis_lead,
                        // left : layout_tmp.axis_sizew -  layout_tmp.axis_lead,
                        top  : $element.scrollTop() + height  - layout_tmp.axis_sizeh - layout_tmp.gutter
                    }, attr:{
                        height : layout_tmp.axis_sizeh,
                        width  : spec_w + 2*layout_tmp.axis_lead
                    }
                };
                
                $scope.has_legend = !!domain.legend;
                
                if(domain.legend){
                    l.legend = { selector : '.legend', scale : scalelegend, 
                        css:{
                            top  : 0,
                            left : $element.scrollLeft() + width - a2BrowserMetrics.scrollSize.width - layout_tmp.legend_width - layout_tmp.legend_gutter
                        }, attr:{
                            width  : layout_tmp.legend_width,
                            height : spec_h + 2*layout_tmp.axis_lead
                        }
                    };
                    scalelegend = d3.scale.linear().domain([domain.legend.from, domain.legend.to]).range([spec_h-2, 0]);
                } else {
                    l.legend = { selector : '.legend'};
                }
                //l.x_axis.attr.height = cheight - l.x_axis.css.top - 1;
                
                $scope.layout.domain = domain;
                $scope.layout.offset.sec = domain.x.from;
                $scope.layout.offset.hz  = domain.y.from;
                $scope.layout.scale.sec2px = spec_w / domain.x.span;
                $scope.layout.scale.hz2px  = spec_h / domain.y.span;
                $scope.layout.viewport = {
                    left : l.spectrogram.css.left,
                    top  : l.spectrogram.css.top,
                    width  : avail_w,
                    height : avail_h
                };
                
                var scroll_center;
                if($scope.layout.center){
                    scroll_center = {
                        left: $scope.layout.scale.sec2px * $scope.layout.center.s + l.spectrogram.css.left - width/2.0,
                        top: -$scope.layout.scale.hz2px * $scope.layout.center.hz - height/2.0 + l.spectrogram.css.top + l.spectrogram.css.height
                    };
                }
                

                
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
                var d3_x_axis = d3.select($element.children(l.x_axis.selector).empty()[0]);
                d3_x_axis.append("rect").attr({
                    class : 'bg',
                    x : 0, y : 0,
                    width : l.x_axis.attr.width,
                    height: spec_h + layout_tmp.axis_lead
                });
                d3_x_axis.append("g").
                    attr('class', 'axis').
                    attr('transform', 'translate('+ layout_tmp.axis_lead +', 1)').
                    call(make_axis(domain.x, scalex, "bottom"));
                
                
                var d3_y_axis = d3.select($element.children(l.y_axis.selector).empty()[0]);
                d3_y_axis.append("rect").attr({
                    class : 'bg',
                    x : 0, y : 0,
                    width : l.y_axis.attr.width,
                    height: spec_h + layout_tmp.axis_lead + 2
                });
                d3_y_axis.append("rect").attr({
                    class : 'bg',
                    x : 0, y : 0,
                    width : l.y_axis.attr.width - layout_tmp.axis_lead,
                    height: spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                });
                d3_y_axis.append("g").
                    attr('class', 'axis').
                    attr('transform', 'translate('+ (layout_tmp.axis_sizew-1) +', '+ layout_tmp.axis_lead +')').
                    call(make_axis(domain.y, scaley, "left"));
                    
                if(domain.legend){
                    var d3_legend = d3.select($element.children(l.legend.selector).empty()[0]);
                    d3_legend.append("rect").attr({
                        class : 'bg',
                        x : layout_tmp.axis_lead, y : 0,
                        width : l.legend.attr.width,
                        height: l.legend.attr.height
                    });
                    d3_legend.append("image").attr({
                        class : 'legend-image',
                        x : layout_tmp.legend_axis_w, y : layout_tmp.axis_lead,
                        width : layout_tmp.legend_width - layout_tmp.legend_axis_w,
                        height: spec_h,
                        preserveAspectRatio : 'none',
                        'xlink:href' : domain.legend.src
                    });
                    d3_legend.append("rect").attr({
                        class : 'border',
                        x : layout_tmp.legend_axis_w, y : layout_tmp.axis_lead,
                        width : layout_tmp.legend_width - layout_tmp.legend_axis_w,
                        height: spec_h,
                    });
                    d3_legend.append("g").
                        attr('class', 'axis').
                        attr('transform', 'translate('+ layout_tmp.legend_axis_w +', '+(layout_tmp.axis_lead+1)+')').
                        call(make_axis(domain.legend, scalelegend, "left"));
                }

                if(fix_scroll_center){
                    $element.scrollTop(scroll_center.top);
                    $element.scrollLeft(scroll_center.left);
                }

                $scope.onScrolling();
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
            $scope.$watch('visobject', function (newValue, oldValue) {
                $element.scrollLeft(0);
                $element.scrollTop(999999);
                $scope.layout.apply($element.width(), $element.height());
            }, true);
            $element.bind('resize', function () {
                $scope.$apply();
            });
            $scope.$watch('layout.scale.zoom.x', function (newValue, oldValue) {
                $scope.layout.apply($element.width(), $element.height(), true);
            });
            $scope.$watch('layout.scale.zoom.y', function (newValue, oldValue) {
                $scope.layout.apply($element.width(), $element.height(), true);
            });
            $scope.layout.apply($element.width(), $element.height());
            $scope.onScrolling();
        }
    }
})
.directive('a2VisualizerSpectrogramLayer', function(layer_types, $compile, $templateFetch){
    return {
        restrict : 'E',
        templateUrl : '/partials/visualizer/spectrogram-layer/default.html',
        replace  : true,
        link     : function(scope, element, attrs){
            //console.log("link     : function(scope, element, attrs){", scope, element, attrs);
            var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
            var layer_key  = layer_types[layer_type] ? layer_types[layer_type].type : null;
            element.addClass(layer_type);
            if(layer_key && layer_key != 'default') {
                var layer_url  = '/partials/visualizer/spectrogram-layer/' + layer_key + '.html';
                var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                    var layer_el   = $compile(layer_tmp)(scope);
                    element.append(layer_el);
                });
            }
        }
    }
})
.directive('a2VisualizerSpectrogramAffixed', function(a2AffixCompute){
    return {
        restrict :'A',
        link     : function($scope, $element, $attrs){
            $element.addClass('a2-visualizer-spectrogram-affixed');
            var $root = $element.closest('.visualizer-root');
            var $eloff = $element.offset(), $roff = $root.offset();
            if($roff) {
                if($element.attr('data-affix-left') == undefined){
                    $element.attr('data-affix-left', $eloff.left - $roff.left);
                }
                if($element.attr('data-affix-top') == undefined){
                    $element.attr('data-affix-top', $eloff.top - $roff.top);
                }
            }
            a2AffixCompute($element.offsetParent(), $element, $scope.layout);
            $scope.$watch(function(){
                return [$element.width(), $element.height()]
            }, function(){
                a2AffixCompute($element.offsetParent(), $element, $scope.layout);
            }, true)
        }
    }
});
