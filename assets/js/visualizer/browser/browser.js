angular.module('a2recordingsbrowser', [
    'a2utils', 'a2browser_common',
    'a2browser_recordings_by_site', 'a2browser_recordings_by_site',
    'a2browser_soundscapes'
])
.directive('a2RecordingsBrowser', function () {
    return {
        restrict : 'E',
        scope : {
            onRecording : '&onRecording'
        },
        templateUrl : '/partials/visualizer/browser/main.html',
        controller  : 'a2BrowserController'
    };
})
.controller('a2BrowserController', function($scope, $element, $attrs, $timeout, $controller, $q, browser_lovos, itemSelection, Project){
    var self = $scope.browser = this;
    var project = Project;

    this.types = browser_lovos.$grouping;
    this.type  = browser_lovos.$list.filter(function(lovo){return lovo.default;}).shift();
    this.recordings = [];
    this.loading = {
        sites: false,
        dates: false,
        times: false
    };
    this.auto={};
    this.recording = null;
    this.lovo  = null;
    var initialized = false;
    var activate = function(){
        if(self.$type && self.$type.activate){
            self.$type.activate().then(function(){
                if(!initialized){
                    initialized = true;
                    $scope.$emit('browser-available');
                } else if(self.$type.lovo){
                    self.setLOVO(self.$type.lovo);
                }
            });
        }

    }

    this.setLOVO = function(lovo){
        var old_lovo = self.lovo;
        self.lovo = lovo;
        if(lovo){
            lovo.initialize().then(function(){
                if(self.auto.recording){
                    lovo.find(self.auto.recording).then(function(recording){
                        self.recording = recording;
                    });
                }
            });
        }
    }

    // ng-controller="a2BrowserRecordingsBySiteController"

    $scope.$on('a2-persisted', activate);

    var setBrowserType = function(type){
        var new_$type, old_$type = self.$type;
        self.type = type;
        if(type && type.controller){
            if(!type.$controller){
                type.$controller = $controller(type.controller, {
                    $scope : $scope,
                    a2RecordingsBrowser : self
                });
            }
            new_$type = self.$type = type.$controller;
        }

        var differ = new_$type !== old_$type;
        var d = $q.defer();
        d.resolve();
        return d.promise.then(function(){
            if(differ && old_$type && old_$type.deactivate){
                return old_$type.deactivate();
            }
        }).then(function(){
            if(differ && new_$type && new_$type.activate){
                activate();
            }
        });
    }

    $scope.$watch('browser.type', function(new_type){
        setBrowserType(new_type);
    });

    $scope.$watch('browser.recording', function(newValue, oldValue){
        var location = newValue && self.$type.get_location(newValue);
        $scope.onRecording({location:location, recording:newValue});
        $timeout(function(){
            var $e = $element.find('.recording-list-item.active');
            if($e.length) {
                var $p = $e.parent();
                var $eo = $e.offset(), $po = $p.offset(), $dt=$eo.top-$po.top;
                $p.animate({scrollTop:$p.scrollTop() + $dt});
            }
        });
    });
    $scope.selectRecording = function(recording){
        if(recording) {
            var d = $q.defer();
            d.resolve();
            d.promise.then(function(){
                return self.lovo && self.lovo.find(recording);
            }).then(function(r){
                return r || recording;
            }).then(function(r){
                self.auto = {
                    recording : r
                };
                if(self.$type.auto_select){
                    self.$type.auto_select(recording);
                }
            });
        }
    };
    $scope.$on('prev-recording', function(){
        if(self.recording && self.lovo) {
            self.lovo.previous(self.recording.id).then($scope.selectRecording);
        }
    });
    $scope.$on('next-recording', function(){
        if(self.recording && self.lovo) {
            self.lovo.next(self.recording.id).then($scope.selectRecording);
        }
    });
    $scope.$on('set-browser-location',function(evt, location){
        var m;
        if(m=/([\w+]+)(\/(.+))?/.exec(location)){
            if(browser_lovos[m[1]]){
                var loc = m[3];
                setBrowserType(browser_lovos[m[1]]).then(function(){
                    return self.$type.resolve_location(loc);
                }).then(function(recording){
                    if(recording){
                        $scope.selectRecording(recording);
                    }
                });
            }
        }
    });

    activate();

})

;
