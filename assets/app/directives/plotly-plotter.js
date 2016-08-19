angular.module('a2.directive.plotly-plotter', [
    'a2.directive.on-resize'
])
.directive('plotlyPlotter', function($window, a2OnResizeService) {
    var config = {showLink:false, sendData:false, displaylogo:false, displayModeBar:true};
    return {
        restrict: 'E',
        scope: {
            layout: '=?',
            data: '=?'
        },
        link: function(scope, element, attrs) {

            Plotly.newPlot(element[0], scope.data || [], scope.layout || {}, config);

            var resizeWatcher = a2OnResizeService.newWatcher(element, function(newSize){
                Plotly.relayout(element[0], newSize);
            });
            
            if(attrs.layout){
                scope.$watch('layout', function(layout, old){
                    if(layout && layout != old){
                        Plotly.relayout(element[0], layout);
                    }
                });
            }
            
            if(attrs.data){
                scope.$watch('data', function(data, old){
                    if(data && data != old){
                        element[0].data = data;
                        Plotly.redraw(element[0]);
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
