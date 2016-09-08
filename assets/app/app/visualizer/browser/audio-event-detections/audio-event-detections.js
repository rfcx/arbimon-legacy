angular.module('a2.browser_audio-event-detections', [
    'a2.browser_common',
    'a2.filter.as-csv',
])
.config(function(BrowserVisObjectsProvider, BrowserLOVOsProvider){
    BrowserVisObjectsProvider.add({
        type: 'audio-event-detection',
        cardTemplate: '/app/visualizer/browser/audio-event-detections/card.html',
    });
    BrowserLOVOsProvider.add({
        name       : 'audio-event-detection',
        group       : 'audio-event-detections',
        vobject_type: 'audio-event-detection',
        icon       : 'fa fa-object-group',
        tooltip    : "Show Audio Event Detections",
        controller : 'a2BrowserAudioEventDetectionsController',
        template   : '/app/visualizer/browser/audio-event-detections/audio-event-detections.html'
    });
})
.controller('a2BrowserAudioEventDetectionsController', function(a2Browser, AudioEventDetectionService, a2ArrayLOVO, $timeout, $q){
    var self = this;
    this.audioEventDetections = [];
    this.active=false;
    this.loading = {
        audioEventDetections : false
    };
    this.audioEventDetection = null;
    this.lovo = null;
    this.auto = {};
    this.activate = function(){
        var defer = $q.defer();

        AudioEventDetectionService.getList({show:'thumbnail-path'}).then(function(audioEventDetections){
            console.log("audioEventDetections", audioEventDetections);
            self.loading.audioEventDetections = false;
            self.audioEventDetections = audioEventDetections;

            if(!self.audioEventDetections_lovo){
                self.audioEventDetections_lovo = new a2ArrayLOVO();
            }
            self.audioEventDetections_lovo.setArray(self.audioEventDetections, 'audio-event-detection');
            self.audioEventDetections_lovo.update = function(){
                self.activate();
            };
            if(!self.lovo){
                self.lovo = self.audioEventDetections_lovo;
                a2Browser.setLOVO(self.lovo);
            }
            defer.resolve(false);
            if(self.resolve.scd){
                self.resolve.scd.resolve(self.audioEventDetections);
            }
        });

        self.loading.audioEventDetections = true;

        return defer.promise;
    };
    this.resolve={};

    this.resolve_location = function(location){
        var m = /(\d+)(\/(\d+))?/.exec(location);
        var defer = $q.defer();
        if(m){
            var scid = m[1]|0, regionid=m[3]|0;
            var scd = $q.defer();
            if(self.loading.audioEventDetections){
                self.resolve = { scd : scd};
            } else {
                scd.resolve(self.audioEventDetections);
            }
            scd.promise.then(function(audioEventDetections){
                var audioEventDetection = self.audioEventDetections.filter(function(audioEventDetection){
                    return audioEventDetection.id == scid;
                }).shift();
                if(audioEventDetection){
                    self.audioEventDetection = audioEventDetection;
                    if(regionid){
                        if(!self.audioEventDetection.extra){
                            self.audioEventDetection.extra={};
                        }
                        self.audioEventDetection.extra.region = regionid;
                    }
                }
                defer.resolve(audioEventDetection);
            });
        } else {
            defer.resolve();
        }
        return defer.promise;
    };
    this.get_location = function(audioEventDetection){
        return 'audio-event-detection/' + audioEventDetection.id + (
            audioEventDetection.extra && audioEventDetection.extra.region ? '/' + audioEventDetection.extra.region : ''
        );
    };
});
