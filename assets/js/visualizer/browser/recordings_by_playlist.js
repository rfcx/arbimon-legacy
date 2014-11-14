angular.module('a2browser_recordings_by_site', [])
.service('a2PlaylistLOVO', function($q, a2Playlists){
    var lovo = function(playlist){
        this.playlist = playlist;

        this.offset = 0;
        this.count  = 0;
        this.list   = [];
    }
    lovo.prototype = {
        initialize: function(){
            var d = $q.defer();
            if(this.initialized){
                d.resolve(true);
            } else {
                a2Playlists.getData(this.playlist.id, {show:'thumbnail-path'}, (function(recordings){
                    this.list = recordings;
                    this.count  = recordings.length;
                    d.resolve(false);
                }).bind(this))
            }
            return d.promise;
        },
        find : function(recording){
            var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
            d.resolve(this.list.filter(function(r){
                return r.id == id;
            }).shift());
            return d.promise;
        },
        previous : function(recording){
            var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
            Project.getPreviousRecording(id, d.resolve);
            return d.promise;
        },
        next : function(recording){
            var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
            Project.getNextRecording(id, d.resolve);
            return d.promise;
        }
    }
    return lovo;
})
.controller('a2BrowserRecordingsByPlaylistController', function($scope, itemSelection, a2RecordingsBrowser, rbDateAvailabilityCache, a2Playlists, $timeout, $q, a2PlaylistLOVO){
    var self = this;
    this.playlists = [];
    this.active=false;
    this.loading = {
        playlists : false
    };
    this.playlist = null;
    this.lovo = null;
    this.auto = {};
    this.activate = function(){
        var defer = $q.defer();
        self.loading.playlists = true;
        a2Playlists.getList(function(playlists){
            self.playlists = playlists;
            self.loading.playlists = false;
            $timeout(function(){
                this.active=true;
                defer.resolve(playlists);
                if(self.resolve.pld){
                    self.resolve.pld.resolve(playlists);
                    delete self.resolve.pld;
                }
            });
        });
        return defer.promise;
    }
    this.resolve={};

    this.resolve_location = function(location){
        var m = /(\d+)(\/(\d+))?/.exec(location);
        var defer = $q.defer();
        if(m){
            var plid = m[1]|0, recid=m[3]|0;
            var pld = $q.defer();
            if(self.loading.playlists){
                self.resolve = { pld : pld };
            } else {
                pld.resolve(self.playlists);
            }
            pld.promise.then(function(playlists){
                var playlist = self.playlists.filter(function(playlist){
                    return playlist.id == plid;
                }).shift();
                if(playlist){
                    self.playlist = playlist;
                    self.lovo = new a2PlaylistLOVO(playlist);
                    self.lovo.initialize().then(function(){
                        return self.lovo.find(recid)
                    }).then(function(recording){
                        defer.resolve(recording);
                    });
                } else {
                    defer.resolve();
                }
            });
        } else {
            defer.resolve();
        }
        return defer.promise;
    }
    this.get_location = function(recording){
        return 'playlist/' + this.lovo.playlist.id + "/" + recording.id;
    }

    $scope.$watch('browser.$type.playlist', function(playlist){
        if(playlist && (self.lovo ? self.lovo.playlist != playlist : true)){
            self.lovo = new a2PlaylistLOVO(playlist);
        }
        a2RecordingsBrowser.setLOVO(self.lovo);
    });
})
