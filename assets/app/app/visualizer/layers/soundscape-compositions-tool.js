angular.module('a2.visualizer.layers.soundscape-composition-tool', [
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
        a2SoundscapeCompositionService.getClassList({groupByType:true, isSystemClass:1}).then((function(classesByType){
            this.classTypes = classesByType;
            this.classesByType = classesByType.reduce(function(_, type){
                _[type.type] = type;
                return _;
            }, {});
        }).bind(this));

        this.annotations = {};

        this.annotationToolbar = [
            [
                {value:1, caption:"Annotate as Present"},
                {value:0, caption:"Annotate as Absent"},
            ],
            [
                {value:2, caption:"Clear Annotation"},
            ]
        ];


    };

    this.annotate = function(val, classId) {
        if(!a2UserPermit.can('validate species')) {
            notify.error('You do not have permission to add soundscape composition annotations.');
            return;
        }

        var keys = [classId];

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
