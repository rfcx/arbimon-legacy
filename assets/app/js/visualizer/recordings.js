angular.module('a2.visualizer.recordings', [])
.controller('a2VisualizerRecordingLayerController', 
function($scope, $modal, $location){
    this.setGain = function(gain){
        $scope.audio_player.setGain(gain).then(function(){
            var gain=$scope.audio_player.gain;
            $scope.location.updateParams({
                gain: gain >= 1 ? gain : undefined
            });
        });
    };
    this.openFreqFilterModal = function(){
        if(!$scope.visobject){
            return;
        }
        $modal.open({
            templateUrl : '/partials/visualizer/modal/frequency_filter_modal.html',
            controller  : 'a2VisualizerFrequencyFilterModalController',
            size        : 'sm',
            resolve     : {
                data : function(){ return {
                    recording : $scope.visobject,
                    filter: $scope.audio_player.freq_filter
                }; }
            }
        }).result.then(
            $scope.audio_player.setFrequencyFilter.bind($scope.audio_player)
        ).then(function(){
            var filter=$scope.audio_player.freq_filter;
            $scope.location.updateParams({
                filter: filter ? (filter.min + '-' + filter.max) : undefined
            });
        });
    };
})
.controller('a2VisualizerFrequencyFilterModalController', function($scope, $modalInstance, data){
    $scope.recording = data.recording;
    $scope.max_freq = data.recording.sample_rate / 2;
    
    $scope.has_previous_filter = true; //!!data.filter;
    $scope.filter = data.filter ? angular.copy(data.filter) : {min:0, max:$scope.max_freq};
    
    $scope.remove_filter = function(){
        $modalInstance.close();
    };
    $scope.apply_filter = function(){
        $modalInstance.close($scope.filter);
    };
})
.directive('a2VisualizerFrequencyFilterRangeControl', function(){
    return {
        restrict:'E',
        templateUrl:'/partials/directives/frequency_filter_range_control.html',
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