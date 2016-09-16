var phantom = require('phantom');
var path  = require('path');
var paths = {
    phantom : path.resolve(__dirname, '..', '..', 'phantom'),
    public  : path.resolve(__dirname, '..', '..', 'public'),
    assets  : path.resolve(__dirname, '..', '..', 'assets'),
};

paths.plot_html = path.join(paths.phantom, 'plot.html');
paths.shim_js   = path.join(paths.phantom, 'shim.js');
paths.plotly_js = path.join(paths.public, 'assets', 'plotly.js', 'plotly.js');
paths.color_gradients_js = path.join(paths.assets, 'app', 'services', 'colorscale-gradients.js');
paths.plot_maker_js = path.join(paths.assets, 'app', 'services', 'plot-maker.js');
paths.plotly_defaults_js = path.join(paths.assets, 'app', 'services', 'plotly-defaults.js');

module.exports.plot = function plot(data, file){
    var instance, page;
    var plotSize = {width:351, height:128};
    return phantom.create().then(function(_instance){
        instance = _instance;
        return instance.createPage();
    }).then(function(_page){
        page = _page;
        return page.open('file://' + paths.plot_html);
    }).then(function(status){
        if(status != 'success'){
            throw new Error("Could not load plotter script");
        }
        
        return page.on('onConsoleMessage', function(msg){
            console.log("page msg :: ", msg);
        });
    }).then(function(){
        return page.invokeMethod('injectJs', paths.plotly_js);
    }).then(function(){
        return page.invokeMethod('injectJs', paths.shim_js);
    }).then(function(){
        return page.invokeMethod('injectJs', paths.color_gradients_js);
    }).then(function(){
        return page.invokeMethod('injectJs', paths.plot_maker_js);
    }).then(function(){
        return page.invokeMethod('injectJs', paths.plotly_defaults_js);
    }).then(function(){
        return page.property('viewportSize', plotSize);
    }).then(function(){
        return page.invokeMethod('evaluate', function(plotSize, data){
            var plotlyPlotMaker = window.angular.service.plotlyPlotMaker();
            var plotDefaults = window.angular.service.PlotlyDefaultDefaults({
                legend_width : 16,
                legend_axis_w : 0
            }, window.angular.service.ColorscaleGradients());
            var plot = data.y ? 
                plotlyPlotMaker.makeHeatmapPlot({},{},{}, data) : 
                plotlyPlotMaker.makeBarPlot({}, {}, data)
            ;
            plot.data.showscale = false;
            window.Plotly.newPlot(document.getElementById('plot'), plotlyPlotMaker.mergeData([
                plot.data
            ], plotDefaults), {
                    width:plotSize.width, 
                    height:plotSize.height,
                    margin: { t:0, b:0, l:0, r:0 } 
                }, {
                    staticplot: true
                }
            );
        }, plotSize, data);
    }).then(function(){
    //     return page.property('content');
    // }).then(function(pagecontent){
    //     console.log(pagecontent);
    // }).then(function(){
        return page.invokeMethod('render', file);
    }).then(function(){
        if(instance){
            instance.exit();
        }
    }, function(err){
        if(instance){
            instance.exit();
        }
        throw err;
    });
};