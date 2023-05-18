
angular.module('visualizer-spectrogram', [
    'visualizer-services',
    'a2.filter.round',
    'a2.utils',
])
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
        };

        var affix_left    = $el.attr('data-affix-left') | 0;
        var affix_right   = $el.attr('data-affix-right');
        var affix_align_h = $el.attr('data-affix-align-h');
        if(affix_right !== undefined){
            affix_left = v.left +  v.width - $el.width() - (affix_right|0);
        } else if(affix_align_h !== undefined){
            affix_left = v.left + (v.width - $el.width()) * affix_align_h;
        } else {
            affix_left += v.left;
        }
        var affix_top     = $el.attr('data-affix-top' ) | 0;
        var affix_bottom  = $el.attr('data-affix-bottom');
        var affix_align_v = $el.attr('data-affix-align-v');
        if(affix_bottom !== undefined){
            affix_top = v.top +  v.height - $el.height() - (affix_bottom|0);
        } else if(affix_align_v !== undefined){
            affix_top = v.top + (v.height - $el.height()) * affix_align_v;
        } else {
            affix_top += v.top;
        }
        $el.css({position:'absolute', left: Math.round(affix_left + $viewport.scrollLeft()), top: Math.round(affix_top  + $viewport.scrollTop())});
    };
})
.directive('a2VisualizerSpectrogram', function(a2BrowserMetrics, a2AffixCompute){
    return {
        restrict : 'E',
        templateUrl : '/app/visualizer/visualizer-spectrogram.html',
        replace  : true,
        link     : function($scope, $element, $attrs) {
            var layout_tmp = $scope.layout.tmp;
            var views = {
                viewport : $element.children('.spectrogram-container')
            };


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
                var layout = $scope.layout;
                var max_s_h = layout.spectrogram.height - layout.viewport.height;
                var max_s_w = layout.spectrogram.width  - layout.viewport.width ;
                if($element.scrollTop() > max_s_h){
                    $element.scrollTop(max_s_h);
                }
                if($element.scrollLeft() > max_s_w){
                    $element.scrollLeft(max_s_w);
                }

                layout.bbox = {
                    s1   : ($element.scrollLeft() - layout.spectrogram.left) / layout.scale.sec2px,
                    s2   : ($element.scrollLeft() - layout.spectrogram.left + $element.width()) / layout.scale.sec2px,
                    hz1  : (layout.spectrogram.top + layout.spectrogram.height - $element.scrollTop() - $element.height()) / layout.scale.hz2px,
                    hz2  : (layout.spectrogram.top + layout.spectrogram.height - $element.scrollTop()) / layout.scale.hz2px
                };
                layout.center = {
                    s  : ($element.scrollLeft() - layout.spectrogram.left + $element.width()/2.0) / layout.scale.sec2px,
                    hz : (layout.spectrogram.top + layout.spectrogram.height - $element.scrollTop() - $element.height()/2.0) / layout.scale.hz2px,
                };
                layout.y_axis.left = $element.scrollLeft();
                $element.children('.axis-y').css({left: layout.y_axis.left + 'px'});
                layout.x_axis.top = $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh - layout_tmp.gutter;
                $element.children('.axis-x').css({top: (layout.x_axis.top-1) + 'px'});

                if(layout.legend){
                    layout.legend.left = $element.scrollLeft() + $element.width() - a2BrowserMetrics.scrollSize.width - layout_tmp.legend_width - layout_tmp.legend_gutter;
                    $element.children('.legend').css({left: layout.legend.left + 'px'});
                }

                $element.find('.a2-visualizer-spectrogram-affixed').each(function(i, el){
                    a2AffixCompute($element, $(el), layout);
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

            $scope.layout.listeners.push(function(layout, container, $scope, width, height, fix_scroll_center){
                doLayout(layout, container, $scope, width, height, fix_scroll_center);
            });

            function doLayout(layout, container, $scope, width, height, fix_scroll_center){
                var domain = layout.l.domain || {};

                var components = {
                    visualizer_root: container,
                    spectrogram : container.children('.spectrogram-container'),
                    y_axis      : domain.y && container.children('.axis-y'),
                    x_axis      : domain.x && container.children('.axis-x'),
                    legend      : domain.legend && container.children('.legend'),
                };

                Object.keys(components).forEach(function(i){
                    var component = components[i];
                    if(component){
                        var $li = component;
                        var li = layout.l[i];
                        if(li.css ){ $li.css( li.css ); }
                        if(li.attr){ $li.attr(li.attr); }
                    }
                });

                if(domain.x){
                    doXAxisLayout(layout);
                }
                if(domain.y){
                    doYAxisLayout(layout);
                }

                if(domain.legend){
                    doLegendLayout(layout);
                }

                if(fix_scroll_center){
                    $element.scrollTop( Math.min(layout.l.scroll_center.top , layout.l.spectrogram.css.height - layout.viewport.height));
                    $element.scrollLeft(Math.min(layout.l.scroll_center.left, layout.l.spectrogram.css.width  - layout.viewport.width ));
                }

                $scope.onScrolling();
            }
            function doXAxisLayout(layout){
                var d3_x_axis = d3.select($element.children('.axis-x').empty()[0]);
                var spec_h = layout.spectrogram.height;
                var domain = layout.l.domain;
                var scalex = layout.l.scale.x;

                d3_x_axis.style('height', 100);
                d3_x_axis.style('scale', 'none');
                d3_x_axis.append("rect").attr({
                    class : 'bg',
                    x : 0, y : 1,
                    width : layout.l.x_axis.attr.width,
                    height: spec_h + layout_tmp.axis_lead
                });
                d3_x_axis.append("g").
                    attr('class', 'axis').
                    attr('transform', 'translate('+ layout_tmp.axis_lead +', 1)').
                    call(make_axis(domain.x, scalex, "bottom"));
            }
            function doYAxisLayout(layout){
                var d3_y_axis = d3.select($element.children('.axis-y').empty()[0]);
                var spec_h = layout.spectrogram.height;
                var domain = layout.l.domain;
                var scaley = layout.l.scale.y;

                d3_y_axis.style('width', 61);
                d3_y_axis.style('scale', 'none');
                d3_y_axis.append("rect").attr({
                    class : 'bg',
                    x : 0, y : 0,
                    width : layout.l.y_axis.attr.width+1,
                    height: spec_h + layout_tmp.axis_lead + 1
                });
                d3_y_axis.append("rect").attr({
                    class : 'bg',
                    x : 0, y : 0,
                    width : layout.l.y_axis.attr.width - layout_tmp.axis_lead,
                    height: spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                });
                d3_y_axis.append("g").
                    attr('class', 'axis').
                    attr('transform', 'translate('+ (layout_tmp.axis_sizew) +', '+ layout_tmp.axis_lead +')').
                    call(make_axis(domain.y, scaley, "left"));
            }
            function doLegendLayout(layout){
                var d3_legend = d3.select($element.children('.legend').empty()[0]);
                var spec_h = layout.spectrogram.height;
                var domain = layout.l.domain;

                d3_legend.append("rect").attr({
                    class : 'bg',
                    x : layout_tmp.axis_lead, y : 0,
                    width : layout.l.legend.attr.width,
                    height: layout.l.legend.attr.height
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
                    call(make_axis(domain.legend, layout.l.scale.legend, "left"));
            }

            $scope.getRecordingPlaybackTime = function () {
                return $scope.audio_player.getCurrentTime();
            };

            $scope.$watch(function () {
                return {
                    'h': $element.height(), 'w': $element.width()
                };
            }, function (newValue, oldValue) {
                $scope.layout.apply($element, $scope, newValue.w, newValue.h, true);
            }, true);

            $scope.$watch(function(){
                return ($scope.layout.scale.sec2px * $scope.getRecordingPlaybackTime()) | 0;
            }, function (newValue, oldValue) {
                if($scope.audio_player.is_playing) {
                    var pbh = layout_tmp.axis_sizew + newValue;
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
                $scope.layout.apply($element, $scope, $element.width(), $element.height());
            }, true);

            $element.bind('resize', function () {
                $scope.$apply();
            });

            $scope.$watch('layout.scale.zoom.x', function (newValue, oldValue) {
                $scope.layout.apply($element, $scope, $element.width(), $element.height(), true);
            });

            $scope.$watch('layout.scale.zoom.y', function (newValue, oldValue) {
                $scope.layout.apply($element, $scope, $element.width(), $element.height(), true);
            });

            $scope.$watch('layout.scale.originalScale', function (newValue, oldValue) {
                $scope.layout.apply($element, $scope, $element.width(), $element.height(), true);
            });

            $scope.layout.apply($element, $scope, $element.width(), $element.height());
            $scope.onScrolling();
        }
    };
})
.directive('a2VisualizerSpectrogramLayer', function(layer_types, $compile, $templateFetch){
    return {
        restrict : 'E',
        templateUrl : '/app/visualizer/spectrogram-layer/default.html',
        replace  : true,
        link     : function(scope, element, attrs){
            //console.log("link     : function(scope, element, attrs){", scope, element, attrs);
            var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
            var layer_key  = layer_types[layer_type] ? layer_types[layer_type].type : null;
            element.addClass(layer_type);
            if(layer_key && layer_key != 'default') {
                var layer_url  = '/app/visualizer/spectrogram-layer/' + layer_key + '.html';
                var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                    var layer_el   = $compile(layer_tmp)(scope);
                    element.append(layer_el);
                });
            }
        }
    };
})
.directive('a2VisualizerSpectrogramAffixed', function(a2AffixCompute, $debounce){
    return {
        restrict :'A',
        link     : function($scope, $element, $attrs){

            $element.addClass('a2-visualizer-spectrogram-affixed');
            var $root = $element.closest('.visualizer-root');
            var $eloff = $element.offset(), $roff = $root.offset();
            if($roff) {
                if($element.attr('data-affix-left') === undefined){
                    $element.attr('data-affix-left', $eloff.left - $roff.left);
                }
                if($element.attr('data-affix-top') === undefined){
                    $element.attr('data-affix-top', $eloff.top - $roff.top);
                }
            }
            if($attrs.a2VisualizerSpectrogramAffixed){
                $scope.$watch($attrs.a2VisualizerSpectrogramAffixed, function(newval, oldval){
                    var i;
                    if(oldval){
                        for(i in oldval){
                            $element.attr('data-affix-'+i, null);
                        }
                    }
                    if(newval){
                        for(i in newval){
                            $element.attr('data-affix-'+i, newval[i]);
                        }
                    }
                });
                a2AffixCompute($element.offsetParent(), $element, $scope.layout);
            }
            a2AffixCompute($element.offsetParent(), $element, $scope.layout);
            $scope.$watch(function(){
                return $element.width() * $element.height();
            }, $debounce(function(){
                a2AffixCompute($element.offsetParent(), $element, $scope.layout);
            }));
        }
    };
});
