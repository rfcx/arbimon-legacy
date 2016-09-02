angular.module('a2.service.plotly-defaults', [
])
.provider('PlotlyDefaults', function(){
    
    var PlotlyDefaults = {
        defaults: {},
        set: function(newDefaults, extend){
            if(extend){
                PlotlyDefaults.defaults = angular.merge(defaults, newDefaults);
            } else {
                PlotlyDefaults.defaults = newDefaults;
            }
        },
        $get:function(PlotlyDefaultDefaults){
            return angular.merge(
                PlotlyDefaultDefaults,
                PlotlyDefaults.defaults
            );
        }
    };
    
    return PlotlyDefaults;    
})
.service('PlotlyDefaultDefaults', function(
    VisualizerLayoutSpecs,
    ColorscaleGradients
){
    var defaults = {
        titlefont: {family:'"Helvetica Neue", Helvetica, Arial, sans-serif', size:'14px'},
        tickfont : {family:'sans-serif', size:'11px'},
    };
    defaults.config = {
        showLink:false, sendData:false, displaylogo:false, displayModeBar:true, scrollZoom:true,
        modeBarButtonsToRemove:['sendDataToCloud', 'autoScale2d']
    };
    defaults.layout = {
        xaxis:{titlefont: defaults.titlefont, tickfont: defaults.tickfont},
        yaxis:{titlefont: defaults.titlefont, tickfont: defaults.tickfont},
        // margin:{l:70 + 25,r:0,b:25,t:50, pad:0},
        dragmode:'pan'
    };
    defaults.colorbar = {
        tickfont: defaults.tickfont,
        thickness: VisualizerLayoutSpecs.legend_width - VisualizerLayoutSpecs.legend_axis_w
    };
    defaults.heatmap = {
        colorscale: ColorscaleGradients.normalize(0),
        colorbar: defaults.colorbar
    };
    return defaults;
})
;