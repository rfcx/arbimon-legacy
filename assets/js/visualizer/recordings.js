angular.module('a2.visualizer.recordings', [])
.controller('a2VisualizerRecordingLayerController', 
function($scope, $modal, $location){
    this.i_am_ctrl="yes";
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
        );
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
            element.find('button').on('mousemove', function(event){
                if(event.buttons == 1){
                    var m = /bottom|top/.exec(event.target.className);
                    if(m){
                        var y = event.target.offsetTop + (event.offsetY - event.target.offsetHeight/2);
                        var ammount = scope.maxFreq * Math.max(0, Math.min(1 - y / event.target.parentNode.clientHeight, 1));
                        ammount = ammount | 0; // cast to int
                        var attr = m[0] == 'top' ? 'filterMax' : 'filterMin';
                        scope[attr] = ammount;
                        if(scope.filterMin > scope.filterMax ){
                            scope.filterMax = ammount;
                            scope.filterMin = ammount;
                        }
                        scope.$apply();
                    }
                }
            });
        }
    };
})
;