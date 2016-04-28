angular.module('a2.visobjectsbrowser', [
    'a2.utils', 
    'a2.browser_common',
    'a2.browser_recordings_by_site', 
    'a2.browser_recordings_by_playlist',
    'a2.browser_soundscapes',
])
/**
 * @ngdoc directive
 * @name a2visobjectsbrowser.directive:a2VisObjectBrowser
 * @description
 * vis object browser component.
 *
 * @event browser-available Emmited when the browser controller gets initialized
 * @event browser-vobject-type Emmited when the selected visualizer object type changes
 * 
 */
.directive('a2VisObjectBrowser', function ($window, $timeout) {
    return {
        restrict : 'E',
        scope : {
            location    : '=?',
            onVisObject : '&'
        },
        templateUrl : '/partials/visualizer/browser/main.html',
        // require: 'ngModel',
        controller  : 'a2VisObjectBrowserController as browser',
        link : function(scope, element, attrs, browser){
            browser.waitForInitialized.then(function(){
                scope.$emit('browser-available');
            });
            browser.events.on('location-changed', function(){
                scope.location = this.location;
            });
            browser.events.on('browser-vobject-type', function(vobject_type){
                scope.$emit('browser-vobject-type', vobject_type);
            });
            
            browser.events.on('on-vis-object', function(location, visobject, type){
                scope.onVisObject({location: location, visobject: visobject, type: type});
                // console.log("scope.onVisObject");
                $timeout(function(){
                    var $e = element.find('.visobj-list-item.active');
                    if($e.length) {
                        var $p = $e.parent();
                        var $eo = $e.offset(), $po = $p.offset(), $dt=$eo.top-$po.top;
                        $p.animate({scrollTop:$p.scrollTop() + $dt});
                    }
                });
            });
            
            scope.selectVisObject = browser.selectVisObject.bind(browser);
            // scope.$on('a2-persisted', browser.activate.bind(browser));
            scope.$on('prev-visobject', browser.selectPreviousVisObject.bind(browser));
            scope.$on('next-visobject', browser.selectNextVisObject.bind(browser));
            scope.$on('set-browser-location', browser.setBrowserLocation.bind(browser));
            scope.$on('visobj-updated', browser.notifyVisobjUpdated.bind(browser));
            
            browser.activate(scope.location).catch(console.error.bind(console));

        }
    };
})
/**
 * @ngdoc controller
 * @name a2visobjectsbrowser.controller:a2VisObjectBrowserController
 * @description
 * Controller for vis object browser.
 *
 * @event browser-available Emmited when the browser controller gets initialized
 * @event browser-vobject-type Emmited when the selected visualizer object type changes
 * 
 */
