angular.module('a2.visobjects.recording', [
    'a2.services',
    'a2.visobjects.common',
])
.config(function(VisualizerObjectTypesProvider){
    VisualizerObjectTypesProvider.add({
        type: 'recording',
        $loader: ['VisualizerObjectRecordingTypeLoader', function(VisualizerObjectRecordingTypeLoader){
            return VisualizerObjectRecordingTypeLoader;
        }]
    });
})
.service('VisualizerObjectRecordingTypeLoader', function ($q, Project) {
    var khz_format = function(v){return (v/1000) | 0; };

    var recording = function(data, extra){
        for(var i in data){ this[i] = data[i]; }
        this.sampling_rate = this.sample_rate;
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
        var streamId = data.uri.split('/')[3]
        this.tiles.set.forEach((function(tile){
            if (!!data.legacy) {
                tile.src="/api/project/"+Project.getUrl()+"/recordings/tiles/"+this.id+"/"+tile.i+"/"+tile.j;
            } else {
                var start = new Date(new Date(data.datetime).valueOf() + Math.round(tile.s * 1000)).toISOString()
                var end = new Date(new Date(data.datetime).valueOf() + Math.round((tile.s + tile.ds) * 1000)).toISOString()
                tile.src = '/api/ingest/recordings/' + streamId + '_t' + start.replace(/-|:|\./g, '') + '.' + end.replace(/-|:|\./g, '') + '_z95_wdolph_g1_fspec_mtrue_d1023.255.png'
            }
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
    recording.getCaptionFor = function(visobject){
        return visobject.file;
    };
    recording.prototype = {
        type : "recording",
        zoomable : true,
        getCaption : function(){
            return recording.getCaptionFor(this);
        }
    };
    return recording;
})
;
