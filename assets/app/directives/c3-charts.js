angular.module('c3-charts', [])
.directive('c3Chart', function($window) {
    return {
        restrict: 'E',
        scope: {
            columns: '='
        },
        link: function(scope, element, attrs) {
            console.log('corri');
            $window.chart = scope.chart = $window.c3.generate({
                bindto: element[0],
                size: {
                    width: attrs.width,
                    height: attrs.height,
                },
                tooltip: {
                    show: false
                },
                data: {
                    columns: scope.columns || [],
                    type : attrs.type,
                }
            });

            scope.$watch('columns', function() {
                if(scope.columns) {
                    scope.chart.load({
                        columns: scope.columns || []
                    });
                }
            });
        },
    };
})
;