.controller('a2VisObjectBrowserController', function($scope, $controller, $q, browser_lovos, itemSelection, Project, EventlistManager){
    // var self = $scope.browser = this;
    var self = this;
    var project = Project;    
    
    // Set of available lovo types
    this.types = browser_lovos.$grouping;
    // currently selected lovo type
    this.type  = browser_lovos.$list.filter(function(lovo){return lovo.default;}).shift();
    // container for loading flags
    this.loading = {
        sites: false,
        dates: false,
        times: false
    };
    // container for auto-selecting values from the browser controllers
    this.auto={};
    // currently selected visualizer object
    this.visobj = null;
    // currently selected lovo
    this.lovo  = null;
    // associated EventlistManager
    this.events= new EventlistManager();
    // initialized flag
    var initialized = false;
    
    var waitForInitializedDefer = $q.defer();
    this.waitForInitialized = waitForInitializedDefer.promise;
    
    /** (Re)-Activates the browser controller.
     * Sets the browser controller into an active state. On the first time,
     * the browse gets initialized and sends a 'browser-available' event 
     * asynchronously. This activation cascades into the currently selected 
     * type.
     *
     * @event browser-available Emmited when the browser controller gets initialized
     *
     */
    this.activate = function(location){
// console.log("this.activate = function(){", "location : ", location);
        var $type = this.$type;
        return (
            ($type && $type.activate) ? 
            $type.activate().then((function(){
                return this.setLOVO($type.lovo);
            }).bind(this)) : 
            $q.resolve()
        ).then((function(){
            if(!initialized){
                initialized = true;
                waitForInitializedDefer.resolve();
            }
        }).bind(this));
    };

    this.setLOVO = function(lovo, location){
// console.log("this.setLOVO = function(lovo, location){", lovo, location);
        var defer = $q.defer();
        var old_lovo = self.lovo;
        self.lovo = lovo;
        return $q.resolve().then(function(){
            if(lovo){
                lovo.initialize().then(function(){
                    if(location){
                        self.set_location(location);
                    }
                }).then(function(){
                    if(self.auto.visobject){
                        return lovo.find(self.auto.visobject).then(function(visobject){
                            return self.setVisObj(visobject);
                        });
                    }
                }).then(function(){
                    return lovo;
                });
            } 
        });
    };
    
    this.set_location = function(location){
// console.log("this.set_location = function(location){", location);
        this.location = location;
        this.events.send({event:'location-changed', context:this}, location);
    };


    this.setBrowserType = function(type){
// console.log("this.setBrowserType :: ", type && type.name);
        var new_$type, old_$type = self.$type;
        if(type && type.controller){
            if(!type.$controller){
                type.$controller = $controller(type.controller, {
                    $scope : $scope,
                    a2Browser : self
                });
            }
            new_$type = type.$controller;
        }

        var differ = new_$type !== old_$type;
        return (differ ? $q.resolve().then(function(){
            if(differ && old_$type && old_$type.deactivate){
                return old_$type.deactivate();
            }
        }).then(function(){
            if(differ && new_$type && new_$type.activate){
                self.type = type;
                self.$type = new_$type;
                return self.activate();
            }
        }) : $q.resolve()).then(function(){
            self.events.send({'event':'browser-vobject-type', context:self}, type.vobject_type);
        });
    };

    this.setVisObj = function(newValue){
// console.log("this.setVisObj :: ", newValue && newValue.id);
        this.visobj = newValue;
        var location = newValue && self.$type.get_location(newValue);
        this.cachedLocation = location;
        this.events.send({event:'on-vis-object', context:this}, location, newValue, self.lovo ? self.lovo.object_type : null);
    };
    
    this.selectVisObject = function(visobject){
        console.log("this.selectVisObject :: ", visobject);
        return (visobject) ?
            $q.resolve().then(function(){
                return self.lovo && self.lovo.find(visobject);
            }).then(function(vobj){
                return vobj || visobject;
            }).then(function(vobj){
                self.auto = {
                    visobject : vobj
                };
                if(self.$type.auto_select){
                    return self.$type.auto_select(visobject);
                } else {
                    return self.setVisObj(visobject);
                }
            }) :
            $q.resolve();
    };

    this.selectPreviousVisObject = function(){
// console.log("this.selectPreviousVisObject = function(){");
        if(self.visobj && self.lovo) {
            self.lovo.previous(self.visobj.id).then(this.selectVisObject.bind(this));
        }
    };
    this.selectNextVisObject = function(){
console.log("this.selectNextVisObject = function(){");
        if(self.visobj && self.lovo) {
            self.lovo.next(self.visobj.id).then(this.selectVisObject.bind(this));
        }
    };
    this.setBrowserLocation = function(evt, location){
console.log("this.setBrowserLocation :: ", location, this.cachedLocation);
        var m = /([\w+]+)(\/(.+))?/.exec(location);
        
        // console.log(" same loc :: ", this.cachedLocation && location && this.cachedLocation[0] == location[0]);
        if(this.cachedLocation == location){
            return $q.resolve();
        }
        this.cachedLocation = location;
        
        
        if(m && browser_lovos[m[1]]){
            var loc = m[3];
            var lovos_def = browser_lovos[m[1]];
            this.setBrowserType(lovos_def).then(function(){
                    return lovos_def.$controller.resolve_location(loc);
            }).then(function(visobject){
                console.log("resolve_location(loc) :: ", loc, visobject);
                if(visobject){
                    return self.selectVisObject(visobject);
                }
            });
        }
    };
    this.notifyVisobjUpdated = function(evt, visobject){
// console.log("this.notifyVisobjUpdated = function(evt, visobject){", evt, visobject);
        if(self.lovo && self.lovo.update){
            self.lovo.update(visobject);
        }
    };

    this.onLovoScroll = function(event){
// console.log("this.onLovoScroll = function(event){", event);
        var $el = $(event.target);
        var $lovoels = $el.children('.visobj-list-item[data-index]');
        var midh = $el.height() * 0.5;
        var hit_pt = $el.scrollTop() + midh;
        var $pointed_el = $lovoels.filter(function(i,el){
            var $el =$(el), t=$el.position().top, h2=$el.height()*0.5; 
            return Math.abs(hit_pt - t - h2) <= h2;
        });
        // console.log("onLovoScroll = ", $pointed_el);
    };

})

;


//
