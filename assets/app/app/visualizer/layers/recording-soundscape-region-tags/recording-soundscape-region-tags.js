angular.module('a2.visualizer.layers.recording-soundscape-region-tags', [
])
.config(function(layer_typesProvider){
    /**
     * @ngdoc object
     * @name a2.visualizer.layers.recordings.object:recordings-layer
     * @description Recordings layer. 
     * adds the recordings-layer layer_type to layer_types. This layer uses
     * a2.visualizer.layers.recordings.controller:a2VisualizerRecordingLayerController as controller,
     * and requires a visobject of type recording to be selected.
     * The layer has no visibility button.
     */
    layer_typesProvider.addLayerType({
        type: "recording-soundscape-region-tags",
        title: "",
        controller: 'a2VisualizerRecordingSoundscapeRegionTagsLayerController as ctrl',
        require: {
            type: 'recording',
            selection: true,
            that: function(scope) {
                var pl = scope.visobject && scope.visobject.extra && scope.visobject.extra.playlist;
                return pl && pl.soundscape && pl.region;
            }
        },
        sidebar_only: true,
        visible: true,
        hide_visibility: false
    });
})
.controller('a2VisualizerRecordingSoundscapeRegionTagsLayerController', function($scope, a2Soundscapes){
    var self = this;
    self.loading = {};
    
    self.tag = {
        name: null,
        add: function() {
            var tag = this.name;
            
            this.name = null;
            
            a2Soundscapes.addRecordingTag(self.soundscape.id, self.region.id, self.recording.id, tag, function(tag){
                var tagid = tag.id | 0;
                if(!self.tags.filter(function(t){
                    return t.id == tagid;
                }).length){
                    self.tags.push(tag);
                }
            });
        },
        remove: function(tag) {
            var tagid = tag.id | 0;
            a2Soundscapes.removeRecordingTag(self.soundscape.id, self.region.id, self.recording.id, tagid, function(){
                self.tags = self.tags.filter(function(t){
                    return t.id != tagid;
                });
            });
        }
    };
    
    $scope.$watch('visobject', function(visobject){
        self.recording  = null;
        self.playlist   = null;
        self.soundscape = null;
        self.region     = null;
        self.tags       = null;

        if(visobject && (visobject.type == 'recording') && visobject.id &&
            visobject.extra && visobject.extra.playlist &&
            visobject.extra.playlist.soundscape &&
            visobject.extra.playlist.region
        ){
            self.recording = visobject;
            self.playlist  = visobject.extra.playlist;
            self.loading.soundscape = true;
            self.loading.region = true;
            self.loading.tags = true;
            a2Soundscapes.get(self.playlist.soundscape, function(soundscape){
                self.loading.soundscape = false;
                self.soundscape = soundscape;
                a2Soundscapes.getRegion(soundscape.id, self.playlist.region, function(region){
                    self.loading.region = false;
                    self.region = region;
                    a2Soundscapes.getRecordingTags(soundscape.id, region.id, self.recording.id, function(tags){
                        self.loading.tags = false;
                        self.tags = tags;
                    });
                });
            });
        }
    });
});