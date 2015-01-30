$(document)
  .on('click.bs.dropdown.data-api', '.dropdown .dropdown-form', function (e) { e.stopPropagation(); });

/**
 * @ngdoc overview
 * @name visualizer
 * @description
 * This is the main visualizer module.
 */
angular.module('visualizer', [
    'ui.router', 
    'ct.ui.router.extras', 
    'ngAudio', 
    'a2services', 
    'a2utils', 
    'a2visobjects', 
    'a2visobjectsbrowser', 
    'a2SpeciesValidator', 
    'visualizer-layers', 
    'visualizer-spectrogram', 
    'visualizer-training-sets', 
    'visualizer-training-sets-roi_set',
    'visualizer-soundscapes',
    'visualizer-services',
    'a2-visualizer-spectrogram-Layout',
    'a2-visualizer-spectrogram-click2zoom',
    'a2-url-update-service'
])
/**
 * @ngdoc service
 * @name a2-visualizer-spectrogram-Layout.factory:VisualizerLayout
 * @description
 * The layout manager for the spectrogram.
 */
.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider
    .rule(function ($injector, $location) {
        var path = $location.path();
        var m =/visualizer\/?(.*)/.exec(path);
        if(m) {
            var params = { 
                location:m[1] 
            };
            $injector.invoke(function($state){ 
                $state.go('visualizer', params, {location:false}); 
            });
            return m[0];
        }
    });
    
    $stateProvider.state('visualizer', {
        url: '/visualizer',
        params : {
            location:''
        },
        reloadOnSearch : false,
        views: {
            'visualizer': {
                params : {
                    location:''
                },
                reloadOnSearch : false,
                template: '<a2-visualizer></a2-visualizer>'
            }
        },
    });
}])
.directive('a2Visualizer', function(){
    return { 
        restrict : 'E', 
        replace:true, 
        scope : {},
        controller : 'VisualizerCtrl',
        templateUrl: '/partials/visualizer/main.html'
    };
})
.service('a2VisualizerLocationManager', function($location){
    var locman = function(scope, prefix){
        this.scope = scope;
        this.prefix = prefix;
        this.current = '';
        this.__expected = '';
    };
    locman.prototype = {
        sync : function(){
            if(this.current == this.__expected){
                return;
            }
            this.__expected = this.current;
            this.scope.$broadcast('set-browser-location', [this.current]);
        },
        update_path : function(){
            this.set(this.current);
        },
        set : function(location, dont_sync){
            if(dont_sync){
                this.__expected = location;
            }
            $location.path(this.prefix + location);
        },
        path_changed : function(path){
            if(path === undefined){
                path = $location.path();
            }
            path = '' + path;
            if(path.indexOf(this.prefix) === 0 ){
                this.current = path.substr(this.prefix.length);
            }
        }
    };
    return locman;
})
.controller('VisualizerCtrl', function (a2VisualizerLayers, $location, $state, $scope, $timeout, itemSelection, Project, $controller, 
    a2SpectrogramClick2Zoom,
    $rootScope,
    VisualizerObjectTypes, VisualizerLayout, a2AudioPlayer, a2VisualizerLocationManager) {
    var layers = new a2VisualizerLayers($scope);
    var layer_types = layers.types;
    
    $scope.layers = layers.list; // current layers in the visualizer
    $scope.addLayer = layers.add.bind(layers);
    $scope.fullfillsRequirements   = layers.check_requirements.bind(layers);
    $scope.isSidebarVisible        = layers.sidebar_visible.bind(layers);
    $scope.isSpectrogramVisible    = layers.spectrogram_visible.bind(layers);
    $scope.canDisplayInSidebar     = layers.display_sidebar.bind(layers);
    $scope.canDisplayInSpectrogram = layers.display_spectrogram.bind(layers);

    layers.add(
        'base-image-layer',
        'browser-layer',
        'recording-layer',
        'soundscape-info-layer',
        'soundscape-regions-layer',
        'recording-soundscape-region-tags',
        'species-presence',
        'training-data',
        'zoom-input-layer'
    );    
    
    $scope.visobject = null;
    
    var location = new a2VisualizerLocationManager($scope, ($state.current.url || '/visualizer') + '/');
    $scope.location = location;
    
    $scope.$on('$locationChangeSuccess', function(){
        location.path_changed();
    });
    $scope.$watch('location.current', function(){
        location.sync();
    });
    $scope.set_location = location.set.bind(location);

    
    $scope.layout = new VisualizerLayout();
    $scope.click2zoom = new a2SpectrogramClick2Zoom($scope.layout);
    $scope.Math = Math;
    $scope.pointer = {
        x   : 0, y  : 0,
        sec : 0, hz : 0
    };
    
    $scope.selection = itemSelection.make('layer');

    $scope.getLayers = function(){
        return $scope.layers;
    };
    
    $scope.$on('browser-vobject-type', function(evt, type){
        $scope.visobject_type = type;
    });
    
    $scope.setVisObject = function(visobject, type, location){
        if (visobject) {
            $scope.visobject_location = location;
            $scope.location.set(location, true);
            var typedef = VisualizerObjectTypes[type];
            $scope.loading_visobject = typedef.prototype.getCaption.call(visobject);            
            typedef.load(visobject, $scope).then(function (visobject){
                
                console.log('VisObject loaded : ', visobject);
                
                $scope.loading_visobject = false;
                $scope.visobject = visobject;
                $scope.visobject_type = visobject.type;
            });
        } else {
            $scope.visobject = null;
        }
    };
    $scope.audio_player = new a2AudioPlayer($scope);
    $scope.$on('a2-persisted', $scope.location.update_path.bind($scope.location));
    $scope.$on('browser-available', function(){
        if($state.params && $state.params.location) {
            $scope.location.current = $state.params.location;
        }
    });
    $rootScope.$on('notify-visobj-updated', function(){
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift('visobj-updated');
        $scope.$broadcast.apply($scope, args);
    });
    $scope.$on('visobj-updated', function(visobject){
        $scope.setVisObject($scope.visobject, $scope.visobject_type, $scope.visobject_location);
    });

    // $scope.setRecording(test_data.recording);
})
.service('a2AudioPlayer', function(ngAudio){
    var a2AudioPlayer = function(scope){
        this.scope = scope;
        this.is_playing = false;
        this.is_muted = false;
        this.has_recording = false;
        this.has_next_recording = false;
        this.has_prev_recording = false;
        this.resource = null;
    };
    a2AudioPlayer.prototype = {
        setCurrentTime: function(time){
            if(this.resource) {
                this.resource.currentTime = time;
            }
        },
        load: function(url){
            this.stop();
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
        },
        prev_recording : function(){
            this.scope.$broadcast('prev-visobject');
        },
        next_recording : function(){
            this.scope.$broadcast('next-visobject');
        },
    };
    return a2AudioPlayer;
});

