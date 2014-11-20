angular.module('a2visobjectsbrowser', [
    'a2utils', 'a2browser_common',
    'a2browser_recordings_by_site', 'a2browser_recordings_by_playlist',
    'a2browser_soundscapes'
])
.directive('a2VisObjectBrowser', function () {
    return {
        restrict : 'E',
        scope : {
            onVisObject : '&onVisObject'
        },
        templateUrl : '/partials/visualizer/browser/main.html',
        controller  : 'a2VisObjectBrowserController'
    };
})
.controller('a2VisObjectBrowserController', function($scope, $element, $attrs, $timeout, $controller, $q, browser_lovos, itemSelection, Project){
    var self = $scope.browser = this;
    var project = Project;

    this.types = browser_lovos.$grouping;
    this.type  = browser_lovos.$list.filter(function(lovo){return lovo.default;}).shift();
    this.loading = {
        sites: false,
        dates: false,
        times: false
    };
    this.auto={};
    this.visobj = null;
    this.lovo  = null;
    var initialized = false;
    var activate = function(){
        if(self.$type && self.$type.activate){
            self.$type.activate().then(function(){
                if(!initialized){
                    initialized = true;
                    $scope.$emit('browser-available');
                }
                self.setLOVO(self.$type.lovo);
            });
        }

    }

    this.setLOVO = function(lovo){
        var old_lovo = self.lovo;
        self.lovo = lovo;
        if(lovo){
            lovo.initialize().then(function(){
                if(self.auto.visobject){
                    lovo.find(self.auto.visobject).then(function(visobject){
                        self.visobj = visobject;
                    });
                }
            });
        }
    }

    $scope.$on('a2-persisted', activate);

    var setBrowserType = function(type){
        var new_$type, old_$type = self.$type;
        self.type = type;
        if(type && type.controller){
            if(!type.$controller){
                type.$controller = $controller(type.controller, {
                    $scope : $scope,
                    a2Browser : self
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
            
        }).then(function(){
            $scope.$emit('browser-vobject-type', type.vobject_type);
        });
    }

    $scope.$watch('browser.type', function(new_type){
        setBrowserType(new_type);
    });

    $scope.$watch('browser.visobj', function(newValue, oldValue){
        var location = newValue && self.$type.get_location(newValue);
        $scope.onVisObject({location:location, visobject:newValue, type:self.lovo ? self.lovo.object_type : null});
        $timeout(function(){
            var $e = $element.find('.visobj-list-item.active');
            if($e.length) {
                var $p = $e.parent();
                var $eo = $e.offset(), $po = $p.offset(), $dt=$eo.top-$po.top;
                $p.animate({scrollTop:$p.scrollTop() + $dt});
            }
        });
    });
    $scope.selectVisObject = function(visobject){
        if(visobject) {
            var d = $q.defer();
            d.resolve();
            d.promise.then(function(){
                return self.lovo && self.lovo.find(visobject);
            }).then(function(vobj){
                return vobj || visobject;
            }).then(function(vobj){
                self.auto = {
                    visobject : vobj
                };
                if(self.$type.auto_select){
                    self.$type.auto_select(visobject);
                } else {
                    self.visobj = visobject;
                }
            });
        }
    };
    $scope.$on('prev-visobject', function(){
        if(self.visobject && self.lovo) {
            self.lovo.previous(self.visobject.id).then($scope.selectVisObject);
        }
    });
    $scope.$on('next-visobject', function(){
        if(self.visobject && self.lovo) {
            self.lovo.next(self.visobject.id).then($scope.selectVisObject);
        }
    });
    $scope.$on('set-browser-location',function(evt, location){
        var m;
        if(m=/([\w+]+)(\/(.+))?/.exec(location)){
            if(browser_lovos[m[1]]){
                var loc = m[3];
                setBrowserType(browser_lovos[m[1]]).then(function(){
                    return self.$type.resolve_location(loc);
                }).then(function(visobject){
                    if(visobject){
                        $scope.selectVisObject(visobject);
                    }
                });
            }
        }
    });

    activate();

})

;
