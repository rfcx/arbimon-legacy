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
    'soundscape-layer' : {
        title : "",
        require : {type:'soundscape', selection : true},
        visible : true,
        display : {sidebar:false},
        type    : "soundscape-layer"
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
                var visobject_type = this.$scope.visobject ? this.$scope.visobject.type : this.$scope.visobject_type;
                if(req.type instanceof Array){
                    var idx = req.type.indexOf(visobject_type);
                    if(idx==-1){
                        return false;
                    }
                } else if( visobject_type != req.type){
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
