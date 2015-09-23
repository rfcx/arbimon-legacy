'use strict';
angular.module('a2.visualizer.audio-player', [])
.service('a2AudioPlayer', function(A2AudioObject){
    var a2AudioPlayer = function(scope){
        this.scope = scope;
        this.is_playing = false;
        this.is_muted = false;
        this.has_recording = false;
        this.has_next_recording = false;
        this.has_prev_recording = false;
        this.resource = null;
        scope.$on('$destroy', this.discard.bind(this));
    };
    a2AudioPlayer.prototype = {
        setCurrentTime: function(time){
            if(this.resource) {
                this.resource.setCurrentTime(time);
            }
        },
        getCurrentTime: function(){
            return this.resource && this.resource.currentTime;
        },
        load: function(url){
            this.discard();
            this.resource = new A2AudioObject(url);
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
    var poll_loop_interval = 25;
    
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
        this.id = id;
        this.safeId = id.replace('/', '|');
        this.onCompleteListeners = [];
        
        this.interval = $interval(this._check_current_time.bind(this), poll_loop_interval);

        loadAudio(id).then((function(nativeAudio) {
            this.audio = nativeAudio;
            this.audio.addEventListener('canplay', (function() {
                this.duration = this.audio.duration;
                this.paused = this.audio.paused;
                this.src = this.audio.src;
                this.canPlay = true;
            }).bind(this));
        }).bind(this), (function(error) {
            this.error = true;
            console.warn(error);
        }).bind(this));
        
    };
    
    A2AudioObject.prototype = {
        play : function() {
            this.audio.play();
            return this;
        },

        complete : function(callback){
            this.onCompleteListeners.push(callback);
        },

        pause : function() {
            this.audio.pause();
        },

        restart : function() {
            this.audio.pause();
            this.audio.currentTime = 0;
        },

        stop : function() {
            this.restart();
        },
        
        discard: function() {
            if (!this.discarded) {
                if(this.interval) {
                    $interval.cancel(this.interval);
                }
                this.discarded = true;
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