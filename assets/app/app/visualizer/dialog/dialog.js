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
            x1: '=',
            y1: '=',
            x2: '=',
            y2: '=',
        },
        controller: 'a2VisualizerDialogCtrl'
    };
})
.controller('a2VisualizerDialogCtrl', function($scope){
    $scope.layout = $scope.$parent.layout;
    $scope.getXSide = function(x1, x2){
        var px = Math.max(0, Math.min($scope.layout.sec2x(x2, 1) / $scope.layout.spectrogram.width, 1));
        return px > .5 ? 'left' : 'right';
    };

    $scope.getXCoord = function(x1, x2){
        return $scope.getXSide(x1, x2) == 'left' ? x1 : x2;
    };

    $scope.getTransform = function(x1, x2, y1, y2){
        var tx = $scope.getXSide(x1, x2) == 'left' ? '-100%' : '0';
        var ty = $scope.getYTranslation((y1 + y2)/2, true);
        return 'translate(' + tx + ', ' + ty + ')';
    };

    $scope.getYTranslation = function(y, asrelativeoffset){
        var py = Math.max(0.1, Math.min($scope.layout.hz2y(y, 1) / $scope.layout.spectrogram.height, .9));
        if (asrelativeoffset){
            py = -py;
        }
        return ((100 * py) | 0) + '%';
    };

})
;
