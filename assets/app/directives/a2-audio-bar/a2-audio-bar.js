/**
 * @ngdoc overview
 * @name a2-sidenav
 * @description
 * Directive for specifying a sidenav bar.
 * this bar specifies a list of links that can be added
 * whenever a corresponding sidenavbar anchor resides
 */
angular.module('a2.directive.audio-bar', [
    'a2.utils',
    'a2.srv.local-storage',
    'a2.visualizer.audio-player',
])
.directive('a2AudioBar', function(a2SidenavBarService, $parse){
    return {
        restrict: 'E',
        templateUrl: '/directives/a2-audio-bar/a2-audio-bar.html',
        scope: {},
        replace: true,
        controller: 'a2AudioBarCtrl as controller'
    };
})
.factory('a2AudioBarService', function($rootScope){
    return {
        loadUrl: function(url, play){
            $rootScope.$broadcast('a2-audio-load-url', {
                url: url,
                play: play,
            });
        },
    };
})
.controller('a2AudioBarCtrl', function($scope, $filter, a2AudioPlayer, $timeout, $q, $localStorage){Object.assign(this, {
    initialize: function(){
        this.audio_player = new a2AudioPlayer($scope);
        this.expanded = false;
        this.collapseTimeoutInterval = 5000;
        this.loading = false
        this.audio_player.setGain($localStorage.getItem('a2-audio-param-gain') || 1);

        this.deregHandlers = [];
        this.deregHandlers.push($scope.$on('a2-audio-load-url', this.onLoadUrl.bind(this)));
        this.deregHandlers.push($scope.$on('$destroy', this.onDestroy.bind(this)));
    },

    onLoadUrl: function(event, options){
        this.loadUrl(options);
    },

    onDestroy: function(){
        (this.deregHandlers || []).forEach(function(fn){
            fn();
        });
    },

    setCollapseTimer: function(){
        if(this.collapseTimer){
            $timeout.cancel(this.collapseTimer);
        }

        if (this.collapseTimeoutInterval) {
            this.collapseTimer = $timeout((function(){
                this.expanded = false;
            }).bind(this), this.collapseTimeoutInterval);
        }
    },

    seekPercent: function(percent){
        return this.audio_player.setCurrentTime(percent * this.audio_player.resource.duration);
    },

    setGain: function(gain){
        this.setCollapseTimer();
        $localStorage.setItem('a2-audio-param-gain', gain);
        return this.audio_player.setGain(gain);
    },

    play: function(){
        this.setCollapseTimer();
        return this.audio_player.play();
    },

    pause: function(){
        this.setCollapseTimer();
        return this.audio_player.pause();
    },

    stop: function(){
        this.setCollapseTimer();
        return this.audio_player.stop();
    },

    toggleExpanded: function(){
        this.expanded = !this.expanded;
        if(this.expanded){
            this.setCollapseTimer();
        }
    },

    loadUrl: function(options){
        options = options || {};
        const url = options.url;
        const play = options.play || (options.play === undefined) ;

        if(!url){
            return $q.resolve();
        }

        this.loading = true;
        this.expanded = true;
        return this.audio_player.load(url).then((function(){
            this.loading = false;
            if (play) {
                return this.play();
            }
        }).bind(this)).catch((function(e){
            this.loading = false;
            this.error = e;
            console.error(e);
        }).bind(this));
    }
}); this.initialize(this); })
;
