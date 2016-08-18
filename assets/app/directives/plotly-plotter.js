angular.module('a2.directive.plotly-plotter', [
    'a2.directive.on-resize'
])
.directive('plotlyPlotter', function($window, a2OnResizeService) {
    return {
        restrict: 'E',
        scope: {
            // columns: '='
        },
        link: function(scope, element, attrs) {
            var x = [];
            var y = [];
            for (var i = 0; i < 500; i ++) {
            	x[i] = Math.random();
            	y[i] = Math.random() + 1;
            }

            var data = [{
                x: x,
                y: y,
                type: 'histogram2d'
            }];
            
            Plotly.newPlot(element[0], data);
            console.log("Plotly.newPlot element::", element[0]);

            var resizeWatcher = a2OnResizeService.newWatcher(element, function(newSize){
                console.log("Plotly.newPlot resize::", newSize);
                Plotly.relayout(element[0], newSize);
            });

            scope.$on('$destroy', function(){
                resizeWatcher.destroy();
            });

        },
    };
})
;
