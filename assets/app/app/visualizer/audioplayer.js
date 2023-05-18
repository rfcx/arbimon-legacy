angular.module('a2.visualizer.audio-player', [])
.service('a2AudioPlayer', function(A2AudioObject, $q, notify, a2Playlists, Project, $localStorage, a2UserPermit){
    'use strict';
    var a2AudioPlayer = function(scope, options){
        this.scope = scope;
        this.gain = 1;
        this.gain_levels = [1, 2, 5, 10, 15, 20, 25, 30, 50];
        this.freq_filter = undefined;
        this.is_playing = false;
        this.is_muted = false;
        this.has_recording = false;
        this.has_next_recording = false;
        this.has_prev_recording = false;
        this.resource = null;
        this.resource_params = {};
        this.isPopupOpened = false;
        this.isSavingPlaylist = false;
        this.playlistData = {};
        this.clustersData = null;
        if(options){
            if(options.gain){
                this.gain = Math.min(Math.max(1, (options && options.gain)|0), this.gain_levels[this.gain_levels.length-1]);
                this.resource_params.gain = this.gain;
            }
            if(options.filter){
                var f=options.filter.split('-');
                var f0=f.shift()|0, f1=f.shift()|0;
                var fmin=Math.min(f0,f1), fmax=Math.max(f0,f1);
                if(fmax){
                    this.freq_filter={min:fmin, max:fmax};
                    this.resource_params.maxFreq=fmax;
                    this.resource_params.minFreq=fmin;
                }
            }
        }
        scope.$on('$destroy', this.discard.bind(this));
    };
    a2AudioPlayer.prototype = {
        setFrequencyFilter: function(freq_filter){
            if(freq_filter){
                this.resource_params.maxFreq=freq_filter.max;
                this.resource_params.minFreq=freq_filter.min;
            } else {
                delete this.resource_params.maxFreq;
                delete this.resource_params.minFreq;
            }
            return this.load(this.resource_url).then((function(){
                this.freq_filter = freq_filter;
            }).bind(this));
            // this.resource.setFrequencyFilter(filter).then((function(){
            //     this.freq_filter = filter;
            // }).bind(this));
        },
        setGain: function(gain){
            gain = Math.max(1, gain | 0);
            if(gain != 1){
                this.resource_params.gain=gain;
            } else {
                delete this.resource_params.gain;
            }
            return (this.resource_url ? this.load(this.resource_url) : $q.resolve()).then((function(){
                this.gain = gain;
            }).bind(this));
            // this.resource.setGain(gain).then((function(){
            //     this.gain = gain;
            // }).bind(this));
        },
        getVolume: function(){
            return this.resource && this.resource.audio.volume;
        },
        setCurrentTime: function(time){
            if(this.resource) {
                this.resource.setCurrentTime(time);
            }
        },
        getCurrentTime: function(){
            return this.resource && this.resource.audio && this.resource.audio.currentTime;
        },
        togglePopup: function() {
            this.isPopupOpened = !this.isPopupOpened;
        },
        isPlaylistDataValid: function() {
            return this.playlistData.playlistName && this.playlistData.playlistName.trim().length > 0;
        },
        closePopup: function() {
            this.isPopupOpened = false;
        },
        savePlaylist: function() {
            this.isSavingPlaylist = true;
            // create playlist
            if (this.clustersData && this.clustersData.playlist) {
                var self = this;
                a2Playlists.create({
                    playlist_name: this.playlistData.playlistName,
                    params: this.clustersData.playlist.recordings,
                    aedIdsIncluded: true
                },
                function(data) {
                    self.isSavingPlaylist = false;
                    self.closePopup();
                     // attach aed to playlist
                    if (data && data.playlist_id) {
                        a2Playlists.attachAedToPlaylist({
                            playlist_id: data.playlist_id,
                            aed: self.clustersData.aed
                        },
                        function(data) {
                            self.playlistData = {};
                            notify.log('Audio event detections are saved in the playlist.');
                        });
                    }
                });
            }
        },
        _load_resource: function(url, params){
            this.loading=true;
            if(params){
                var pk = Object.keys(params);
                if(pk.length){
                    var ch = /\?/.test(url) ? '&' : '?';
                    url += ch + pk.map(function(k){return k + '=' + params[k];}).join('&');
                }
            }
            var resource = new A2AudioObject(url);
            resource.onCompleteListeners.push((function(){
                this.is_playing = false;
            }).bind(this));
            return resource.load_promise.then((function(){
                this.loading=false;
            }).bind(this)).then(function(){
                return resource;
            });
        },
        load: function(url){
            this.discard();
            this.resource = undefined;
            return this._load_resource(url, this.resource_params).then((function(resource){
                this.resource = resource;
                this.duration = resource.duration;
                this.resource_url = url;
                this.has_recording = true;
                this.clustersData = JSON.parse($localStorage.getItem('analysis.clusters'));
                console.log('clustersData', this.clustersData);
            }).bind(this));
        },
        discard: function(){
            this.stop();
            if(this.resource){
                this.resource.discard();
            }
            this.has_recording = false;
            this.resource = undefined;
            this.resource_url = undefined;
        },
        mute: function(muted){
            if(this.resource) {
                this.resource[muted ? 'mute' : 'unmute']();
            }
            this.is_muted = muted;
        },
        play: function(){
            if(this.resource) {
                this.resource.play();
                this.is_playing = true;
            }
        },
        pause: function(){
            if(this.resource) {
                this.resource.pause();
            }
            this.is_playing = false;
        },
        stop: function(){
            if(this.resource) {
                this.resource.stop();
            }
            this.is_playing = false;
        },
        prev_recording : function(){
            this.scope.$broadcast('prev-visobject');
        },
        next_recording : function(){
            this.scope.$broadcast('next-visobject');
        },
        download: function(visobject) {
            if (a2UserPermit.isSuper()) return this.getExportUrl(visobject);
            if ((a2UserPermit.all && !a2UserPermit.all.length) || !a2UserPermit.can('export report')) {
                return notify.error('You do not have permission to download recording');
            }
            return this.getExportUrl(visobject);
        },
        getExportUrl: function(visobject) {
            const form = document.createElement('form')
            form.style.display = 'none'
            form.method = 'GET'
            const url = '/api/project/' + Project.getUrl() + '/recordings/download/' + visobject.id;
            form.action = url
            document.body.appendChild(form)
            form.submit()
            document.body.removeChild(form)
        }
    };
    return a2AudioPlayer;
})
.factory('A2AudioObject', ['$window', '$interval', '$q', function($window, $interval, $q) {
    var poll_loop_interval = 50; // 25;
    // var AudioContext = $window.AudioContext || $window.webkitAudioContext;

    function loadAudio(url) {
        var deferred = $q.defer();
        var audio = new $window.Audio();

        url = url.replace('|', '/');
        audio.addEventListener('error', function(err) {
            console.log('err', err)
            deferred.reject();
        });

        audio.addEventListener('loadstart', function() {
            deferred.resolve(audio);
        });

        // bugfix for chrome...
        $window.setTimeout(function() {
            audio.src = url;
        }, 1);

        return deferred.promise;
    }

    var A2AudioObject = function(url) {
        var d = $q.defer();
        this.url = url;
        this.onCompleteListeners = [];

        this.interval = $interval(this._check_current_time.bind(this), poll_loop_interval);

        this.load_promise = loadAudio(url).then((function(nativeAudio) {
            this.audio = nativeAudio;
            this.audio.addEventListener('canplay', (function() {
                this.duration = this.audio.duration;
                this.paused = this.audio.paused;
                this.src = this.audio.src;
                this.canPlay = true;
            }).bind(this));
            this.audio.addEventListener('error', (function(err) {
                console.log(err)
            }).bind(this));
        }).bind(this), (function(error) {
            this.error = true;
            console.warn(error);
        }).bind(this));

    };

    A2AudioObject.prototype = {
        // disconnect_ctx: function(){
        //     return this.context.suspend().then((function(){
        //         if(this.ctx_filter){
        //             this.ctx_filter.max.disconnect();
        //             this.ctx_filter.min.disconnect();
        //         }
        //         if(this.ctx_gain){
        //             this.ctx_gain.disconnect();
        //         }
        //         this.ctx_source.disconnect();
        //         return this.context.resume();
        //     }).bind(this));
        // },
        // setup_ctx_connections: function(){
        //     return this.context.suspend().then((function(){
        //         var output = this.context.destination;
        //         if(this.ctx_gain){
        //             this.ctx_gain.connect(output);
        //             output = this.ctx_gain;
        //         }
        //         if(this.ctx_filter){
        //             this.ctx_filter.min.connect(output);
        //             this.ctx_filter.max.connect(this.ctx_filter.min);
        //             output = this.ctx_filter.max;
        //         }
        //         this.ctx_source.connect(output);
        //         return this.context.resume();
        //     }).bind(this));
        // },
        // setGain: function(gain){
        //     var d = $q.defer();
        //     this.gain = gain;
        //     var created=false;
        //     if(!this.ctx_gain){
        //         this.ctx_gain = this.context.createGain();
        //         created=true;
        //     }
        //     this.ctx_gain.gain.value = gain;
        //     if(created){
        //         this.setup_ctx_connections().then(d.resolve.bind(d), d.reject.bind(d));
        //     } else {
        //         d.resolve();
        //     }
        //     return d.promise;
        // },

        // setFrequencyFilter: function(filter){
        //     var d = $q.defer();
        //     d.resolve();
        //     var promise = d.promise;
        //     this.filter = filter;
        //     var need_to_connect=false;
        //     if(filter){
        //         var f0 = Math.sqrt(filter.max * (filter.min||1)), bw = filter.max - filter.min;
        //         var Q  = f0 / bw;
        //         if(!this.ctx_filter){
        //             this.ctx_filter = {
        //                 min:this.context.createBiquadFilter(),
        //                 max:this.context.createBiquadFilter()
        //             };
        //             this.ctx_filter.min.type.value = 'highpass';
        //             this.ctx_filter.max.type.value = 'lopass';
        //             this.ctx_filter.min.Q.value = 0.5;
        //             this.ctx_filter.max.Q.value = 0.5;
        //             need_to_connect = true;
        //         }
        //         this.ctx_filter.max.frequency.value = filter.max;
        //         this.ctx_filter.min.frequency.value = filter.min;
        //     } else if(!filter){
        //         if(this.ctx_filter){
        //             promise = this.disconnect_ctx().then((function(){
        //                 this.ctx_filter = undefined;
        //             }).bind(this));
        //             need_to_connect = true;
        //         }
        //     }
        //
        //     if(need_to_connect){
        //         promise = promise.then((function(){
        //             return this.setup_ctx_connections();
        //         }).bind(this));
        //     }
        //
        //     return promise;
        // },

        play : function() {
            // this.context.resume();
            this.audio.play();
            return this;
        },

        complete : function(callback){
            this.onCompleteListeners.push(callback);
        },

        pause : function() {
            this.audio.pause();
            // this.context.suspend();
        },

        restart : function() {
            this.audio.pause();
            // this.context.suspend();
            this.audio.currentTime = 0;
        },

        stop : function() {
            this.restart();
        },

        discard: function() {
            if (!this.discarded) {
                this.discarded = true;
            }
            if(this.context) {
                this.context.close();
                this.context = undefined;
            }
            if(this.interval) {
                $interval.cancel(this.interval);
                this.interval = undefined;
            }
        },

        setVolume : function(volume) {
            this.unmutedVolume = volume;
            this.muted = false;
            this.audio.volume = volume;
        },

        setPlaybackRate : function(rate) {
            this.audio.playbackRate = rate;
        },

        setMuting : function(muting) {
            this.muted = muting;
            this.audio.volume = (+this.muted) * this.unmutedVolume;
        },

        setProgress : function(progress) {
            if (this.audio && this.audio.duration && isFinite(progress)) {
                this.audio.currentTime = this.audio.duration * progress;
            }
        },

        setCurrentTime : function(currentTime) {
            if (this.audio && this.audio.duration) {
                this.audio.currentTime = currentTime;
            }
        },

        _check_current_time : function () {
            if(this.audio) {
                this.currentTime = this.audio.currentTime;

                if (this.currentTime >= this.duration) {
                    this.onCompleteListeners.forEach(function(listener){
                        listener(this);
                    });
                }
            }
        }

    };

    return A2AudioObject;
}])
;
