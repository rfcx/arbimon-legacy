angular.module('a2.browser_recordings_by_playlist', [
    'a2.classy',
    'a2.browser_common',
])
.config(function(BrowserLOVOsProvider){
    BrowserLOVOsProvider.add({
        name       : 'playlist',
        group       : 'recordings',
        vobject_type: 'recording',
        icon       : 'fa fa-list',
        tooltip    : "Browse Recordings by Playlist",
        controller : 'a2BrowserRecordingsByPlaylistController',
        template   : '/app/visualizer/browser/recordings/by-playlist/recordings-by-playlist.html'
    });
})
.service('a2PlaylistLOVO', function($q, makeClass, a2Playlists, a2Pager, $state, $localStorage, Project){
    return makeClass({
        static: {
            PageSize : 10,
            BlockSize: 7
        },
        constructor : function(playlist){
            this.loading = false;
            this.playlist = playlist;
            this.object_type = "recording";
            this.offset = 0;
            this.count  = 0;
            this.list   = [];
            this.whole_list = [];
            var self = this;
            this.paging = new a2Pager({
                item_count: playlist.count,
                page_size : this.constructor.PageSize,
                block_size: this.constructor.BlockSize,
                block_tracks_page : true,
                on_page   : function(e){
                    return self.load_page(e.offset, e.count);
                }
            });
        },
        initialize: function(){
            var self = this, d = $q.defer();
            if(this.initialized){
                d.resolve(true);
            } else {
                this.paging.set_page(0).then(function(){
                    d.resolve(false);
                });
            }
            if (self.playlist && self.playlist.id === 0) {
                d.resolve(true);
                return d.promise;
            };
            return d.promise.then(function(){
                a2Playlists.getInfo(self.playlist.id, function(playlist_info){
                    self.playlist = playlist_info;
                });
            }).then(function(){
                if(self.whole_list){
                    self.whole_list.forEach(self.append_extras.bind(self));
                }
            });
        },
        load_page: function(offset, count){
            var self = this, d = $q.defer();
            var opts = {
                offset : offset,
                limit  : count,
                show:'thumbnail-path'
            };
            // get recordings data for temporary clusters playlist
            if ($state.params.clusters) {
                var clustersData = JSON.parse($localStorage.getItem('analysis.clusters'));
                if (clustersData && clustersData.playlist && clustersData.playlist.recordings) {
                    opts.recordings = clustersData.playlist.recordings.filter((id, i, a) => {
                        return (i >= opts.offset) && (i < opts.offset + opts.limit)
                    })
                    self.count  = clustersData.playlist.recordings.length;
                }
            };
            self.loading = true;
            Project.getInfo(function(info){
                return this.isDisabled = info.disabled === 1
            })
            a2Playlists.getData(self.playlist.id, opts, function(recordings){
                self.list = recordings;
                recordings.forEach(function(recording){
                    recording.isDisabled = this.isDisabled
                    recording.caption = [recording.site, moment.utc(recording.datetime).format('lll')].join(', ');
                    recording.vaxis = {
                        font:'7px', color:'#333333',
                        range:[0, recording.sample_rate/2000],
                        count:5,
                        unit:''
                    };
                    self.append_extras(recording);
                });
                self.loading = false;
                d.resolve(recordings);
            });
            return d.promise;
        },
        append_extras: function(recording){
            if(recording){
                recording.extra = {
                    playlist : this.playlist
                };
            }
            return recording;
        },
        find_local : function(recording){
            var self = this;
            var id = (recording && recording.id) || (recording | 0);
            // console.log(":: find : ", id);
            return $q.resolve(this.append_extras(this.list && this.list.filter(function(r){
                // if(r.id == id){
                    // console.log("     :: found", r.id, r);
                // }
                return r.id == id;
            }).shift()));
        },
        find : function(recording){
            var self = this;
            var d = $q.defer();
            var id = (recording && recording.id) || (recording | 0);

            self.find_local(recording)
                .then(function(found_rec){
                    if(found_rec){
                        d.resolve(found_rec);
                    } else {
                        a2Playlists.getRecordingPosition(self.playlist.id, id)
                            .then(function(response){
                                return self.paging.set_page(self.paging.page_for(response.data));
                            })
                            .then(function(recordings){
                                return self.find_local(recording);
                            })
                            .then(function(found_rec){
                                d.resolve(found_rec);
                            })
                        ;
                    }
                });

            return d.promise;
        },
        previous : function(recording){
            var self = this;
            var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
            a2Playlists.getPreviousRecording(this.playlist.id, id, function(r){
                d.resolve(self.append_extras(r));
            });
            return d.promise;
        },
        next : function(recording){
            var self = this;
            var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
            a2Playlists.getNextRecording(this.playlist.id, id, function(r){
                d.resolve(self.append_extras(r));
            });
            return d.promise;
        }
    });
})
.factory('a2Pager', function(makeClass){
    return makeClass({
        constructor: function(options){
            this.block_size = 10;
            this.last_page  = 0;
            this.set_options(options);
        },
        resolve_value : function(value, current, first, last){
            switch(value){
                case 'first'    : value = first      ; break;
                case 'previous' : value = current - 1; break;
                case 'next'     : value = current + 1; break;
                case 'last'     : value = last       ; break;
            }
            return Math.max(first, Math.min(+value, last));
        },
        set_options : function(options){
            if(options.item_count           ){ this.item_count       = options.item_count      ; }
            if(options.page_size            ){ this.page_size        = options.page_size       ; }
            if(options.block_size           ){ this.block_size       = options.block_size      ; }
            if(options.last_page            ){ this.last_page        = options.last_page       ; }
            if(options.block_tracks_page !== undefined){ this.block_tracks_page       = !!options.block_tracks_page; }
            if(options.on_page !== undefined){ this.on_page          = options.on_page ; }
            this.update();
        },
        page_for : function(item){
            var page = (item / this.page_size)|0;
            console.log("page_for(%s) :: %s", item, page);
            return page;
        },
        set_page : function(page){
            this.current_page = this.resolve_value(page, this.current_page, 0, this.last_page)|0;
            this.is_at_first_page = this.current_page === 0;
            this.is_at_last_page  = this.current_page === this.last_page;

            if(this.block_tracks_page){
                this.show_block((this.current_page - this.block_size/2 + (this.block_size%2)) / this.block_size);
            } else {
                this.show_block(this.current_page / this.block_size);
            }

            if(this.on_page instanceof Function){
                var offset = this.current_page*this.page_size;
                return this.on_page({
                    page   : this.current_page,
                    offset : offset,
                    count  : Math.min(this.page_size, this.item_count - offset + 1)
                });
            }

        },
        update : function(){
            this.is_at_first_page = this.current_page <= 0;
            this.last_page        = ((this.item_count-1) / this.page_size) | 0;
            this.last_page_block  = (this.last_page / this.block_size) | 0;
            this.is_at_last_page  = this.current_page >= this.last_page;
            this.show_block(this.block);
        },
        show_block : function(block){
            if(this.block_tracks_page){
                this.current_page_block = this.resolve_value(block, this.current_page_block, 0, this.last_page_block);
            } else {
                this.current_page_block = this.resolve_value(block, this.current_page_block, 0, this.last_page_block) | 0;
            }
            this.is_at_first_page_block = this.current_page_block <= 0;
            this.is_at_last_page_block  = this.current_page_block >= this.last_page_block;

            this.current_page_block_first_page = (this.current_page_block * this.block_size)|0;
            this.current_page_block_last_page  = Math.min(((this.current_page_block+1) * this.block_size - 1)|0, this.last_page);
            this.block = [];
            for(var i=this.current_page_block_first_page, e=this.current_page_block_last_page; i <= e; ++i){
                this.block.push(i);
            }
        },
        has_page : function(page){
            return 0 <= page && page <= this.last_page;
        }
    });
})
.controller('a2BrowserRecordingsByPlaylistController', function($scope, a2Browser, a2Playlists, $q, a2PlaylistLOVO, $state, $localStorage){
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
        self.loading.playlists = true;
        this.getPlaylists = a2Playlists.getList().then(function(playlists){
            // add temporary clusters playlist to playlists' array
            if ($state.params.clusters) {
                var clustersData = JSON.parse($localStorage.getItem('analysis.clusters'));
                if (clustersData && clustersData.playlist) {
                    playlists.push(clustersData.playlist);
                }
            }
            self.playlists = playlists;
            self.loading.playlists = false;
        }).then(function(){
            self.active=true;
            if(self.resolve.pld){
                self.resolve.pld.resolve(playlists);
                delete self.resolve.pld;
            }
        }).then(function(){
            return self.playlists;
        });
        return this.getPlaylists;
    };
    this.deactivate = function(){
        self.active = false;
    };
    this.resolve={};

    this.resolve_link = function(link){
        if(link.location){
            a2Browser.set_location(link.location);
        }
    };

    this.resolve_location = function(location){
        var m = /(\d+)(\/(\d+))?/.exec(location);
        return (m) ? $q.resolve().then(function(){
            var plid = m[1]|0, recid=m[3]|0;
            return self.getPlaylists.then(function(playlists){
                var playlist = self.playlists.filter(function(playlist){
                    return playlist.id == plid;
                }).shift();

                if(playlist){
                    self.playlist = playlist;
                    self.lovo = new a2PlaylistLOVO(playlist);
                    return self.lovo.initialize().then(function(){
                        return a2Browser.setLOVO(self.lovo);
                    }).then(function(){
                        return self.lovo.find(recid);
                    }).then(function(recording){
                        return recording;
                    });
                }
            });
        }) : $q.resolve();
    };
    this.get_location = function(recording){
        return 'playlist/' + (this.lovo ? this.lovo.playlist.id + (recording ? "/" + recording.id : '') : '');
    };

    this.set_playlist = function(playlist){
        this.playlist = playlist;
        if(!self.active){
            return;
        }
        if (self.lovo && self.lovo.playlist.id != playlist.id) {
            $scope.removeFromLocalStorage();
        }
        if(playlist && (self.lovo ? self.lovo.playlist != playlist : true)){
            self.lovo = new a2PlaylistLOVO(playlist);
        }
        a2Browser.setLOVO(self.lovo, self.lovo ? "playlist/"+self.lovo.playlist.id : '');
    };

    $scope.removeFromLocalStorage = function () {
        $localStorage.setItem('analysis.clusters', null);
        $localStorage.setItem('analysis.clusters.playlist', null);
        $state.params.clusters = '';
    }
});
