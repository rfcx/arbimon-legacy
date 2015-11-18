angular.module('a2.visualizer.layer.recording-tags', ['a2.srv.tags'])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layer.recording-tags.object:recording-tags-layer
     * @description Recording tags layer. 
     * adds the recording-tags-layer layer_type to layer_types. This layer uses
     * a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController as controller,
     * and requires a visobject of type recording to be selected.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "recording-tags-layer",
        title: "",
        controller: 'a2VisualizerRecordingTagsLayerController as controller',
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
 * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController
 * @description Controller for recording tags layer in visualizer. 
 * Gets injected an instance of VisualizerCtrl representing the visualizer control.
 * Responds to VisualizerCtrl.event::visobject by loading the visobject tags, if it is a
 * recording.
 */
.controller('a2VisualizerRecordingTagsLayerController', function(VisualizerCtrl, a2Tags, a2LookaheadHelper, $q, $debounce){
    function makeTagsIndex(tags){
        return tags.reduce(function(idx, tag){
            if(tag.id){
                idx[tag.id] = true;
            }
            return idx;
        }, {});
    }
    var lookaheadHelper = new a2LookaheadHelper({
        fn:a2Tags.search,
        minLength:3,
        includeSearch:true,
        searchPromote: function(text){
            return {tag:text};
        },
        searchCompare: function(text, tag){
            return tag.tag==text;
        }
    });
    
    /**
     * @ngdoc method
     * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#setVisobject
     * @description Sets the visobject that will be the focus of this controller.
     * Causes tags associated to it to be loaded.
     * @param {visobject} visobject - visobject to set on the controller.
     * @return Promise resolved with tags of given visobject. If the visobject is 
     * not a recording, then the promise resolves to an empty array.
     */
    this.setVisobject = function(visobject){
        this.visobject = visobject;
        return this.loadTags();
    };
    
    /**
     * @ngdoc method
     * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#loadTags
     * @description Loads the tags for a given visobject and returns them in a promise.
     * @param {visobject} visobject - visobject for wich to load the tags. Must be a recording visobject.
     * @return Promise resolved with tags of given visobject. If the visobject is 
     * not a recording, then the promise resolves to an empty array.
     */
    this.loadTags = function(){
        var visobject = this.visobject;
        if(!visobject || !/^recording$/.test(visobject.type)){
            this.tags = [];
            return $q.resolve(this.tags);
        }
        
        this.loading = true;
        this.visobject = visobject;
        return a2Tags.getFor(visobject).then((function(tags){
            this.tagsIndex = makeTagsIndex(tags);
            this.tags = tags;
            return tags;
        }).bind(this)).finally((function(){
            this.loading = false;
        }).bind(this));
    };
    
     
    /**
     * @ngdoc object
     * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#searchedTags
     * @description Array of tags returned by the last tag search.
     */
    this.searchedTags=[];
    /**
     * @ngdoc method
     * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#searchTags
     * @description Searched for tags using the given text.
     * @param {String} text - text to match in the tags search.
     * @return Promise resolved with the searched tags. Also, searched tags are set in searchedTags.
     */
    this.searchTags = function(text){
        return lookaheadHelper.search(text).then((function(tags){
            this.searchedTags = tags;
        }).bind(this));
    };
    
    /**
     * @ngdoc method
     * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#onTagListChanged
     * @description Called whenever the list of tags needs to be checked for changes.
     * @return Promise resolved whenever the list of tags has been checked entirely.
     */
    this.onTagListChanged = $debounce(function(){
        var visobject = this.visobject;
        var tagsIndex = makeTagsIndex(this.tags);
        return $q.all([
            $q.all(Object.keys(this.tagsIndex).filter(function(tagId){
                return tagsIndex[tagId];
            }).map(function(tagId){
                return a2Tags.deleteFor(visobject, tagId);
            })),
            $q.all(this.tags.filter(function(tag){
                return !tag.id;
            }).map(function(tag){
                return a2Tags.addFor(visobject, tag);
            }))
        ]).then(function(updateResponse){
            
        });
    }, 100);
    
    VisualizerCtrl.on('visobject', (this.setVisobject).bind(this));
})
.directive('a2Tag', function(){
    return {
        restrict: 'E',
        scope:{
            tag:'='
        }, 
        template:'<span class="fa fa-tag">' +
            '{{tag.tag}}' +
        '</span>'
    };
})
;