/**
 * @ngdoc overview
 * @name a2-visualizer-spectrogram-Layout
 * @description
 * This module stores the layout manager for the spectrogram.
 */
angular.module('a2-visualizer-spectrogram-Layout',['a2Classy'])
/**
 * @ngdoc service
 * @name a2-visualizer-spectrogram-Layout.factory:VisualizerLayout
 * @description
 * The layout manager for the spectrogram.
 */
.factory('VisualizerLayout', function(a2BrowserMetrics, makeClass){
    var align_to_interval = function(unit, domain, align){
        if(align === undefined || !domain || !domain.unit_interval){
            return unit;
        } else {
            var f = domain.from || 0, u = domain.unit_interval;
            unit = Math.floor((unit - f)/u) * u + f;
            return unit + align * u;
        }
    };

    var get_domain = function(visobject){
        return (visobject && visobject.domain) || {
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
    
    var linear_interpolate = function(x, levels){
        var l = x * (levels.length-1);
        var f=Math.floor(l), c=Math.ceil(l), m=l-f;
        
        return levels[f] * (1-m) + levels[c] * m;
    };

    var interpolate = linear_interpolate;

    return makeClass({
        constructor: function(){
            this.scale = {
                def_sec2px : 100 / 1.0,
                def_hz2px  : 100 / 5000.0,
                max_sec2px : 100 / (1.0    / 8),
                max_hz2px  : 100 / (5000.0 / 8),
                zoom   : {x:0, y:0},
                sec2px : 100 / 1.0,
                hz2px  : 100 / 5000.0
            };
            this.offset = {
                sec : 0,
                hz :0
            };
            this.tmp = {
                gutter       :  a2BrowserMetrics.scrollSize.height,
                axis_sizew   :  60,
                axis_sizeh   :  60,
                legend_axis_w : 45,
                legend_width  : 60,
                legend_gutter : 30,
                axis_lead    :  15
            };
            this.domain = {};
            this.listeners=[];
        },
        x2sec : function(x, interval_align){
            var seconds = x / this.scale.sec2px;
            seconds += this.offset.sec;
            return align_to_interval(+seconds, this.domain.x, interval_align);
        },
        y2hz : function(y, interval_align){
            var h = (this.spectrogram && this.spectrogram.height) | 0;
            var hertz = (h - y) / this.scale.hz2px;
            hertz += this.offset.hz;
            return align_to_interval(+hertz, this.domain.y, interval_align);
        },
        sec2x : function(seconds, round, interval_align){
            seconds = align_to_interval(seconds - this.offset.sec, this.domain.x, interval_align);
            var x = seconds * this.scale.sec2px;
            return round ? (x|0) : +x;
        },
        hz2y : function(hertz, round, interval_align){
            hertz = align_to_interval(hertz - this.offset.hz, this.domain.y, interval_align);
            var h = (this.spectrogram && this.spectrogram.height) | 0;
            var y = h - hertz * this.scale.hz2px;
            return round ? (y|0) : +y;
        },
        dsec2width : function(seconds1, seconds2, round, inclusive){
            if(inclusive){
                seconds1 = align_to_interval(seconds1, this.domain.x, 1);
            }
            var w = (seconds1 - seconds2) * this.scale.sec2px;
            return round ? (w|0) : +w;
        },
        dhz2height : function(hz1, hz2, round, inclusive){
            if(inclusive){
                hz1 = align_to_interval(hz1, this.domain.y, 1);
            }
            var h = (hz1 - hz2) * this.scale.hz2px;
            return round ? (h|0) : +h;
        },
        apply : function(container, $scope, width, height, fix_scroll_center){
            var layout_tmp = this.tmp;
            var visobject = $scope.visobject;
            var domain = this.domain = get_domain(visobject);
            
            var avail_w = width  - layout_tmp.axis_sizew - layout_tmp.axis_lead;
            if(domain.legend){
                avail_w -= layout_tmp.legend_width + layout_tmp.legend_gutter;
            }
            var avail_h = height - layout_tmp.axis_sizeh - layout_tmp.axis_lead - layout_tmp.gutter;
            var cheight = container[0].clientHeight;
            var zoom_levels_x = this.scale.zoom.levelx = [
                avail_w/domain.x.span,
                this.scale.max_sec2px
            ];
            var zoom_levels_y = this.scale.zoom.levely = [
                avail_h/domain.y.span,
                this.scale.max_hz2px
            ];
            var zoom_sec2px = interpolate(this.scale.zoom.x, zoom_levels_x);
            var zoom_hz2px  = interpolate(this.scale.zoom.y, zoom_levels_y);
            
            var spec_w = Math.max(avail_w, Math.ceil(domain.x.span * zoom_sec2px));
            var spec_h = Math.max(avail_h, Math.ceil(domain.y.span * zoom_hz2px ));
            
            
            var scalex = make_scale(domain.x, [0, spec_w]);
            var scaley = make_scale(domain.y, [spec_h, 0]);
            var scalelegend;
            var l = this.l = {};
            l.spectrogram = { css:{
                top    : layout_tmp.axis_lead,
                left   : layout_tmp.axis_sizew,
                width  : spec_w,
                height : spec_h,
            }};
            l.y_axis = { scale : scaley, 
                css:{
                    top    : 0,
                    left   : container.scrollLeft()
                }, attr:{
                    width  : layout_tmp.axis_sizew,
                    height : spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
                }
            };
            l.x_axis = { scale : scalex,  
                css:{
                    left : layout_tmp.axis_sizew -  layout_tmp.axis_lead,
                    // left : layout_tmp.axis_sizew -  layout_tmp.axis_lead,
                    top  : container.scrollTop() + height  - layout_tmp.axis_sizeh - layout_tmp.gutter
                }, attr:{
                    height : layout_tmp.axis_sizeh,
                    width  : spec_w + 2*layout_tmp.axis_lead
                }
            };
            
            this.has_legend = $scope.has_legend = !!domain.legend;
            
            if(domain.legend){
                l.legend = { scale : scalelegend, 
                    css:{
                        top  : 0,
                        left : container.scrollLeft() + width - a2BrowserMetrics.scrollSize.width - layout_tmp.legend_width - layout_tmp.legend_gutter
                    }, attr:{
                        width  : layout_tmp.legend_width,
                        height : spec_h + 2*layout_tmp.axis_lead
                    }
                };
                scalelegend = d3.scale.linear().domain([domain.legend.from, domain.legend.to]).range([spec_h-2, 0]);
            } else {
                l.legend = {};
            }
            //l.x_axis.attr.height = cheight - l.x_axis.css.top - 1;
            ['spectrogram', 'y_axis', 'x_axis', 'legend'].forEach((function(i){
                var li = l[i];
                this[i] = li.css;
                if(li.attr){
                    $.extend(this[i], li.attr);
                }
                if(li.scale){
                    this[i].scale = li.scale;
                }
            }).bind(this));
            
            this.offset.sec = domain.x.from;
            this.offset.hz  = domain.y.from;
            this.scale.sec2px = spec_w / domain.x.span;
            this.scale.hz2px  = spec_h / domain.y.span;
            this.viewport = {
                left : l.spectrogram.css.left,
                top  : l.spectrogram.css.top,
                width  : avail_w,
                height : avail_h
            };
            
            var sh = l.spectrogram.css.height;
            var sw = l.spectrogram.css.width ;
                            
            this.root = {
                left : 0,
                top  : 0,
                //width  : width,
                //height : height,
                width  : width  - (avail_h < sh ? a2BrowserMetrics.scrollSize.width  : 0),
                height : height - (avail_w < sw ? a2BrowserMetrics.scrollSize.height : 0)
            };

            var scroll_center;
            if(this.center){
                scroll_center = {
                    left: this.scale.sec2px * this.center.s + l.spectrogram.css.left - width/2.0,
                    top: -this.scale.hz2px * this.center.hz - height/2.0 + l.spectrogram.css.top + l.spectrogram.css.height
                };
            }

            l.domain = domain;
            l.scroll_center = scroll_center;
            l.scale = {
                x : scalex,
                y : scaley,
                legend : scalelegend
            };
            
            
            for(var eh=this.listeners, ehi=0, ehe=eh.length; ehi < ehe; ++ehi){
                eh[ehi](this, container, $scope, width, height, fix_scroll_center);
            }

        }
    });
})
;
