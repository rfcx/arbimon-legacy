$(document)
  .on('click.bs.dropdown.data-api', '.dropdown .dropdown-form', function (e) { e.stopPropagation() })

/**
var test_data = {
    recording : {
        tags    : [
            'species://coqui', 'awesome'
        ],
    },
    layers : [
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
*/

angular.module('visualizer', [
    'ui.router', 'ngAudio', 
    'a2services', 'a2utils', 'a2visobjectsbrowser', 'a2SpeciesValidator', 
    'visualizer-layers', 'visualizer-spectrogram', 
    'visualizer-training-sets', 'visualizer-training-sets-roi_set',        
    'visualizer-services'
])
.directive('a2Visualizer', function(){
    return { 
        restrict : 'E', 
        replace:true, 
        scope : {},
        controller : 'VisualizerCtrl',
        templateUrl: '/partials/visualizer/main.html'
    }
})

.service('VisualizerCtrl_visobj_types', function ($q, Project, $injector) {
    var type_list = ["recording", "soundscape"];
    var types = {};
    var inject = type_list.map(function(type){return 'VisualizerCtrl_visobj_' + type + "_type";});
    inject.push(function(){ 
        for(var a=arguments, t=type_list, i=0, e=t.length; i < e; ++i){
            types[t[i]] = a[i];
        }
    });
    $injector.invoke(inject);    
    return types;
})

.service('VisualizerCtrl_visobj_recording_type', function ($q, Project, $injector) {
    var recording = function(data){
        for(var i in data){ this[i] = data[i]; }
        this.duration      = this.stats.duration;
        this.sampling_rate = this.stats.sample_rate;
        // fix up some stuff
        this.max_freq = this.sampling_rate / 2;
        // setup the domains
        this.domain = {
            x : {
                from : 0,
                to   : this.duration,
                span : this.duration,
                unit : 'Time ( s )',
                ticks : 60
            },
            y : {
                from : 0,
                to   : this.max_freq,
                span : this.max_freq,
                unit : 'Frequency ( kHz )',
                tick_format : function(v){return (v/1000) | 0; }
            }
        };
        // set it to the scope
        this.tiles.set.forEach((function(tile){
            tile.src="/api/project/test1/recordings/tiles/"+this.id+"/"+tile.i+"/"+tile.j;
        }).bind(this));
    };
    recording.fetch = function(visobject){
        var d = $q.defer();
        Project.getRecordingInfo(visobject.id, function(data){
            visobject = new recording(data);
            d.resolve(visobject);
        });
        return d.promise;
    };
    recording.load = function(visobject, $scope){
        return recording.fetch(visobject).then(function(visobject){
            if(visobject.audioUrl) {
                $scope.audio_player.load(visobject.audioUrl);
            }
            return visobject;
        });
    };
    recording.prototype = {
        type : "recording",
        zoomable : true,
        getCaption : function(){
            return this.file;
        }
    };
    return recording;
})

.service('VisualizerCtrl_visobj_soundscape_type', function ($q, Project, $injector) {
    var soundscape = function(data){
        for(var i in data){ this[i] = data[i]; }
        
        var t0=this.min_t, t1=this.max_t;
        var f0=this.min_f, f1=this.max_f;
        var dt= t1 - t0  , df= f1 - f0  ;
        
        var time_unit = ({
            'time_of_day'   : 'Time (Hour in Day)',
            'day_of_month'  : 'Time (Day in Month)',
            'day_of_year'   : 'Time (Day in Year )',
            'month_in_year' : 'Time (Month in Year)',
            'day_of_week'   : 'Time (Weekday) ',
            'year'          : 'Time (Year) '
        })[this.aggregation];

        // setup the domains
        this.domain = {
            x : {
                from : t0, to : t1, span : dt, ticks : dt,
                unit : time_unit || 'Time ( s )'
            },
            y : {
                from : f0, to : f1, span : df,
                unit : 'Frequency ( kHz )',
                tick_format : function(v){return (v/1000) | 0; }
            }
        };
        // set it to the scope
        this.tiles = { x:1, y:1, set : [{
            i:0, j:0, 
            s : 0, hz : f1, ds  : dt, dhz : df,
            src : this.thumbnail,
            crisp : true
        }]};
        console.log(this.tiles.set[0]);
    };
    soundscape.fetch = function(visobject){
        var d = $q.defer();
        visobject = new soundscape(visobject);
        d.resolve(visobject);
        return d.promise;
    };
    soundscape.load = function(visobject, $scope){
        return soundscape.fetch(visobject);
    };
    soundscape.prototype = {
        type : "soundscape",
        getCaption : function(){
            return this.name;
        }
    };
    return soundscape;
})

