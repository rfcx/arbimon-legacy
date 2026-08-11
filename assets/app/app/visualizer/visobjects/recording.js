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
.service('VisualizerObjectRecordingTypeLoader', function ($q, Project, $localStorage) {
    var khz_format = function(v){return (v/1000) | 0; };

    var getSelectedFrequencyCache = function() {
        try {
            return $localStorage.getItem('visuilizer.frequencies.cache') || {originalScale: true};
        } catch(e){
            return {originalScale: true};
        }
    };
    var scaleCache = getSelectedFrequencyCache();

    var getSpectroColor = function() {
        const colors = ['mtrue', 'mfalse', 'mfalse_p2', 'mfalse_p3', 'mfalse_p4']
        try {
            const selectedColor = $localStorage.getItem('visualizer.spectro_color')
            return selectedColor && colors.includes(selectedColor) ? selectedColor : 'mtrue';
        } catch(e){
            return 'mtrue';
        }
    };

    var recording = function(data, extra){
        for(var i in data){ this[i] = data[i]; }
        this.sampling_rate = this.sample_rate;
        this.extra  = extra;
        this.max_freq = this.sampling_rate / 2;
        this.span = scaleCache && scaleCache.originalScale ? this.max_freq : (this.max_freq > 24000 ? this.max_freq : 24000);
        if (!data) {
            this.span = 44100/2
            this.duration = 60
        }
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
                to   : this.span,
                span : this.span,
                unit : 'Frequency ( kHz )',
                tick_format : khz_format
            }
        };
        if (!this.tiles) {
            this.isDisabled = true
            return
        }
        var spectroColoredCache = getSpectroColor();

        // set it to the scope
        const randomString = Math.round(Math.random() * 100000000)
        this.tiles.set.forEach((function(tile){
            if (!!data.legacy) {
                tile.src="/legacy-api/project/"+Project.getUrl()+"/recordings/tiles/"+this.id+"/"+tile.i+"/"+tile.j+"/"+randomString;
            } else if (tile.mediaToken && tile.mediaStart && tile.mediaEnd) {
                // DIRECT to media-api with the token the SERVER minted for this
                // exact tile window (#99). The payload this view already fetches
                // (/legacy-api/project/:url/recordings/info/:id -> 
                // fetchSpectrogramTiles -> attachTileMediaTokens) has carried
                // mediaToken/mediaStreamId/mediaStart/mediaEnd/mediaExp on every
                // tile since #1806 -- this view was simply ignoring them and
                // composing a proxy URL instead.
                //
                // 🔴 USE THE SERVER'S start/end VERBATIM. Do NOT recompute them
                // (as the line this replaces did): the token signs
                // streamId_startMs_endMs[_exp], so re-deriving the window
                // client-side risks disagreeing with what was signed by a
                // millisecond -- and a mismatch is a SILENT 401 that renders as
                // blank space, because the tile <img> has no error surface.
                // That is exactly the fractional-ms defect class fixed in the
                // SPA on 2026-08-10.
                //
                // The palette stays client-side: render params are deliberately
                // NOT part of the signed message, so the per-user spectro colour
                // still works without a re-mint.
                var streamId = tile.mediaStreamId || data.uri.split('/')[3];
                tile.src = '/media-api/internal/assets/streams/' + streamId +
                    '_t' + tile.mediaStart + 'Z.' + tile.mediaEnd + 'Z' +
                    '_z95_wdolph_g1_fspec_' + spectroColoredCache + '_d1023.255.png' +
                    '?stream-token=' + tile.mediaToken +
                    (tile.mediaExp ? '&exp=' + tile.mediaExp : '');
            } else {
                // FALLBACK: server could not mint (salt unset, or an older
                // backend). Keep the session-gated proxy so a misconfigured
                // environment degrades rather than showing blank tiles.
                var fallbackStreamId = data.uri.split('/')[3]
                const datetime = data.datetime_utc ? data.datetime_utc : data.datetime
                var start = new Date(new Date(datetime).valueOf() + Math.round(tile.s * 1000)).toISOString()
                var end = new Date(new Date(datetime).valueOf() + Math.round((tile.s + tile.ds) * 1000)).toISOString()
                tile.src = '/legacy-api/ingest/recordings/' + fallbackStreamId + '_t' + start.replace(/-|:|\./g, '') + '.' + end.replace(/-|:|\./g, '') + '_z95_wdolph_g1_fspec_' + spectroColoredCache + '_d1023.255.png';
            }
        }).bind(this));
    };
    recording.layers=[

    ];
    recording.fetch = function(visobject){
        var d = $q.defer();
        Project.getRecordingInfo(visobject.id, visobject.spectroColor, function(data){
            if (data === 'Server error') {
                visobject.isDisabled = true
                data = {}
            }
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
