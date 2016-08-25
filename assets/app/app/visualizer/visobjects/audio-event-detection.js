angular.module('a2.visobjects.audio-event-detection', [
    'a2.services',
    'a2.visobjects.common',
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
    $q, AudioEventDetectionService
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
                function range(start, count, step){
                    var _=[];
                    for(var i=0, x=start; i < count; ++i, x += step){
                        _.push(x);
                    }
                    return _;
                }
                
                var plotdata;

                if(x == y){
                    plotdata = {
                        orientation:'v',
                        type:'bar',
                    };

                    if(data.rows){
                        plotdata.x = data.rows.map(function(_){ return data.x.min + data.x.step * _.x;});
                        plotdata.y = data.rows.map(function(_){ return _.z;});
                    } else if(data.matrix){
                        plotdata.x = range(data.x.min, data.x.bins, data.x.step);
                        plotdata.y = data.matrix[0];
                    }
                    
                    this.plot.data = [plotdata];
                    this.plot.layout = {
                        xaxis: {boundsmode: 'auto'},
                        yaxis: {boundsmode: 'auto'},
                    };
                } else {
                    plotdata = {
                        type:'heatmap',
                        hoverinfo:'x+y+z'
                    };
                    
                    if(data.rows){
                        plotdata.x = data.rows.map(function(_){ return data.x.min + data.x.step * _.x;});
                        plotdata.y = data.rows.map(function(_){ return data.y.min + data.y.step * _.y;});
                        plotdata.z = data.rows.map(function(_){ return _.z;});
                    } else if(data.matrix){
                        plotdata.x = range(data.x.min, data.x.bins, data.x.step);
                        plotdata.y = range(data.y.min, data.y.bins, data.y.step);
                        plotdata.z = data.matrix;
                    }
                    
                    this.plot.data = [plotdata];
                    this.plot.layout = {
                        xaxis: {boundsmode: 'auto'},
                        yaxis: {boundsmode: 'auto'},
                    };
                }
            }).bind(this));
        },
        getCaption : function(){
            return AudioEventDetection.getCaptionFor(this);
        }
    };
    return AudioEventDetection;
})
;