.controller('VisualizerCtrl', function (a2VisualizerLayers, $location, $state, $scope, $timeout, ngAudio, itemSelection, Project, $controller, VisualizerCtrl_visobj_types) {
    var update_location_path = function(){
        if($scope.recording){
            var rec  = $scope.recording;
            var lovo = rec.lovo || 'rec';
            $scope.set_location((rec.lovo || 'rec') + '/' + (rec.id));
        }
    };

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
        'species-presence',
        'training-data'
    );    
    
    $scope.visobject = null;
    
    $scope.set_location = function(location){
        $location.path("/visualizer/"+location);
    };

    
    $scope.layout = {
        sec2x : function(seconds, round){
            var x = seconds * this.scale.sec2px;
            return round ? (x|0) : +x;
        },
        hz2y : function(hertz, round){
            var h = (this.spectrogram && this.spectrogram.height) | 0;
            var y = h - hertz * this.scale.hz2px;
            return round ? (y|0) : +y;
        },
        dsec2width : function(seconds1, seconds2, round){
            var w = (seconds1 - seconds2) * this.scale.sec2px;
            return round ? (w|0) : +w;
        },
        dhz2height : function(hz1, hz2, round){
            var h = (hz1 - hz2) * this.scale.hz2px;
            return round ? (h|0) : +h;
        },
        scale : {
            def_sec2px : 100 / 1.0,
            def_hz2px  : 100 / 5000.0,
            max_sec2px : 100 / (1.0    / 8),
            max_hz2px  : 100 / (5000.0 / 8),
            zoom   : {x:0, y:0},
            sec2px : 100 / 1.0,
            hz2px  : 100 / 5000.0
        }
    };
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
            var typedef = VisualizerCtrl_visobj_types[type];
            $scope.loading_visobject = typedef.prototype.getCaption.call(visobject);            
            typedef.load(visobject, $scope).then(function (visobject){
                $scope.loading_visobject = false;
                $scope.visobject = visobject;
                $scope.visobject_type = visobject.type;
                $scope.set_location(location);
            });
        } else {
            $scope.visobject = null;
        }
    };
    $scope.audio_player = {
        is_playing : false,
        is_muted   : false,
        has_recording : false,
        has_next_recording : false,
        has_prev_recording : false,
        resource: null,
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
            $scope.$broadcast('prev-visobject');
        },
        next_recording : function(){
            $scope.$broadcast('next-visobject');
        },
    };
    $scope.$on('a2-persisted', update_location_path);
    $scope.$on('browser-available', function(){
        if($state.params && $state.params.location) {
            $scope.$broadcast('set-browser-location', [$state.params.location]);
        }
    });

    // $scope.setRecording(test_data.recording);
});

