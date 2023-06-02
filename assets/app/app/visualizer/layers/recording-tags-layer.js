angular.module('a2.visualizer.layers.recording-tags', ['a2.srv.tags'])
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
.controller('a2VisualizerRecordingTagsLayerController', function(VisualizerCtrl, a2Tags, a2LookaheadHelper, a22PointBBoxEditor, $q, $debounce){
    function makeTagsIndex(tags){
        return tags.reduce(function(idx, tag){
            if(tag.id){
                idx[tag.id] = true;
            }
            return idx;
        }, {});
    }

    function groupByBbox(tags){
        var bboxes=[];
        tags.reduce(function(bboxIdx, tag){
            if(tag.f0){
                var bbox = [tag.t0, tag.f0, tag.t1, tag.f1];
                var bbox_key = bbox.join(',');
                if(!bboxIdx[bbox_key]){
                    bboxes.push(bboxIdx[bbox_key] = {
                        bbox: tag, tags:[]
                    });
                }
                bboxIdx[bbox_key].tags.push(tag);
            }
            return bboxIdx;
        },  {});
        return bboxes;
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

    this.tags = [];
    this.spectrogramTags = [];
    this.tagsIndex = {};
    this.bboxTags = [];
    this.bboxTagsIndex = {};

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
            this.spectrogramTags = groupByBbox(tags);
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
    this.searchTags = function(text) {
        if (text === '' || !text) {
            this.getProjectTags();
        }
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
        var tagUpdate = this.determineTagUpdate(this.tags, this.tagsIndex);
        return this.updateTags(tagUpdate);
    }, 100);

    this.onBBoxTagListChanged = $debounce(function(){
        var tagUpdate = this.determineTagUpdate(this.bboxTags);
        this.bboxTags = [];
        var bbox = this.bbox.bbox;
        tagUpdate.add.forEach(function(tag){
            tag.t0 = bbox.x1;
            tag.f0 = bbox.y1;
            tag.t1 = bbox.x2;
            tag.f1 = bbox.y2;
        });
        return this.updateTags(tagUpdate).then;
    });

    this.getProjectTags = function() {
        return a2Tags.getForType('recording').then((function(tags){
            this.searchedTags = tags;
        }).bind(this));
    };

    this.getProjectTags();

    this.determineTagUpdate = function(tags, oldTagsIndex){
        var tagsIndex = makeTagsIndex(tags);

        var toDelete = Object.keys(oldTagsIndex || {}).filter(function(tagId){
            return !tagsIndex[tagId];
        });

        var toAdd = tags.filter(function(tag){
            return !tag.id;
        });
        return {
            add : toAdd,
            delete: toDelete
        };
    };

    this.updateTags = function(tagUpdate){
        var visobject = this.visobject;
        console.log("visobject : ", visobject);
        console.log("tag update : ", tagUpdate);

        return $q.all([
            $q.all(tagUpdate.delete.map(function(tagId){
                return a2Tags.deleteFor(visobject, tagId);
            })),
            $q.all(tagUpdate.add.map(function(tag){
                return a2Tags.addFor(visobject, tag);
            }))
        ]).then((function(updateResponse){
            return this.loadTags();
        }).bind(this)).catch((function(){
            // TODO:: notify user of failure... maybe should be done through a notification service...
            return this.loadTags();
        }).bind(this));
    };

    this.bbox = angular.extend(
        new a22PointBBoxEditor(), {
        add_tracer_point : function(point){
            this.super.add_tracer_point.call(this, point.sec, point.hz);
        },
        add_point : function(point, min_eps){
            this.super.add_point.call(this, point.sec, point.hz, min_eps);
        },
        resetBboxTags: (function(){
            console.log("resetBboxTags", this.bboxTags);
            this.bboxTags=[];
        }).bind(this),
        reset: function(){
            this.resetBboxTags();
            this.super.reset.call(this);
        }
    });

    VisualizerCtrl.on('visobject', (this.setVisobject).bind(this));
})
.directive('a2Tag', function(){
    return {
        restrict: 'E',
        scope:{
            tag:'='
        },
        template:'<span class="fa fa-tag no-text-wrap">' +
            '{{tag.tag}}' +
        '</span>'
    };
})
;
