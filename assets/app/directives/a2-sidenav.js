/**
 * @ngdoc overview
 * @name a2-sidenav
 * @description
 * Directive for specifying a sidenav bar.
 * this bar specifies a list of links that can be added
 * whenever a corresponding sidenavbar anchor resides
 */
angular.module('a2.directive.sidenav-bar', [
    'a2.utils'
])
.directive('a2SidenavBar', function(a2SidenavBarService, $parse){
    return {
        restrict: 'E',
        compile: function(element, attr){
            element.addClass("sidenav");
            var name = attr.name;
            var template = element.clone();

            return function(scope, element, attr){
                a2SidenavBarService.enableSidenavBar(name, template, scope);
                if(attr.enabled){
                    scope.$watch(attr.enabled, function(enabled){
                        if(enabled){
                            a2SidenavBarService.enableSidenavBar(name, template, scope);
                        } else {
                            a2SidenavBarService.disableSidenavBar(name);
                        }
                    });
                }
                scope.$on('$destroy', function(){
                    a2SidenavBarService.disableSidenavBar(name);
                });
            };
        },
    };
})
.service('a2SidenavBarService', function($q, $log, a2EventEmitter){
    var cache={};

    function SidenavBar(){
        this.enabled = false;
        this.events= new a2EventEmitter();
    }
    SidenavBar.prototype = {
        enable: function(template, scope){
            if(!this.enabled){
                this.enabled = true;
                this.template = template;
                this.scope = scope;
                return this.events.emit('enabled', this);
            }
            return $q.resolve();
        },
        disable: function(){
            if(this.enabled){
                this.enabled = false;
                delete this.template;
                delete this.scope;
                return this.events.emit('disabled', this);
            }
            return $q.resolve();
        },
        on:function(event, listener){
            this.events.on(event, listener);
        },
        off:function(event, listener){
            this.events.off(event, listener);
        },
    };

    function getSidenavBar(name){
        return cache[name] || (cache[name] = new SidenavBar());
    }

    a2SidenavBarService = {
        enableSidenavBar:function(name, template, scope){
            return getSidenavBar(name).enable(template, scope);
        },
        disableSidenavBar:function(name){
            return getSidenavBar(name).disable();
        },
        registerAnchor: function(name, onEnabled, onDisabled){
            var bar = getSidenavBar(name);
            bar.on('enabled', onEnabled);
            bar.on('disabled', onDisabled);
            if(bar.enabled){
                $q.resolve().then(onEnabled);
            }
            return function unregisterAnchor(){
                bar.off('enabled', onEnabled);
                bar.off('disabled', onDisabled);
            };
        },
    };

    return a2SidenavBarService;

})
.directive('a2SidenavBarAnchor', function(a2SidenavBarService, $compile){
    return {
        restrict: 'A',
        link: function(scope, element, attr){
            var name;
            var isUl = element[0].nodeName.toLowerCase() == 'ul';
            var unregisterAnchor;
            function onEnabled(sidebar){
                var template=sidebar.template.clone();
                element.empty().append($compile(template.children())(sidebar.scope));
            }
            function onDisabled(sidebar){
                element.empty();
            }

            attr.$observe('a2SidenavBarAnchor', function(_name){
                name = _name;
                if(unregisterAnchor){
                    unregisterAnchor();
                    unregisterAnchor = null;
                }
                unregisterAnchor = a2SidenavBarService.registerAnchor(name, onEnabled, onDisabled);
            });

            scope.$on('$destroy', function(){
                if(unregisterAnchor){
                    unregisterAnchor();
                    unregisterAnchor = null;
                }
            });
        }
    };
})
;