angular.module('visualizer-services', ['a2services'])
.value('layer_types',{
    'browser-layer' : {
        title : "",
        visible : true,
        display:{spectrogram:false},
        sidebar_only : true,
        hide_visibility : true,
        type    : "browser-layer"
    },
    'recording-layer' : {
        title : "",
        require: {type:'recording'},
        visible : true,
        hide_visibility : true,
        type    : "recording-layer"
    },
    'base-image-layer' : {
        title   : "",
        require : {type:['recording', 'soundscape'], selection : true},
        display : {sidebar:false},
        visible : true,
        type    : "base-image-layer",
    },    
    'frequency-adjust-layer' : true,
    'species-presence' : {
        title   : "",
        require: {type:'recording', selection : true},
        display:{spectrogram:false},
        sidebar_only : true,
        visible : false,
        hide_visibility : true,
        type    : "species-presence",
    },
    'training-data' : {
        title   : "",
        controller : 'a2VisualizerTrainingSetLayerController as training_data',
        require: {type:'recording', selection : true},
        visible : true,
        type    : "training-data",
    }
})
.service('a2VisualizerLayers', function(layer_types, $controller){
    var layers = function($scope){
        this.$scope = $scope;
        this.list   = [];
    };
    layers.prototype = {
        types : layer_types,
        __new_layer__ : function(layer_type){
            var layer_def = this.types[layer_type];
            if (layer_def) {
                var layer_maker = function(){};
                layer_maker.prototype = layer_def;
                var layer = new layer_maker();
                if (layer.controller && typeof layer.controller == 'string') {
                    var cname = /^(.*?)( as (.*?))$/.exec(layer.controller);
                    if(cname) {
                        layer[cname[2] ? cname[3] : 'controller'] = $controller(cname[1], {$scope : this.$scope});
                    }
                }
                return layer;
            } else {
                return null;
            }
        },
        add   : function(){
            for(var a=arguments, i=0, e=a.length; i < e; ++i){
                var layer_type = a[i];
                if(layer_types[layer_type]) {
                    this.list.push(this.__new_layer__(layer_type));
                }
            }
        },
        check_requirements : function(req){
            if(!req){
                return true;
            } else if(req.selection && !this.$scope.visobject){
                return false;
            } else if(req.type){
                if(req.type instanceof Array){
                    var idx = req.type.indexOf(this.$scope.visobject_type);
                    if(idx==-1){
                        return false;
                    }
                } else if( this.$scope.visobject_type != req.type){
                    return false;
                }
            }
            return true;
        },
        sidebar_visible : function(l){
            if(l.sidebar_visible && !l.sidebar_visible($scope)){
                return false;
            } else if(!this.check_requirements(l.require)){
                return false;
            }

            return true;
        },
        spectrogram_visible : function(l){
            return this.check_requirements(l.require) && l.visible;
        },
        display_sidebar : function(l){
            return !l.display || l.display.sidebar !== false;
        },
        display_spectrogram : function(l){
            return !l.display || l.display.spectrogram !== false;
        }
    };
    
    return layers;
})
.service('training_set_types',function(Project){
    return {
        'roi_set' : {
            has_layout : true,
            templates  : {
                layer_item : '/partials/visualizer/layer-item/training-sets/roi_set.html',
                new_modal : '/partials/visualizer/modal/new_roi_set_tset_partial.html'
            },
            action : {
                collect_new_tset_data : function(sdata, tset_data, sval){
                    if(sdata.class){
                        tset_data.class = sdata.class.id;
                    } else {
                        sval.class = "Please select a project class.";
                        sval.count++;
                    }
                }
            },
            controller : 'a2VisualizerSpectrogramTrainingSetRoiSetData'
        }
    };
})
.controller('a2ProjectClasses', function(Project){
    var self = this;
    Project.getClasses(function(list){
        self.list = list;
    })
})


