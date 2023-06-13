angular.module('a2.browser_soundscapes', [
    'a2.browser_common',
])
.config(function(BrowserVisObjectsProvider, BrowserLOVOsProvider){
    BrowserVisObjectsProvider.add({
        type: 'soundscape',
        cardTemplate: '/app/visualizer/browser/soundscapes/card.html',
    });
    BrowserLOVOsProvider.add({
        name       : 'soundscape',
        group       : 'soundscapes',
        vobject_type: 'soundscape',
        icon       : 'fa fa-area-chart',
        tooltip    : "Show Soundscapes",
        controller : 'a2BrowserSoundscapesController',
        template   : '/app/visualizer/browser/soundscapes/soundscapes.html'
    });
})
.controller('a2BrowserSoundscapesController', function(a2Browser, a2Soundscapes, a2ArrayLOVO, a2UrlUpdate, Project, $q){
    var self = this;
    this.soundscapes = [];
    this.active=false;
    this.loading = {
        soundscapes : false
    };
    this.soundscape = null;
    this.lovo = null;
    this.auto = {};
    Project.getInfo(function(info){
        return this.isDisabled = info.disabled === 1
    })
    this.activate = function(){
        var defer = $q.defer();

        a2Soundscapes.getList({show:'thumbnail-path'},function(soundscapes){
            self.loading.soundscapes = false;
            self.soundscapes = soundscapes;
            self.soundscapes.forEach(function(soundscape){
                soundscape.isDisabled = this.isDisabled
                a2UrlUpdate.update(soundscape.thumbnail);
                soundscape.caption2 = soundscape.normalized ? 'normalized' : ('scale:' + (soundscape.visual_max_value !== null ? soundscape.visual_max_value : soundscape.max_value));
            });

            if(!self.soundscapes_lovo){
                self.soundscapes_lovo = new a2ArrayLOVO();
            }
            self.soundscapes_lovo.setArray(self.soundscapes, 'soundscape');
            self.soundscapes_lovo.update = function(){
                self.activate();
            };
            if(!self.lovo){
                self.lovo = self.soundscapes_lovo;
                a2Browser.setLOVO(self.lovo);
            }
            defer.resolve(false);
            if(self.resolve.scd){
                self.resolve.scd.resolve(self.soundscapes);
            }
        });

        self.loading.soundscapes = true;

        return defer.promise;
    };
    this.resolve={};

    this.resolve_location = function(location){
        var m = /(\d+)(\/(\d+))?/.exec(location);
        var defer = $q.defer();
        if(m){
            var scid = m[1]|0, regionid=m[3]|0;
            var scd = $q.defer();
            if(self.loading.soundscapes){
                self.resolve = { scd : scd};
            } else {
                scd.resolve(self.soundscapes);
            }
            scd.promise.then(function(soundscapes){
                var soundscape = self.soundscapes.filter(function(soundscape){
                    return soundscape.id == scid;
                }).shift();
                if(soundscape){
                    self.soundscape = soundscape;
                    if(regionid){
                        if(!self.soundscape.extra){
                            self.soundscape.extra={};
                        }
                        self.soundscape.extra.region = regionid;
                    }
                }
                defer.resolve(soundscape);
            });
        } else {
            defer.resolve();
        }
        return defer.promise;
    };
    this.get_location = function(soundscape){
        return 'soundscape/' + soundscape.id + (
            soundscape.extra && soundscape.extra.region ? '/' + soundscape.extra.region : ''
        );
    };
});
