$(document)
  .on('click.bs.dropdown.data-api', '.dropdown .dropdown-form', function (e) { e.stopPropagation(); });


angular.module('visualizer', [
    'ui.router', 'ngAudio', 
    'a2services', 'a2utils', 'a2visobjects', 'a2visobjectsbrowser', 'a2SpeciesValidator', 
    'visualizer-layers', 'visualizer-spectrogram', 
    'visualizer-training-sets', 'visualizer-training-sets-roi_set',
    'visualizer-soundscapes',
    'visualizer-services'
])
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
        'soundscape-layer',
        'recording-soundscape-region-tags',
        'species-presence',
        'training-data'
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
            $scope.location.set(location, true);
            var typedef = VisualizerObjectTypes[type];
            $scope.loading_visobject = typedef.prototype.getCaption.call(visobject);            
            typedef.load(visobject, $scope).then(function (visobject){
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
})

.factory('VisualizerLayout', function(){
    var layout = function(){};
    var align_to_interval = function(unit, domain, align){
        if(align === undefined || !domain || !domain.unit_interval){
            return unit;
        } else {
            var f = domain.from || 0, u = domain.unit_interval;
            unit = Math.floor((unit - f)/u) * u + f;
            return unit + align * u;
        }
    };
    layout.prototype = {
        domain: {},
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
        scale : {
            def_sec2px : 100 / 1.0,
            def_hz2px  : 100 / 5000.0,
            max_sec2px : 100 / (1.0    / 8),
            max_hz2px  : 100 / (5000.0 / 8),
            zoom   : {x:0, y:0},
            sec2px : 100 / 1.0,
            hz2px  : 100 / 5000.0
        },
        offset : {
            sec : 0,
            hz :0
        }
    };
    return layout;
})
;
