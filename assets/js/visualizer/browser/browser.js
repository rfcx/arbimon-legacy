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
            onVisObject : '&onVisObject'
        },
        templateUrl : '/partials/visualizer/browser/main.html',
        controller  : 'a2VisObjectBrowserController as browser',
        link : function(scope, element, attrs){
            var browser = scope.browser;
            browser.events.on('browser-available', function(){
                console.log("browser.events.on('browser-available', function(){");
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
            scope.$watch('browser.type', browser.setBrowserType.bind(browser));
            scope.$watch('browser.visobj', browser.setVisObj.bind(browser));
            scope.$on('prev-visobject', browser.selectPreviousVisObject.bind(browser));
            scope.$on('next-visobject', browser.selectNextVisObject.bind(browser));
            scope.$on('set-browser-location', browser.setBrowserLocation.bind(browser));
            scope.$on('visobj-updated', browser.notifyVisobjUpdated.bind(browser));
            
            browser.activate();

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
    
    /** (Re)-Activates the browser controller.
     * Sets the browser controller into an active state. On the first time,
     * the browse gets initialized and sends a 'browser-available' event 
     * asynchronously. This activation cascades into the currently selected 
     * type.
     *
     * @event browser-available Emmited when the browser controller gets initialized
     *
     */
    this.activate = function(){
        var $type = self.$type;
        if($type && $type.activate){
            return $type.activate().then(function(){
                self.setLOVO($type.lovo).then(function(){
                    if(!initialized){
                        initialized = true;
                        self.events.send({event:'browser-available', context:this, oneTime:true});
                    }
                    // self.setLOVO($type.lovo)
                });
            });
        }
    };

    this.setLOVO = function(lovo, location){
        var defer = $q.defer();
        var old_lovo = self.lovo;
        self.lovo = lovo;
        if(lovo){
            lovo.initialize().then(function(){
                if(location){
                    self.set_location(location);
                }
                if(self.auto.visobject){
                    lovo.find(self.auto.visobject).then(function(visobject){
                        self.visobj = visobject;
                        defer.resolve(lovo);
                    });
                } else {
                    defer.resolve(lovo);
                }
            });
        } else {
            defer.resolve();
        }
        return defer.promise;
    };
    
    this.set_location = function(location){
        this.location = location;
        this.events.send({event:'location-changed', context:this}, location);
    };


    this.setBrowserType = function(type){
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
        var d = $q.defer();
        d.resolve();
        return d.promise.then(function(){
            if(differ && old_$type && old_$type.deactivate){
                return old_$type.deactivate();
            }
        }).then(function(){
            if(differ && new_$type && new_$type.activate){
                self.type = type;
                self.$type = new_$type;
                return self.activate();
            }
        }).then(function(){
            self.events.send({'event':'browser-vobject-type', context:this}, type.vobject_type);
        });
    };

    this.setVisObj = function(newValue){
        var location = newValue && self.$type.get_location(newValue);
        this.events.send({event:'on-vis-object', context:this}, location, newValue, self.lovo ? self.lovo.object_type : null);
    };
    
    this.selectVisObject = function(visobject){
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

    this.selectPreviousVisObject = function(){
        if(self.visobj && self.lovo) {
            self.lovo.previous(self.visobj.id).then(this.selectVisObject.bind(this));
        }
    };
    this.selectNextVisObject = function(){
        if(self.visobj && self.lovo) {
            self.lovo.next(self.visobj.id).then(this.selectVisObject.bind(this));
        }
    };
    this.setBrowserLocation = function(evt, location){
        console.log("this.setBrowserLocation = function(evt, location){", evt, location, "){");
        var m=/([\w+]+)(\/(.+))?/.exec(location);
        if(m && browser_lovos[m[1]]){
            var loc = m[3];
            var lovos_def = browser_lovos[m[1]];
            this.setBrowserType(lovos_def).then(function(){
                return lovos_def.$controller.resolve_location(loc);
            }).then(function(visobject){
                if(visobject){
                    self.selectVisObject(visobject);
                }
            });
        }
    };
    this.notifyVisobjUpdated = function(evt, visobject){
        if(self.lovo && self.lovo.update){
            self.lovo.update(visobject);
        }
    };

    this.onLovoScroll = function(event){
        var $el = $(event.target);
        var $lovoels = $el.children('.visobj-list-item[data-index]');
        var midh = $el.height() * 0.5;
        var hit_pt = $el.scrollTop() + midh;
        var $pointed_el = $lovoels.filter(function(i,el){
            var $el =$(el), t=$el.position().top, h2=$el.height()*0.5; 
            return Math.abs(hit_pt - t - h2) <= h2;
        });
        console.log("onLovoScroll = ", $pointed_el);
    };

})

;


//