angular.module('a2.service.plotly-plot-maker', [
])
.service('plotlyPlotMaker', function(){
    var plotlyPlotMaker = {
        range: function range(start, count, step){
            var _=[];
            for(var i=0, x=start; i < count; ++i, x += step){
                _.push(x);
            }
            return _;
        },
        mergeData: function mergeData(data, defaults){
            return (data || []).map(function(datum){
                return angular.merge(angular.copy(defaults[datum.type] || {}), datum);
            });
        },
        mergeLayout: function mergeLayout(layout, defaults){
            return angular.merge(angular.copy(defaults.layout), layout);
        },        
        makeHeatmapPlot: function(x, y, z, data, title){

            var plot = {
                data : {
                    type:'heatmap',
                    hoverinfo:'x+y+z',
                    colorbar: {title: z.title}
                    // connectgaps:true,
                },
                layout: {
                    title : title,
                    xaxis: {boundsmode: 'auto', title:x.title, ticksuffix: x.units || ''},
                    yaxis: {boundsmode: 'auto', title:y.title, ticksuffix: y.units || ''},
                }
            };
            
            if(data.rows){
                plot.data.x = data.rows.map(function(_){ return data.x.min + data.x.step * _.x;});
                plot.data.y = data.rows.map(function(_){ return data.y.min + data.y.step * _.y;});
                plot.data.z = data.rows.map(function(_){ return _.z;});
            } else if(data.matrix){
                plot.data.x = plotlyPlotMaker.range(data.x.min, data.x.bins, data.x.step);
                plot.data.y = plotlyPlotMaker.range(data.y.min, data.y.bins, data.y.step);
                plot.data.z = data.matrix;
            }

            return plot;
        },
        makeBarPlot: function(x, y, data, title){

            var plot = {
                data : {
                    orientation:'v',
                    type:'bar',
                },
                layout: {
                    title : title,
                    xaxis: {boundsmode: 'auto', title:x.title, ticksuffix: x.units || ''},
                    yaxis: {boundsmode: 'auto', title:y.title},
                }
            };
            
            if(data.rows){
                plot.data.x = data.rows.map(function(_){ return data.x.min + data.x.step * _.x;});
                plot.data.y = data.rows.map(function(_){ return _.z;});
            } else if(data.matrix){
                plot.data.x = plotlyPlotMaker.range(data.x.min, data.x.bins, data.x.step);
                plot.data.y = data.matrix[0];
            }
            return plot;
        },        
    };
    return plotlyPlotMaker;    
})
;
