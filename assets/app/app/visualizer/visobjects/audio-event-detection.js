angular.module('a2.visobjects.audio-event-detection', [
    'a2.services',
    'a2.visobjects.common',
    'a2.service.plotly-plot-maker',
])
.config(function(VisualizerObjectTypesProvider){
    VisualizerObjectTypesProvider.add({
        type: 'audio-event-detection',
        $loader: ['VisualizerObjectAudioEventDetectionTypeLoader', function(VisualizerObjectAudioEventDetectionTypeLoader){
            return VisualizerObjectAudioEventDetectionTypeLoader;
        }]
    });
})
.service('VisualizerObjectAudioEventDetectionTypeLoader', function (
    $q, AudioEventDetectionService, plotlyPlotMaker, a2UrlUpdate
){
    var aggregates;
    var statisticsInfo;
    var getParameters = $q.resolve().then(function(){
        return $q.all([
            AudioEventDetectionService.getDataAggregatesList().then(function(_aggregates){
                aggregates = _aggregates;
            }),            
            AudioEventDetectionService.getDataStatisticsList().then(function(_statistics){
                statisticsInfo = _statistics.reduce(function(_, $){
                    return _[$.statistic]= $, _;
                }, {});
            })
        ]);
    });


    var AudioEventDetection = function(data){
        this.update(data).then((function(){
            return getParameters;
        }).bind(this)).then((function(){
            return this.selectData({
                x: statisticsInfo.tod,
                y: statisticsInfo.y_max,
                z: aggregates.reduce(function(_, $){ return $.statistic == 'count' ? $ : _; }, null)
            });
        }).bind(this));
    };
    AudioEventDetection.fetch = function(visobject){
        var d = $q.defer();
        visobject = new AudioEventDetection(visobject);
        d.resolve(visobject);
        return d.promise;
    };
    AudioEventDetection.load = function(visobject, $scope){
        return AudioEventDetection.fetch(visobject);
    };
    AudioEventDetection.getCaptionFor = function(visobject){
        return visobject.name;
    };
    AudioEventDetection.prototype = {
        type : "audio-event-detection",
        layout: 'plotted',
        zoomable : false,
        update : function(data){
            console.log("AED data : ", data);
            for(var i in data){ this[i] = data[i]; }

            this.plot={
                layout:{title: data.name,},
                data:[]
            };
            
            if(data.statistics.indexOf('todsec') == -1){
                data.statistics.push('todsec', 'todsecspan', 'freqspan');
            }
            
            return getParameters.then((function(){

                var statistics = data.statistics.reduce(function(_, $){ 
                    return (statisticsInfo[$] && _.push(statisticsInfo[$])), _;
                }, []);

                this.data_selection = {
                    x: statistics,
                    y: statistics,
                    z: aggregates,
                    current: {
                        x: statisticsInfo.tod,
                        y: statisticsInfo.y_max,
                        z: aggregates.reduce(function(_, $){ return $.statistic == 'count' ? $ : _; }, null)
                    }
                };
            }).bind(this));
            
        },
        selectData: function(selection){
            this.data_selection.current = angular.extend({}, this.data_selection.current, selection);
            var x = this.data_selection.current.x,
                y = this.data_selection.current.y,
                z = this.data_selection.current.z;
            console.log("this.data_selection.current", this.data_selection.current);
            return AudioEventDetectionService.getDataFor(
                this.id, x, y, z
            ).then((function(data){
                var plot = (x == y) ? 
                    plotlyPlotMaker.makeBarPlot(x, z, data, this.name) : 
                    plotlyPlotMaker.makeHeatmapPlot(x, y, z, data, this.name);
                this.plot.data = [plot.data];
                this.plot.layout = plot.layout;
            }).bind(this));
        },

        savePlot: function(){
            var x = this.data_selection.current.x,
                y = this.data_selection.current.y,
                z = this.data_selection.current.z;
            return AudioEventDetectionService.savePlotFor(
                this.id, x, y, z
            ).then(function(data){
                a2UrlUpdate.update(data.url);
            });
        },
        getCaption : function(){
            return AudioEventDetection.getCaptionFor(this);
        }
    };
    return AudioEventDetection;
})
;
