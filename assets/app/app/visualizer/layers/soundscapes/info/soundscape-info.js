angular.module('a2.visualizer.layers.soundscapes.info', [
    'visualizer-services', 
    'a2.utils', 
    'a2.soundscapeRegionTags',
    'a2.url-update-service',
    'a2.directives',
    'a2.directive.a2-palette-drawer',
    'a2.service.colorscale-gradients',
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.soundscapes.info.object:soundscape-info-layer
     * @description Soundscape Info layer. 
     * adds the soundscape-info-layer layer_type to layer_types. This layer uses
     * a2.visualizer.layers.soundscapes.info.controller:a2VisualizerSoundscapeInfoLayerController as controller,
     * and requires a visobject of type soundscape to be selected.
     * The layer has a visibility button.
     * The layer does not have an associated spectrogram layer.
     */
    layer_typesProvider.addLayerType({
        type: "soundscape-info-layer",
        title: "",
        controller: 'a2VisualizerSoundscapeInfoLayerController as info',
        require: {
            type: 'soundscape',
            browsetype: 'soundscape',
            selection: true
        },
        display: {
            spectrogram: false
        },
        visible: true,
        hide_visibility: true
    });
})
.controller('a2VisualizerSoundscapeInfoLayerController', function($scope, $modal, $location, a2Soundscapes, a2UserPermit, notify) {
    var self = this;
    
    a2Soundscapes.getAmplitudeReferences().then((function(amplitudeReferences){
        this.amplitudeReferences = amplitudeReferences.reduce(function(_, item){
            _[item.value] = item;
            return _;
        }, {});
    }).bind(this));
    
    this.edit_visual_scale = function(soundscape){
        if(!a2UserPermit.can('manage soundscapes')) {
            notify.error('You do not have permission to edit soundscapes');
            return;
        }
        
        $modal.open({
            templateUrl : '/app/visualizer/layers/soundscapes/info/edit_soundscape_visual_scale_modal.html',
            controller  : 'a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController as controller',
            // size        : 'sm',
            resolve     : {
                amplitudeReferences : function(a2Soundscapes){
                    return a2Soundscapes.getAmplitudeReferences();
                },
                data : function(){ return {
                    soundscape : soundscape
                }; }
            }
        }).result.then(function () {
            /// TODO::: aaa
        });
    };
})
.controller('a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController', function(
        $scope, $modalInstance, 
        a2Soundscapes, 
        amplitudeReferences,
        data, a2UrlUpdate, ColorscaleGradients
    ){
        var soundscape = data.soundscape;
        $scope.soundscape = soundscape;
        $scope.palettes = ColorscaleGradients.gradients;
        
        $scope.data = {
            palette : soundscape.visual_palette,
            visual_max : soundscape.visual_max_value || soundscape.max_value,
            normalized : !!soundscape.normalized,
            amplitudeThreshold : soundscape.threshold,
            amplitudeReference : amplitudeReferences.reduce(function(_, item){
                return _ || (item.value == soundscape.threshold_type ? item : null);
            }, null)
        };
        
        this.amplitudeReferences = amplitudeReferences;
        
        $scope.ok = function(){
            a2Soundscapes.setVisualizationOptions(soundscape.id, {
                max: $scope.data.visual_max,
                palette: $scope.data.palette,
                normalized: $scope.data.normalized,
                amplitude: $scope.data.amplitudeThreshold,
                amplitudeReference: $scope.data.amplitudeReference.value
            }, function(sc){
                if(soundscape.update){
                    soundscape.update(sc);
                }
                a2UrlUpdate.update(soundscape.thumbnail);
                $modalInstance.close();
            });
        };
        
        console.log($scope);
})

.directive('a2SoundscapeDrawer', function(a2Soundscapes){
    return {
        restrict : 'E',
        template : '<canvas class="soundscape"></canvas>',
        scope    : {
            soundscape : '&',
            normalized : '&',
            amplitudeThreshold : '&',
            amplitudeThresholdType : '&',
            palette    : '&',
            visualMax  : '&'
        },
        replace  : true,
        link     : function($scope, $element, $attrs){
            var scidx;
            var soundscape;
            var norm_vector;
            var draw = function(){
                if(!soundscape || !scidx){return;}
                var vmax = $scope.visualMax() || soundscape.max_value;
                var ampTh = ($scope.amplitudeThreshold && $scope.amplitudeThreshold()) || 0;
                if($scope.amplitudeThresholdType() == 'relative-to-peak-maximum'){
                    var maxAmp = getMaxAmplitude();
                    ampTh *= maxAmp;
                }
                
                var pal = $scope.palette();
                if(!pal || !pal.length){return;}
                var pallen1 = 1.0 * (pal.length-1);
                var color = function(v){
                    var i = Math.max(0, Math.min(((v * pallen1 / vmax) | 0), pallen1));
                    return pal[i];
                };
                
                if(norm_vector){
                    vmax = 1;
                    var _cl = color;
                    color = function(v, j){
                        var n = norm_vector[j] || 1;
                        return _cl(v / n);
                    };
                }
                
                var w = scidx.width, h = scidx.height;
                $element.attr('width', w);
                $element.attr('height', h);
                
                var ctx = $element[0].getContext('2d');
                ctx.fillStyle = color(0);
                ctx.fillRect(0, 0, w, h);
                
                for(var i in scidx.index){ 
                    var row = scidx.index[i];
                    for(var j in row){
                        var cell = row[j];
                        if(ampTh && cell[1]){
                            var act=0;
                            for(var al=cell[1], ali=0,ale=al.length; ali < ale; ++ali){
                                if(al[ali] > ampTh){ ++act; }
                            }                            
                            ctx.fillStyle = color(act, j);
                        } 
                        else {
                            ctx.fillStyle = color(cell[0], j);                            
                        }
                        ctx.fillRect(j, h - i - 1, 1, 1);
                    }
                }
            };
            
            var getMaxAmplitude = function(){
                if(scidx.__maxAmplitude === undefined){
                    scidx.__maxAmplitude = Object.keys(scidx.index).reduce(function(maxAmp, i){
                        var row = scidx.index[i];
                        return Object.keys(row).reduce(function(maxAmp, j){
                            var cellMax = Math.max.apply(Math, row[j][1] || [0]);
                            return Math.max(cellMax, maxAmp);
                        }, maxAmp);
                    }, 0);
                    console.log("scidx.__maxAmplitude", scidx.__maxAmplitude);
                }
                
                return scidx.__maxAmplitude;
                
            };
            
            $scope.$watch('soundscape()', function(_soundscape){
                soundscape = _soundscape;
                if(soundscape) a2Soundscapes.getSCIdx(soundscape.id, {count:1}).then(function(_scidx){
                    scidx = _scidx;
                    draw();
                });
            });
            $scope.$watch('normalized()', function(_normalized){
                if(!_normalized){ 
                    norm_vector = null; 
                    draw();
                } else {
                    if(norm_vector){
                        draw();
                    } else {
                        a2Soundscapes.getNormVector(soundscape.id).then(function(_norm_vector){
                            norm_vector = _norm_vector;
                            draw();
                        });
                    }
                }
            });
            $scope.$watch('palette()', draw);
            $scope.$watch('amplitudeThreshold()', draw);
            $scope.$watch('amplitudeThresholdType()', draw);
            $scope.$watch('visualMax()', draw);

        }
    };

})
;
