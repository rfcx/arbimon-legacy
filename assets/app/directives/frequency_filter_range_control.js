angular.module('a2.directive.frequency_filter_range_control', [
])
.directive('a2VisualizerFrequencyFilterRangeControl', function(){
    return {
        restrict:'E',
        templateUrl:'/directives/frequency_filter_range_control.html',
        scope: {
            imgSrc:"=",
            filterMin:"=",
            filterMax:"=",
            maxFreq:"="
        },
        link: function(scope, element, attrs){
            'use strict';
            var pressed;
            var container = element.find('.a2-audio-freq-filter-component');
            function detectMouseUp(event){
                pressed=undefined;
                angular.element(document).off('mousemove', detectMouseMove);
            }
            function detectMouseDown(event){
                var btn = event.buttons === undefined ? event.which : event.buttons;
                if(btn == 1){
                    pressed=event.target;
                    angular.element(document).on('mousemove', detectMouseMove);
                }
            }
            function detectMouseMove(event){
                if(pressed){
                    var m = /bottom|top/.exec(pressed.className);
                    if(m){
                        var eloff = container.offset();
                        var y = event.pageY - eloff.top;
                        var ammount = scope.maxFreq * Math.max(0, Math.min(1 - y / pressed.parentNode.clientHeight, 1));
                        ammount = ((ammount / 100) | 0) * 100; // cast to int and quantize
                        var attr = m[0] == 'top' ? 'filterMax' : 'filterMin';
                        scope[attr] = ammount;
                        if(scope.filterMin > scope.filterMax ){
                            scope.filterMax = ammount;
                            scope.filterMin = ammount;
                        }
                        scope.$apply();
                    }
                }
            }
            container.find('button').on('mousedown', detectMouseDown);            
            container.on('mousemove', function(event){});
            angular.element(document).on('mouseup', detectMouseUp);
            element.on('$destroy', function(){
                angular.element(document).off('mouseup', detectMouseUp);
                angular.element(document).off('mousemove', detectMouseMove);
            });
        }
    };
})
;