angular.module('a2.visobjects.audio-event-detection', [
    'a2.services',
    'a2.visobjects.common',
])
.config(function(VisualizerObjectTypesProvider){
    VisualizerObjectTypesProvider.add({
        type: 'audio-event-detection',
        $loader: ['VisualizerObjectAudioEventDetectionTypeLoader', function(VisualizerObjectAudioEventDetectionTypeLoader){
            return VisualizerObjectAudioEventDetectionTypeLoader;
        }]
    });
})
.service('VisualizerObjectAudioEventDetectionTypeLoader', function ($q, Project) {
    var AudioEventDetection = function(data){
        this.update(data);
    };
    AudioEventDetection.fetch = function(visobject){
        var d = $q.defer();
        visobject = new AudioEventDetection(visobject);
        d.resolve(visobject);
        return d.promise;
    };
    AudioEventDetection.load = function(visobject, $scope){
        return AudioEventDetection.fetch(visobject);
    };
    AudioEventDetection.getCaptionFor = function(visobject){
        return visobject.name;
    };
    AudioEventDetection.prototype = {
        type : "audio-event-detection",
        layout: 'plotted',
        zoomable : false,
        update : function(data){
            for(var i in data){ this[i] = data[i]; }
            
        },
        getCaption : function(){
            return AudioEventDetection.getCaptionFor(this);
        }
    };
    return AudioEventDetection;
})
;
