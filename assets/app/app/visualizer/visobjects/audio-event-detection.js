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
.service('VisualizerObjectAudioEventDetectionTypeLoader', function ($q, Project) {
    var khz_format = function(v){ return (v/1000) | 0; };
    var khz_unit_fmt = function(v){ return (Math.floor(v/10.0)/100.0) + " kHz"; };
    var aggregations = {
        'time_of_day'   : {
            time_unit : 'Time (Hour in Day)',
            unit_fmt  : function(v){ return (v|0)+":00";}
        },
        'day_of_month'  : {
            time_unit : 'Time (Day in Month)',
            unit_fmt  : function(v){ return v|0;}
        },
        'day_of_year'   : {
            time_unit : 'Time (Day in Year )',
            unit_fmt  : function(v){ return v|0;}
        },
        'month_in_year' : {
            time_unit : 'Time (Month in Year)',
            unit_fmt  : function(v){ return moment().localeData()._months[(v|0) - 1];}
        },
        'day_of_week'   : {
            time_unit : 'Time (Weekday) ',
            unit_fmt  : function(v){ return moment().localeData()._weekdays[(v|0) - 1];}
        },
        'year'          : {
            time_unit : 'Time (Year) ',
            unit_fmt  : function(v){ return v|0;}
        },
        'unknown'       : {
            time_unit : 'Time',
            unit_fmt  : function(v){ return v|0;}
        },
    };
    
    var AudioEventDetection = function(data){
        this.update(data);
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
        var agg = {
            'time_of_day'   : 'Time of day',
            'day_of_month'  : 'Day of Month',
            'day_of_year'   : 'Day of Year',
            'month_in_year' : 'Month in year',
            'day_of_week'   : 'Day of week',
            'year'          : 'Year '
        };
        return visobject.name + " (" + agg[visobject.aggregation] + ")";
    };
    AudioEventDetection.prototype = {
        type : "audio-event-detection",
        zoomable : false,
        update : function(data){
            for(var i in data){ this[i] = data[i]; }

            var t0=this.min_t, t1=this.max_t;
            var f0=this.min_f, f1=this.max_f;
            var v0=this.min_value, v1=this.visual_max_value || this.max_value;
            if(this.normalized){
                v0=0;
                v1=100;
            }
            var dt= t1 - t0 + 1, df= f1 - f0, dv = v1 - v0;

            var aggregation = aggregations[this.aggregation] || aggregations.unknown;
            var time_unit = aggregation.time_unit;

            // setup the domains
            this.domain = {
                x : {
                    // from : t0, to : t1 + 1, span : dt + 1, ticks : dt + 1,
                    from : t0, to : t1, span : dt, ticks : dt,
                    ordinal : true,
                    unit_interval : 1,
                    unit_format : aggregation.unit_fmt,
                    unit : time_unit || 'Time ( s )'
                },
                y : {
                    from : f0, to : f1, span : df,
                    unit : 'Frequency ( kHz )',
                    unit_interval : this.bin_size,
                    unit_format : khz_unit_fmt,
                    tick_format : khz_format
                },
                legend : {
                    from : v0, to : v1, span : dv,
                    ticks: Math.max(2, Math.min(dv|0, 10)),
                    unit : 'Count',
                    src  : '/images/palettes/'+this.visual_palette+'.png'
                }

            };
            if(this.normalized){
                this.domain.legend.tick_format = function(v){ return v+'%';};
            }
            // set it to the scope
            this.tiles = { x:1, y:1, set : [{
                i:0, j:0,
                s : 0, hz : f1, ds  : dt, dhz : df,
                src : this.thumbnail,
                crisp : true
            }]};
            this.legend = {
                min : 0, max:255
            };
            
        },
        getCaption : function(){
            return AudioEventDetection.getCaptionFor(this);
        }
    };
    return AudioEventDetection;
})
;
