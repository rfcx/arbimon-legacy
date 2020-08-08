angular.module('a2.service.plotly-defaults', [
    'a2-plot-specs',
    'a2.service.colorscale-gradients',
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
    PlotSpecs,
    ColorscaleGradients
){
    var defaults = {
        titlefont: {family:'"Helvetica Neue", Helvetica, Arial, sans-serif', size:'14px'},
        tickfont : {family:'sans-serif', size:'11px', color: '#fff'},
    };
    defaults.config = {
        showLink:false, sendData:false, displaylogo:false, displayModeBar:true, scrollZoom:true,
        modeBarButtonsToRemove:['sendDataToCloud', 'autoScale2d'],
    };
    defaults.layout = {
        xaxis:{titlefont: defaults.titlefont, tickfont: defaults.tickfont, color:'#fff'},
        yaxis:{titlefont: defaults.titlefont, tickfont: defaults.tickfont,  color:'#fff'},
        // margin:{l:70 + 25,r:0,b:25,t:50, pad:0},
        plot_bgcolor: '#131525',
        paper_bgcolor: '#131525',
        dragmode:'pan'
    };
    defaults.colorbar = {
        tickfont: defaults.tickfont,
        thickness: PlotSpecs.legend_width - PlotSpecs.legend_axis_w,
    };
    defaults.heatmap = {
        colorscale: ColorscaleGradients.normalize(0),
        colorbar: defaults.colorbar
    };
    return defaults;
})
;
