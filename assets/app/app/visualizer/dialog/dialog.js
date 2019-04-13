/**
 * @ngdoc overview
 * @name dialog
 * @description
 * Visualizer dialog window module.
 */
angular.module('a2.visualizer.dialog', [
])
.directive('a2VisualizerDialog', function(){
    return {
        restrict : 'E',
        transclude: true,
        templateUrl: '/app/visualizer/dialog/dialog.html',
        scope : {
            show: '=',
            x: '=',
            y: '=',
        },
        controller: 'a2VisualizerDialogCtrl'
    };
})
.controller('a2VisualizerDialogCtrl', function($scope){
    $scope.layout = $scope.$parent.layout;
    $scope.getYTranslation = function(y, asrelativeoffset){
        var py = Math.max(0.1, Math.min($scope.layout.hz2y(y, 1) / $scope.layout.spectrogram.height, .9));
        if (asrelativeoffset){
            py = -py;
        }
        return ((100 * py) | 0) + '%';
    };

})
;
