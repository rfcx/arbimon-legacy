angular.module('a2-plot-specs',[
    'a2.utils-browser-metrics'
])
.factory('PlotSpecs', function(a2BrowserMetrics){
    return {
        gutter       :  a2BrowserMetrics.scrollSize.height,
        axis_sizew   :  60,
        axis_sizeh   :  60,
        legend_axis_w : 45,
        legend_width  : 60,
        legend_gutter : 30,
        axis_lead    :  15
    };
})
;