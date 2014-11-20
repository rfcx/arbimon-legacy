$(document)
  .on('click.bs.dropdown.data-api', '.dropdown .dropdown-form', function (e) { e.stopPropagation() })


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
    }
})
.controller('VisualizerCtrl', function (a2VisualizerLayers, $location, $state, $scope, $timeout, ngAudio, itemSelection, Project, $controller, 
    VisualizerObjectTypes, VisualizerLayout) {
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
        'soundscape-layer',
        'species-presence',
        'training-data'
    );    
    
    $scope.visobject = null;
    
    $scope.set_location = function(location){
        $location.path("/visualizer/"+location);
    };

    
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
            var typedef = VisualizerObjectTypes[type];
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
})

.factory('VisualizerLayout', function(){
    var layout = function(){};
    layout.prototype = {
        x2sec : function(x){
            var seconds = x / this.scale.sec2px;
            seconds += this.offset.sec;
            return +seconds;
        },
        y2hz : function(y){
            var h = (this.spectrogram && this.spectrogram.height) | 0;
            var hertz = (h - y) / this.scale.hz2px;
            hertz += this.offset.hz;
            return +hertz;
        },
        sec2x : function(seconds, round){
            seconds -= this.offset.sec;
            var x = seconds * this.scale.sec2px;
            return round ? (x|0) : +x;
        },
        hz2y : function(hertz, round){
            hertz -= this.offset.hz;
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
        },
        offset : {
            sec : 0,
            hz :0
        }
    };
    return layout;
})
;
