angular.module('a2.utils', [
    'a2.utils-browser-metrics'
])
.factory('$templateFetch', function($http, $templateCache){
    return function $templateFetch(templateUrl, linker){
        var template = $templateCache.get(templateUrl);
        if(template) {
            if (template.promise) {
                template.linkers.push(linker);
            } else {
                linker(template);
            }
        } else {
            var tmp_promise = {
                linkers : [linker],
                promise : $http.get(templateUrl).success(function(template){
                    $templateCache.put(templateUrl, template);
                    for(var i=0, l=tmp_promise.linkers, e=l.length; i < e; ++i){
                        l[i](template);
                    }
                })
            };
            $templateCache.put(templateUrl, tmp_promise);
        }
    };
})
.factory('a2EventEmitter', function($q){
    function a2EventEmitter(){
        this.list={};
    }
    a2EventEmitter.prototype = {
        on:function(event, callback){
            var list = this.list[event] || (this.list[event] = []);
            list.push(callback);
            return callback;
        },
        off: function(event, callback){
            var list = this.list[event];
            if(list){
                var idx = list.indexOf(callback);
                if(idx){
                    list.splice(idx, 1);
                }
            }
        },
        emit: function(event){
            var args = Array.prototype.slice.call(arguments, 1);
            var list = this.list[event];
            if(list){
                for(var i=0,e=list.length; i <e; ++i){
                    list[i].apply(null, args);
                }
            }
            return $q.resolve();
        }
    };
    return a2EventEmitter;
})
.factory('itemSelection', function(){
    return {
        make : function make_itemSelection_obj(item_name){
            var sel = {};
            if(typeof item_name == 'undefined') {
                item_name = 'value';
            }
            sel[item_name] = null;
            sel.select = function(newValue){
                sel[item_name] = newValue;
            };
            return sel;
        }
    };
})
// display localtime formated by momentjs
.filter('moment',function() {
    return function(input, fmt) {
        if(!input)
            return undefined;

        return moment(input).format(fmt);
    };
})
// display UTC formated by momentjs
.filter('momentUtc', function(){
    return function(x, fmt){
        if(!x)
            return undefined;

        return moment(x).utc().format(fmt);
    };
})

// display site localtime formated by momentjs
.filter('momentTz', function(){
    return function(x, fmt, timezone){
        if(!x) {
            return undefined;
        }
        return moment.tz(x, timezone).format(fmt);
    };
})

// divides array of into pages of limitPerPage size
.filter('paginate', function() {
    return function(arr, currentPage, limitPerPage) {
        if(!arr)
            return undefined;

        return arr.slice((currentPage-1)*limitPerPage, currentPage*limitPerPage);
    };
})
/** Pluralizes singular words accoring to some heuristics that (hopefully)
 *  look like english grammar.
 */
.filter('plural', function(){
    return function(x, fmt){
        if(!x)
            return undefined;

        return x +'s';
    };
})
// replace underscores or dashes for spaces
.filter('worded', function(){
    return function(x, fmt){
        if(!x)
            return undefined;

        return (''+x).replace(/[_-]/g, ' ');
    };
})
// capitalize words
.filter('wordCaps', function(){
    return function(x, fmt){
        if(!x)
            return undefined;

        return (''+x).replace(/\b(\w)/g, function(_1){
            return _1.toUpperCase();
        });
    };
})
/**
 * @ngdoc factory
 * @name a2.utils.factory:$debounce
 * @description asynchronous debouncing function decorator
 * Decorates an asynchronous function with a debouncing function. A debouncing
 * function withholds the function call by a set ammount of time and wait for
 * any othe function calls, resetting the wait for time every call. After its wait
 * time, the function gets called with the last given arguments and context.
 * @param {Function} fn - the function to debounce
 * @param {Function} rate - the timeout
 * @return {Promise} resolved with the function's return value.
 */
