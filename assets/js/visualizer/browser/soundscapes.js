angular.module('a2browser_soundscapes', [])
.controller('a2BrowserSoundscapesController', function($scope, a2RecordingsBrowser, a2Soundscapes, a2ArrayLOVO, $timeout, $q){
    var self = this;
    this.soundscapes = [];
    this.active=false;
    this.loading = {
        soundscapes : false
    };
    this.soundscape = null;
    this.lovo = null;
    this.auto = {};
    this.activate = function(){
        var defer = $q.defer();

        a2Soundscapes.getList({show:'thumbnail-path'},function(soundscapes){
            self.loading.soundscapes = false;
            self.soundscapes = soundscapes;
            if(!self.soundscapes_lovo){
                self.soundscapes_lovo = new a2ArrayLOVO();
            }
            self.soundscapes_lovo.setArray(self.soundscapes, 'soundscape');
            if(!self.lovo){
                self.lovo = self.soundscapes_lovo;
                a2RecordingsBrowser.setLOVO(self.lovo);
            }
            defer.resolve(false);
        });

        self.loading.soundscapes = true;

        return defer.promise;
    };
    this.resolve={};

    this.resolve_location = function(location){
        var m = /(\d+)(\/(\d+))?/.exec(location);
        var defer = $q.defer();
        if(m){
            var plid = m[1]|0, recid=m[3]|0;
            var pld = $q.defer();
            if(self.loading.soundscapes){
                self.resolve = { pld : pld };
            } else {
                pld.resolve(self.soundscapes);
            }
            pld.promise.then(function(soundscapes){
                var soundscape = self.soundscapes.filter(function(soundscape){
                    return soundscape.id == plid;
                }).shift();
                if(soundscape){
                    self.soundscape = soundscape;
                } else {
                    defer.resolve();
                }
            });
        } else {
            defer.resolve();
        }
        return defer.promise;
    };
    this.get_location = function(recording){
        return 'soundscape/' + this.lovo.soundscape.id + "/" + recording.id;
    };

    $scope.$watch('browser.$type.soundscape', function(soundscape){
        // if(soundscape && (self.lovo ? self.lovo.soundscape != soundscape : true)){
        //     self.lovo = new a2PlaylistLOVO(soundscape);
        // }
        // a2RecordingsBrowser.setLOVO(self.lovo);
    });
})
