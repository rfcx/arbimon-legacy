'use strict';
angular.module('a2.visualizer.audio-player', [])
.service('a2AudioPlayer', function(A2AudioObject){
    var a2AudioPlayer = function(scope){
        this.scope = scope;
        this.gain = 1;
        this.gain_levels = [1, 2, 3, 4, 5];
        this.is_playing = false;
        this.is_muted = false;
        this.has_recording = false;
        this.has_next_recording = false;
        this.has_prev_recording = false;
        this.resource = null;
        scope.$on('$destroy', this.discard.bind(this));
    };
    a2AudioPlayer.prototype = {
        setFrequencyFilter: function(filter){
            this.resource.setFrequencyFilter(filter).then((function(){
                this.freq_filter = filter;
            }).bind(this));
        },
        setGain: function(gain){
            this.resource.setGain(gain).then((function(){
                this.gain = gain;
            }).bind(this));
        },
        getVolume: function(){
            return this.resource && this.resource.audio.volume
        },
        setCurrentTime: function(time){
            if(this.resource) {
                this.resource.setCurrentTime(time);
            }
        },
        getCurrentTime: function(){
            return this.resource && this.resource.audio && this.resource.audio.currentTime;
        },
        load: function(url){
            this.discard();
            this.resource = new A2AudioObject(url);
            this.resource.onCompleteListeners.push((function(){
                this.is_playing = false;
            }).bind(this));
            this.has_recording = true;
        },
        discard: function(){
            this.stop();
            if(this.resource){
                this.resource.discard();
                this.resource = undefined;
            }
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
    };
    return a2AudioPlayer;
})
.factory('A2AudioObject', ['$window', '$interval', '$q', function($window, $interval, $q) {
    var poll_loop_interval = 50; // 25;
    var AudioContext = $window.AudioContext || $window.webkitAudioContext;
    
    function loadAudio(url) {
        var deferred = $q.defer();
        var audio = new $window.Audio();

        url = url.replace('|', '/');
        audio.addEventListener('error', function() {
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
    
    var A2AudioObject = function(id) {
        var d = $q.defer();
        this.id = id;
        this.safeId = id.replace('/', '|');
        this.onCompleteListeners = [];
        this.context = new AudioContext();
        $window.a2ao = this;
        
        this.interval = $interval(this._check_current_time.bind(this), poll_loop_interval);
        
        loadAudio(id).then((function(nativeAudio) {
            this.audio = nativeAudio;
            this.audio.addEventListener('canplay', (function() {
                if(!this.ctx_source){
                    this.ctx_source = this.context.createMediaElementSource(this.audio);
                    this.duration = this.audio.duration;
                    this.paused = this.audio.paused;
                    this.src = this.audio.src;
                    this.canPlay = true;
                    this.setup_ctx_connections();
                }
            }).bind(this));
        }).bind(this), (function(error) {
            this.error = true;
            console.warn(error);
        }).bind(this));
        
    };
    
    A2AudioObject.prototype = {
        disconnect_ctx: function(){
            return this.context.suspend().then((function(){
                if(this.ctx_filter){
                    this.ctx_filter.max.disconnect();
                    this.ctx_filter.min.disconnect();
                }
                if(this.ctx_gain){
                    this.ctx_gain.disconnect();
                }
                this.ctx_source.disconnect();
                return this.context.resume();
            }).bind(this));
        },
        setup_ctx_connections: function(){
            return this.context.suspend().then((function(){
                var output = this.context.destination;
                if(this.ctx_gain){
                    this.ctx_gain.connect(output);
                    output = this.ctx_gain;
                }
                if(this.ctx_filter){
                    this.ctx_filter.min.connect(output);
                    this.ctx_filter.max.connect(this.ctx_filter.min);
                    output = this.ctx_filter.max;
                }
                this.ctx_source.connect(output);
                return this.context.resume();
            }).bind(this));
        },        
        setGain: function(gain){
            var d = $q.defer();
            this.gain = gain;
            var created=false;
            if(!this.ctx_gain){
                this.ctx_gain = this.context.createGain();
                created=true;
            }
            this.ctx_gain.gain.value = gain;
            if(created){
                this.setup_ctx_connections().then(d.resolve.bind(d), d.reject.bind(d));
            } else {
                d.resolve();
            }
            return d.promise;
        },
        
        setFrequencyFilter: function(filter){
            var d = $q.defer();
            d.resolve();
            var promise = d.promise;
            this.filter = filter;
            var need_to_connect=false;
            if(filter){
                var f0 = Math.sqrt(filter.max * (filter.min||1)), bw = filter.max - filter.min;
                var Q  = f0 / bw;
                if(!this.ctx_filter){
                    this.ctx_filter = {
                        min:this.context.createBiquadFilter(),
                        max:this.context.createBiquadFilter()
                    };
                    this.ctx_filter.min.type.value = 'highpass';
                    this.ctx_filter.max.type.value = 'lopass';
                    this.ctx_filter.min.Q.value = 0.5;
                    this.ctx_filter.max.Q.value = 0.5;
                    need_to_connect = true;
                }
                this.ctx_filter.max.frequency.value = filter.max;
                this.ctx_filter.min.frequency.value = filter.min;
            } else if(!filter){
                if(this.ctx_filter){
                    promise = this.disconnect_ctx().then((function(){
                        this.ctx_filter = undefined;
                    }).bind(this));
                    need_to_connect = true;
                }
            }
            
            if(need_to_connect){
                promise = promise.then((function(){
                    return this.setup_ctx_connections();
                }).bind(this));
            }
            
            return promise;
        },
        
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