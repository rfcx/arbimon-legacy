/**
 * @ngdoc overview
 * @name a2-on-resize
 * @description
 * Directive for detecting size changes in an element.
 */
angular.module('a2.directive.on-resize', [
])
.service('a2OnResizeService', function($window, $rootScope){
    var watchers=[], animationFramePending=false;
    
    function Watcher(element, handler){
        this.element = element;
        this.handler = handler;
        this.value = null;
        
        watchers.push(this);
        watch.scheduleAnimationFrame();
    }
    
    Watcher.prototype.destroy = function(){
        var index = watchers.indexOf(this);
        if(index >= 0){
            watchers.splice(index, 1);
        }
    };
    
    
    function watch(){
        animationFramePending=false;
        var triggered=[];
        watchers.forEach(function(watcher){
            var width = watcher.element[0].clientWidth;
            var height = watcher.element[0].clientHeight;
            if(!watcher.value || watcher.value.width != width || watcher.value.height != height){
                watcher.value = {width:width, height:height};
                triggered.push(watcher);
            }
        });
        if(triggered.length){
            $rootScope.$apply(function(){
                triggered.forEach(function(watcher){
                    try{
                        watcher.handler(watcher.value);
                    } catch(e){
                        console.error(e);
                    }
                });
            });
        }
        watch.scheduleAnimationFrame();
    }
    watch.scheduleAnimationFrame = function(){
        if(watchers.length && !animationFramePending){
            animationFramePending = true;
            $window.requestAnimationFrame(watch);
        }
    };
    
    return {
        newWatcher: function(element, handler){
            return new Watcher(element, handler);
        }
    };
})
.directive('a2OnResize', function($parse, a2OnResizeService) {
    return {
        restrict: 'A',
        link: function (scope, element, attr) {
            var onResize = $parse(attr.a2OnResize);
            var watcher = a2OnResizeService.newWatcher(element, function(newSize){
                onResize(newSize, scope);
            });

            scope.$on('$destroy', function(){
                watcher.destroy();
            });
            
        }
    };
})
;