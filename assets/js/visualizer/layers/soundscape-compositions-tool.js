angular.module('a2.visualizer.layer.soundscape-composition-tool', [
    'a2.srv.soundscape-composition',
    'arbimon2.directive.validation-dropdown'
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layer.soundscape-composition-tool.object:soundscape-composition-tool
     * @description Recording tags layer. 
     * adds the soundscape-composition-tool layer_type to layer_types. This layer uses
     * a2.visualizer.layer.soundscape-composition-tool.controller:a2VisualizerSoundscapeCompositionToolController as controller,
     * and requires a visobject of type recording to be selected.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "soundscape-composition-tool",
        title: "",
        controller: 'a2VisualizerSoundscapeCompositionToolController as controller',
        display: {
            spectrogram: false
        },
        require: {
            type: 'recording',
            selection: true
        },
        visible: true,
        hide_visibility: true
    });
})
/**
 * @ngdoc controller
 * @name a2.visualizer.layer.soundscape-composition-tool.controller:a2VisualizerSoundscapeCompositionToolController
 * @description Controller for recording tags layer in visualizer. 
 * Gets injected an instance of VisualizerCtrl representing the visualizer control.
 * Responds to VisualizerCtrl.event::visobject by loading the visobject tags, if it is a
 * recording.
 */
.controller('a2VisualizerSoundscapeCompositionToolController', function(
    $q,
    VisualizerCtrl, 
    a2UserPermit, notify,
    a2SoundscapeCompositionService
){
    this.initialize = function(){
        VisualizerCtrl.on('visobject', (this.setVisobject).bind(this));
        a2SoundscapeCompositionService.getClassList({groupByType:true}).then((function(classesByType){
            this.classTypes = classesByType;
            this.classesByType = classesByType.reduce(function(_, type){
                _[type.type] = type;
                return _;
            }, {});
        }).bind(this));
        
        this.is_selected = {};
        this.annotations = {};
    };
    
    this.select = function(classType, cls, $event) {
        if($($event.target).is('a, button, button *')){
            return;
        }
        
        if($event.shiftKey){
            this.is_selected[cls.id] = true;
            
            var sel_range = this.classesByType[classType.type].list.reduce((function(_, pc, idx){
                if(this.is_selected[pc.id]){
                    _.from = Math.min(_.from, idx);
                    _.to   = Math.max(_.to  , idx);
                }
                return _;
            }).bind(this), {
                from: Infinity, 
                to: -Infinity,
            });
            
            var classTypes = this.classesByType[classType.type].list;
            for(var si = sel_range.from, se = sel_range.to + 1; si < se; ++si){
                this.is_selected[classTypes[si].id] = true;
            }
        } else if($event.ctrlKey){
            this.is_selected[cls.id] = !this.is_selected[cls.id];
        } else {
            this.is_selected = {};
            this.is_selected[cls.id] = true;
        }
    };
    
    this.annotate = function(val) {
        if(!a2UserPermit.can('validate species')) {
            notify.log('You do not have permission to add soundscape composition annotations.');
            return;
        }
        
        var keys = Object.keys(this.is_selected).filter((function(class_id){
            return this.is_selected[class_id];
        }).bind(this));

        if (keys.length > 0) {
            a2SoundscapeCompositionService.annotate(this.visobject, {
                'class': keys.join(','),
                val: val
            }).then((function(annotations) {
                this.is_selected = {};
                annotations.forEach((function(annotation) {
                    if(annotation.present == 2) {
                        delete this.annotations[annotation.scclassId];
                    } else {
                        this.annotations[annotation.scclassId] = annotation.present;
                    }
                }).bind(this));
            }).bind(this));
        }
    };
    
    this.setVisobject = function(visobject){
        this.visobject = visobject;
        return this.loadAnnotations();
    };

    this.loadAnnotations = function(){
        var visobject = this.visobject;
        if(!visobject || !/^recording$/.test(visobject.type)){
            this.annotations = {};
            return $q.resolve(this.annotations);
        }
        
        this.loading = true;
        this.visobject = visobject;
        return a2SoundscapeCompositionService.getAnnotationsFor(visobject).then((function(annotations){
            this.annotations = annotations;
            return annotations;
        }).bind(this)).finally((function(){
            this.loading = false;
        }).bind(this));
    };
    
    
    this.initialize();
    
})
;