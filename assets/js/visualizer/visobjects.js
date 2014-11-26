angular.module('a2visobjects', [
    'a2services'
])
.service('VisualizerObjectTypes', function ($q, Project, $injector) {
    var type_list = ["recording", "soundscape"];
    var types = {};
    var inject = type_list.map(function(type){return "VisualizerObject" + type.replace(/^(\w)/, function(x){return x.toUpperCase();}) + "Type";});
    inject.push(function(){ 
        for(var a=arguments, t=type_list, i=0, e=t.length; i < e; ++i){
            types[t[i]] = a[i];
        }
    });
    $injector.invoke(inject);    
    return types;
})
.service('VisualizerObjectRecordingType', function ($q, Project, $injector) {
    var khz_format = function(v){return (v/1000) | 0; };
    
    var recording = function(data, extra){
        for(var i in data){ this[i] = data[i]; }
        this.duration      = this.stats.duration;
        this.sampling_rate = this.stats.sample_rate;
        this.extra  = extra;
        // fix up some stuff
        this.max_freq = this.sampling_rate / 2;
        // setup the domains
        this.domain = {
            x : {
                from : 0,
                to   : this.duration,
                span : this.duration,
                unit : 'Time ( s )',
                ticks : 60
            },
            y : {
                from : 0,
                to   : this.max_freq,
                span : this.max_freq,
                unit : 'Frequency ( kHz )',
                tick_format : khz_format
            }
        };
        // set it to the scope
        this.tiles.set.forEach((function(tile){
            tile.src="/api/project/test1/recordings/tiles/"+this.id+"/"+tile.i+"/"+tile.j;
        }).bind(this));
    };
    recording.layers=[
    
    ];
    recording.fetch = function(visobject){
        var d = $q.defer();
        Project.getRecordingInfo(visobject.id, function(data){
            visobject = new recording(data, visobject.extra);
            d.resolve(visobject);
        });
        return d.promise;
    };
    recording.load = function(visobject, $scope){
        return recording.fetch(visobject).then(function(visobject){
            if(visobject.audioUrl) {
                $scope.audio_player.load(visobject.audioUrl);
            }
            return visobject;
        });
    };
    recording.prototype = {
        type : "recording",
        zoomable : true,
        getCaption : function(){
            return this.file;
        }
    };
    return recording;
})
.service('VisualizerObjectSoundscapeType', function ($q, Project, $injector) {
    var khz_format = function(v){return (v/1000) | 0; };
    var khz_unit_fmt = function(v){return (Math.floor(v/10.0)/100.0) + " kHz";}
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
    
    var soundscape = function(data){
        for(var i in data){ this[i] = data[i]; }
        
        var t0=this.min_t, t1=this.max_t;
        var f0=this.min_f, f1=this.max_f;
        var v0=this.min_value, v1=this.max_value;
        var dt= t1 - t0 + 1, df= f1 - f0, dv = v1 - v0;
        
        var aggregation = aggregations[this.aggregation] || aggregations['unknown'];
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
                src  : '/images/soundscape-palette.png'
            }

        };
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
    };
    soundscape.fetch = function(visobject){
        var d = $q.defer();
        visobject = new soundscape(visobject);
        d.resolve(visobject);
        return d.promise;
    };
    soundscape.load = function(visobject, $scope){
        return soundscape.fetch(visobject);
    };
    soundscape.prototype = {
        type : "soundscape",
        getCaption : function(){
            var agg = {
                'time_of_day'   : 'Time of day',
                'day_of_month'  : 'Day of Month',
                'day_of_year'   : 'Day of Year',
                'month_in_year' : 'Month in year',
                'day_of_week'   : 'Day of week',
                'year'          : 'Year '
            };
            return this.name + " (" + agg[this.aggregation] + ")";
        }
    };
    return soundscape;
})
;
