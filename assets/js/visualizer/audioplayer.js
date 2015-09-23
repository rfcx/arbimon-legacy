angular.module('a2.visualizer.audio-player')
.service('a2AudioPlayer', function(ngAudio){
    var a2AudioPlayer = function(scope){
        this.scope = scope;
        this.is_playing = false;
        this.is_muted = false;
        this.has_recording = false;
        this.has_next_recording = false;
        this.has_prev_recording = false;
        this.resource = null;
    };
    a2AudioPlayer.prototype = {
        setCurrentTime: function(time){
            if(this.resource) {
                this.resource.currentTime = time;
            }
        },
        load: function(url){
            this.stop();
            this.resource = ngAudio.load(url);
            this.has_recording = true;
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
;