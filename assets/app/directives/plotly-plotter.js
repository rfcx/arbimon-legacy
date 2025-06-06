angular.module('a2.directive.plotly-plotter', [
    'a2.directive.on-resize',
    'a2.service.plotly-defaults',
    'a2.service.plotly-plot-maker',
])
.directive('c', function(
    $window, a2OnResizeService, 
    PlotlyDefaults,
    plotlyPlotMaker
) {
    return {
        restrict: 'E',
        scope: {
            layout: '=?',
            data: '=?'
        },
        link: function(scope, element, attrs) {
            function mergeData(data){
                return plotlyPlotMaker.mergeData(data, PlotlyDefaults);
            }

            function mergeLayout(layout){
                return plotlyPlotMaker.mergeLayout(layout, PlotlyDefaults);
            }
            
            Plotly.newPlot(element[0], mergeData(scope.data), mergeLayout(scope.layout), PlotlyDefaults.config);

            var resizeWatcher = a2OnResizeService.newWatcher(element, function(newSize){
                Plotly.relayout(element[0], newSize);
            });
            
            if(attrs.layout){
                scope.$watch('layout', function(layout, old){
                    if(layout && layout != old){
                        Plotly.relayout(element[0], mergeLayout(layout));
                    }
                });
            }
            
            if(attrs.data){
                scope.$watch('data', function(data, old){
                    if(data && data != old){
                        // Plotly.purge(element[0]);
                        console.log("Plotly plot data ::", data, scope.layout);
                        Plotly.newPlot(element[0], mergeData(scope.data), mergeLayout(scope.layout), PlotlyDefaults.config);
                    }
                });
            }

            scope.$on('$destroy', function(){
                resizeWatcher.destroy();
            });

        },
    };
})
;