angular.module('visualizer-layers', ['visualizer-services', 'a2utils'])
.directive('a2VisualizerLayerItem', function(layer_types, $compile, $templateFetch){
    return {
        restrict : 'E',
        replace  : true,
        templateUrl : '/partials/visualizer/layer-item/default.html',
        link     : function(scope, element, attrs){
            var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
            var layer_key  = layer_types[layer_type] ? layer_types[layer_type].type : null;
            if(layer_key && layer_key != 'default') {
                var layer_url  = '/partials/visualizer/layer-item/' + layer_key + '.html';
                var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                    var layer_el   = $compile(layer_tmp)(scope);
                    element.append(layer_el.children().unwrap());
                });
            }
        }
    }
});

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
        gutter     :  a2BrowserMetrics.scrollSize.height,
        axis_sizew :  60,
        axis_sizeh :  60,
        axis_lead  :  15
    }
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
            }
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
                }
                $scope.layout.center = {
                    s  : ($element.scrollLeft() - $scope.layout.spectrogram.left + $element.width()/2.0) / $scope.layout.scale.sec2px,
                    hz : ($scope.layout.spectrogram.top + $scope.layout.spectrogram.height - $element.scrollTop() - $element.height()/2.0) / $scope.layout.scale.hz2px,
                }
                $scope.layout.y_axis.left = $element.scrollLeft();
                $element.children('.axis-y').css({left: $scope.layout.y_axis.left + 'px'});
                $scope.layout.x_axis.top = $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh - layout_tmp.gutter;
                $element.children('.axis-x').css({top: $scope.layout.x_axis.top + 'px'});
                $element.find('.a2-visualizer-spectrogram-affixed').each(function(i, el){
                    a2AffixCompute($element, $(el), $scope.layout);
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
            $scope.layout.apply = function(width, height, fix_scroll_center){
                console.log("$scope.recording : ", $scope.visobj);
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
                }
                var avail_w = width  - layout_tmp.axis_sizew - layout_tmp.axis_lead;
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

                var scalex = d3.scale.linear().domain([domain.x.from, domain.x.to]).range([0, spec_w]);
                var scaley = d3.scale.linear().domain([domain.y.from, domain.y.to]).range([spec_h, 0]);
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
                //l.x_axis.attr.height = cheight - l.x_axis.css.top - 1;
                
                $scope.layout.scale.sec2px = spec_w / domain.x.span;
                $scope.layout.scale.hz2px  = spec_h / domain.y.span;
                $scope.layout.viewport = {
                    left : l.spectrogram.css.left,
                    top  : l.spectrogram.css.top,
                    width  : avail_w,
                    height : avail_h
                }
                
                var scroll_center;
                if($scope.layout.center){
                    var scroll_center = {
                        left: $scope.layout.scale.sec2px * $scope.layout.center.s + l.spectrogram.css.left - width/2.0,
                        top: -$scope.layout.scale.hz2px * $scope.layout.center.hz - height/2.0 + l.spectrogram.css.top + l.spectrogram.css.height
                    }
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
                    call(d3.svg.axis().
                        ticks(domain.x.ticks).
                        scale(scalex).
                        orient("bottom")
                    );
                
                
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
                    call(d3.svg.axis().
                        tickFormat(domain.y.tick_format).
                        scale(scaley).
                        orient("left")
                    );

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
            console.log("link     : function(scope, element, attrs){", scope, element, attrs);
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


angular.module('visualizer-training-sets', ['visualizer-services', 'a2utils'])
.controller('a2VisualizerTrainingSetLayerController', function($scope, $modal, $controller, $timeout, a2TrainingSets){
    var self=this;
    self.tset      = null;
    self.tset_type = null;
    self.tset_list = [];
    self.data      = null;

    a2TrainingSets.getList(function(training_sets){
        self.tset_list = training_sets;
        if(!self.tset && training_sets && training_sets.length > 0) {
            self.tset = training_sets[0];
        }
    });


    self.add_new_tset = function(){
        $modal.open({
            templateUrl : '/partials/visualizer/modal/add_tset.html',
            controller  : 'a2VisualizerAddTrainingSetModalController'
        }).result.then(function (new_tset) {
            if(new_tset && new_tset.id) {
                self.tset_list.push(new_tset);
                if(!self.tset) {
                    self.tset = new_tset;
                }
            }
        });
    }

    var fetchTsetData = function(){
        var tset = self.tset && self.tset.name;
        var tset_type = self.tset && self.tset.type;
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        if(tset && rec) {
            if(!self.data || self.data.type != tset_type){
                var cont_name = tset_type.replace(/(^|-|_)(\w)/g, function(_,_1,_2,_3){ return _2.toUpperCase()});
                cont_name = 'a2VisualizerTrainingSetLayer'+cont_name+'DataController';
                self.data = $controller(cont_name,{$scope : $scope});
            }
            self.data.fetchData(tset, rec);
        }
    };

    $scope.$watch(function(){return self.tset;}, fetchTsetData);
    $scope.$watch('visobject', fetchTsetData);
})
.directive('a2VisualizerSpectrogramTrainingSetData', function(training_set_types, $compile, $controller, $templateFetch){
    return {
        restrict : 'A',
        template : '<div class="training-set-data"></div>',
        replace  : true,
        link     : function(scope, element, attrs){
            scope.$watch(attrs.a2VisualizerSpectrogramTrainingSetData, function(tset_type){
                var type_def = training_set_types[tset_type];
                element.attr('data-tset-type', tset_type);
                if(type_def) {
                    if(type_def.has_layout){
                        var tmp_url  = '/partials/visualizer/spectrogram-layer/training-sets/' + tset_type + '.html';
                        $templateFetch(tmp_url, function(tmp){
                            element.empty().append($compile(tmp)(scope));
                        });
                    }
                }
            });
        }
    }
})
.controller('a2VisualizerAddTrainingSetModalController', function($scope, $modalInstance, Project, training_set_types, a2TrainingSets){
    $scope.data = {
        name : '',
        type : null
    }
    $scope.typedefs = training_set_types;
    Project.getClasses(function(project_classes){
        $scope.project_classes = project_classes;
    });
    a2TrainingSets.getTypes(function(tset_types){
        $scope.tset_types = tset_types;
        if(tset_types && tset_types.length == 1) {
            $scope.data.type = tset_types[0];
        }
    });
    $scope.ok = function(){
        $scope.validation={count:0};
        
        var sdata=$scope.data, sval = $scope.validation;
        var tset_data = {};
        var tst;

        if(sdata.name){
            tset_data.name = $scope.data.name;
        } else {
            sval.name = "Training set name is required.";
            sval.count++;
        }

        if(sdata.type && sdata.type.id){
            tset_data.type = sdata.type.identifier;
            tst = training_set_types[sdata.type.identifier];
        } else {
            sval.type = "Training set type is required.";
            sval.count++;
        }

        if(tst && tst.action && tst.action.collect_new_tset_data){
            tst.action.collect_new_tset_data(sdata, tset_data, sval);
        }

        $scope.form_data=tset_data;

        if(sval.count == 0){
            a2TrainingSets.add(tset_data, function(new_tset){
                if(new_tset.error) {
                    sval[new_tset.field] = new_tset.error;
                    return;
                }
                $modalInstance.close(new_tset);
            });
        }
    };
});

angular.module('visualizer-training-sets-roi_set', ['visualizer-services'])
.controller('a2VisualizerTrainingSetLayerRoiSetDataController', function($timeout, a2TrainingSets, training_set_types){
    var self=this;
    self.type='roi_set';
    self.typedef  = training_set_types['roi_set'];
    self.fetchData = function(tset, rec){
        self.tset = tset;
        self.recording = rec;
        a2TrainingSets.getData(tset, rec, function(data){
            $timeout(function(){
                self.rois = data;
            })
        })
    };
    self.editor = {
        roi    : null, 
        points : null,
        valid  : false,
        min_eps: .001,
        reset: function(){
            this.roi    = null;
            this.points = null;
            this.tracer = null;
            this.valid  = false;
        },
        make_new_roi: function(){
            this.roi    = {};
            this.points = [];
            this.valid  = false;
        },
        add_tracer_point : function(point){
            if(this.roi){
                var tracer = [point.sec, point.hz];
                this.tracer = tracer;
                this.validate([tracer]);
            }
        },
        add_point : function(point, min_eps){
            min_eps = min_eps || this.min_eps;
            var similars = this.points && this.points.filter(function(pt){
                var dx=pt[0] - point.sec, dy=(pt[1] - point.hz)/1000.0, dd = dx*dx + dy*dy;
                return  dd <= min_eps;
            });
            if(similars && similars.length > 0){
                return;
            }
            if(!this.roi){
                this.make_new_roi();
            }
            if(this.points.length < 2){
                this.points.push([point.sec, point.hz]);
            }
            this.validate();
        },
        validate : function(tmp_points){
            var secs = this.points.map(function(x){return x[0];});
            var hzs  = this.points.map(function(x){return x[1];});
            if(tmp_points){
                secs.push.apply(secs, tmp_points.map(function(x){return x[0];}));
                hzs .push.apply(hzs , tmp_points.map(function(x){return x[1];}));
            }
            this.roi.x1 = Math.min.apply(null, secs);
            this.roi.y1 = Math.min.apply(null, hzs);
            this.roi.x2 = Math.max.apply(null, secs);
            this.roi.y2 = Math.max.apply(null, hzs);
            this.valid = this.points.length >= 2;
        },
        submit: function(){ 
            a2TrainingSets.addData(self.tset, {
                recording : self.recording,
                roi : this.roi
            }, (function(new_tset_data){
                $timeout((function(){
                    this.reset();
                    self.rois.push(new_tset_data);
                }).bind(this));
            }).bind(this))
        }
    };
})


angular.module('a2SpeciesValidator', ['a2utils', 'a2Infotags'])
.directive('a2SpeciesValidator', function (Project) {
    var project = Project;
    return {
        restrict : 'E',
        scope : {
            recording : '=recording'
        },
        replace : true,
        templateUrl : '/partials/visualizer/validator-main.html',
        link     : function($scope, $element, $attrs){
            var class2key = function(project_class){
                var cls = /number|string/.test(typeof project_class) ? 
                    $scope.classes.filter(function(pc){return pc.id == project_class}).shift() :
                    project_class;
                return cls && [cls.species, cls.songtype].join('-');
            };
            
            var add_validation = function(validation){
                var key     = [validation.species, validation.songtype].join('-');
                var present =  validation.present;
                $scope.validations[key] = present | 0;
            };

            var load_project_classes = function(){
                Project.getClasses(function(classes){
                    $scope.classes = classes;
                });
            };
            
            
            
            $scope.$on('a2-persisted', load_project_classes);
            
            $scope.classes = [];
            $scope.is_selected = {};
            $scope.select = function(project_class, $event){
                if($($event.target).is('button, a')){
                    return;
                }
                
                if($event.shiftKey){
                    $scope.is_selected[project_class.id] = true;
                    var sel_range={from:1/0, to:-1/0};
                    $scope.classes.forEach(function(pc, idx){
                        if($scope.is_selected[pc.id]){
                            sel_range.from = Math.min(sel_range.from, idx);
                            sel_range.to   = Math.max(sel_range.to  , idx);
                        }
                    });
                    for(var si = sel_range.from, se = sel_range.to + 1; si < se; ++si){
                        $scope.is_selected[$scope.classes[si].id] = true;
                    }
                } else if($event.ctrlKey){
                    $scope.is_selected[project_class.id] = !$scope.is_selected[project_class.id];
                } else {
                    $scope.is_selected={};
                    $scope.is_selected[project_class.id] = true;
                }
            };
            $scope.validations = {};
            $scope.validate = function(project_class, val){
                var keys=[], key_idx = {};
                var k = class2key(project_class);
                if(k && !key_idx[k]){key_idx[k]=true; keys.push(k);}
                for(var sel_pc_id in $scope.is_selected){
                    if($scope.is_selected[sel_pc_id]){
                        k = class2key(sel_pc_id);
                        if(k && !key_idx[k]){key_idx[k]=true; keys.push(k);}
                    }
                }
                
                if(keys.length > 0){
                    Project.validateRecording($scope.recording.id, {
                        'class' : keys.join(','),
                        val     : val
                    }, function(validations){
                        validations.forEach(function(validation){
                            var key = class2key(validation);
                            $scope.validations[key] = validation.val;
                        });
                    })
                }
                
            };
            $scope.val_options = [{label:"Present", val:1}, {label:"Not Present", val:0}, {label:"Clear", val:2}];
            $scope.val_state = function(project_class, val_options){
                if(!val_options){val_options = $scope.val_options;}
                var key = class2key(project_class), val = $scope.validations[key];
                var returnVal;
                if (val == 2) {
                    returnVal = val_options[2];
                }
                else returnVal = typeof val == 'undefined' ? val : ( val ? val_options[0]: val_options[1] );
                return returnVal;
            }
            $scope.$watch('recording', function(recording){
                $scope.validations = {};
                recording && recording.validations && recording.validations.forEach(add_validation);
            });
            
            load_project_classes();
        }
    };
});