.factory('$debounce', function($timeout, $q, $log){
    return function $debounce(fn, rate){
        var timeoutPromise, qDefer, debouncePromise;
        rate = rate || 100;
        return function(){
            var self=this;
            var args = Array.prototype.slice.call(arguments);
            if(timeoutPromise){
                $timeout.cancel(timeoutPromise);
            }
            if(!qDefer){
                qDefer = $q.defer();
                debouncePromise = qDefer.promise.then(function(){
                    // qDefer got resolved. forget it's reference in case of recursivity.
                    qDefer = null;
                    return fn.apply(self, args);
                });
            }
            timeoutPromise = $timeout(function(){
                qDefer.resolve();
            }, rate);
            return debouncePromise;
        };
    };
})
.factory('a2LookaheadHelper', function($q){
    var a2LookaheadHelper = function(options){
        this.options=options||{};
        if(!options.searchCompare){
            options.searchCompare = function(a, b){
                return a == b;
            };
        }
    };
    a2LookaheadHelper.prototype={
        search: function(text){
            var options=this.options;
            if(options.minLength && text.length < options.minLength){
                return $q.resolve([]);
            }

            var promise = options.fn(text);

            if(options.includeSearch){
                promise = promise.then(function(items){
                    var textItem = items.filter(function(item){
                        return options.searchCompare(text, item);
                    }).pop();
                    if(!textItem){
                        items.unshift(
                            options.searchPromote ? options.searchPromote(text) : text
                        );
                    }
                    return items;
                });
            }

            return promise;
        }
    };
    return a2LookaheadHelper;
})
.service('EventlistManager', function(){
    var EventlistManager = function(){
        this.events={};
    };
    EventlistManager.prototype.get_event_def = function(event){
        if(!this.events[event]){
            this.events[event]={};
        }
        return this.events[event];
    };
    EventlistManager.prototype.send = function(/* ...args */){
        var args = Array.prototype.slice.call(arguments);
        var event = args.shift();
        if(typeof event == 'string'){
            event = {event:event};
        }
        var eventdef = this.get_event_def(event.event);
        if(event.oneTime){
            eventdef.oneTime=true;
        }
        var context = event.context;
        var listeners = eventdef.listeners;
        eventdef.fired = true;
        if(listeners){
            listeners.forEach(function(l){ l.apply(context, args); });
        }
    };
    EventlistManager.prototype.on = function(event, fn){
        var eventdef = this.get_event_def(event);
        if(eventdef.fired && eventdef.oneTime){
            fn.apply();
        } else {
            if(!eventdef.listeners){
                eventdef.listeners = [];
            }
            eventdef.listeners.push(fn);
        }
    };

    return EventlistManager;
})
;


// TODO break to multiple files
angular.module('a2.infotags', ['a2.services'])
.directive('a2Species', function (Species, $timeout) {
    return {
        restrict : 'E',
        scope : {
            species : '='
        },
        template : '{{data.scientific_name}}',
        link     : function($scope, $element, $attrs){
            $scope.$watch('species', function(newVal, oldVal){
                $scope.data = null;
                if(newVal){
                    Species.findById(newVal, function(data){
                        $timeout(function(){
                            $scope.data = data;
                        });
                    });
                }
            });
        }
    };
})
.directive('a2.songtype', function (Songtypes, $timeout) {
    return {
        restrict : 'E',
        scope : {
            songtype : '='
        },
        template : '{{data.name}}',
        link     : function($scope, $element, $attrs){
            $scope.$watch('songtype', function(newVal, oldVal){
                $scope.data = null;
                if(newVal){
                    Songtypes.findById(newVal, function(data){
                        $timeout(function(){
                            $scope.data = data;
                        });
                    });
                }
            });
        }
    };
});


// TODO break to multiple files
angular.module('a2.classy', [])
.factory('makeClass', function($inheritFrom){
    var slice=Array.prototype.slice;
    return function makeClass(classdef){
        if(!classdef.constructor){
            classdef.constructor = classdef.super && classdef.super.constructor ?
                function super_constructor(){
                    this.super.constructor.apply(this, slice.call(arguments));
                } :
                function empty_constructor(){}
            ;
        }
        if(classdef.static){
            angular.extend(classdef.constructor, classdef.static);
            delete classdef.static;
        }
        if(classdef.super){
            classdef = $inheritFrom(classdef.super, classdef);
        }
        classdef.constructor.prototype = classdef;
        (window.qc||(window.qc=[])).push(classdef);

        return classdef.constructor;
    };
})
.value('$inheritFrom', function $inheritFrom(object){
    var fn = function(){};
    fn.prototype = object;
    if(arguments.length > 1){
        var args = Array.prototype.slice.call(arguments);
        args[0] = new fn();
        return angular.extend.apply(angular, args);
    } else {
        return new fn();
    }
})
;
