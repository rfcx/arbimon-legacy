angular.module('a2recordingsbrowser', ['a2utils', 'ui.bt.datepicker2'])
.service('browser_lovos', function(){
    var g=[], i={}, lovos = {$grouping : g};
    (lovos.$list = [
        {   name       : 'rec',
            default    : true,
            icon       : 'fa fa-map-marker',
            tooltip    : 'Browse Recordings by Site',
            controller : 'a2BrowserRecordingsBySiteController',
            template   : '/partials/visualizer/browser/recordings-by-site.html'
        }, 
        {   name     : 'playlist',
            icon     : 'fa fa-list',
            tooltip  : "Browse Recordings by Playlist",
            controller : 'a2BrowserRecordingsByPlaylistController',
            template   : '/partials/visualizer/browser/recordings-by-playlist.html'
        }
    ]).forEach(function(type){
        var group = type.name.split('-')[0];
        i[group] || g.push(i[group] = []);
        i[group].push(lovos[type.name] = type);
    });
    
    return lovos;
})
.factory('rbDateAvailabilityCache', function ($cacheFactory) {
    return $cacheFactory('recordingsBrowserDateAvailabilityCache');
})
.directive('a2RecordingsBrowser', function () {
    return {
        restrict : 'E',
        scope : {
            onRecording : '&onRecording'
        },
        templateUrl : '/partials/visualizer/browser/main.html',
        controller  : 'a2BrowserController'
    };
})
.controller('a2BrowserController', function($scope, $element, $attrs, $timeout, $controller, $q, browser_lovos, itemSelection, Project){
    var self = $scope.browser = this;
    var project = Project;
    
    this.types = browser_lovos.$grouping;
    this.type  = browser_lovos.$list.filter(function(lovo){return lovo.default;}).shift();
    this.recordings = [];
    this.loading = {
        sites: false,
        dates: false,
        times: false
    };
    this.auto={};
    this.recording = null;
    this.lovo  = null;
    var initialized = false;
    var activate = function(){
        if(self.$type && self.$type.activate){
            self.$type.activate().then(function(){
                if(!initialized){
                    initialized = true;
                    $scope.$emit('browser-available');
                } else if(self.$type.lovo){
                    self.setLOVO(self.$type.lovo);
                }
            });
        }

    }
    
    this.setLOVO = function(lovo){
        var old_lovo = self.lovo;
        self.lovo = lovo;
        if(lovo){
            lovo.initialize().then(function(){
                if(self.auto.recording){
                    lovo.find(self.auto.recording).then(function(recording){
                        self.recording = recording;
                    });
                }
            });
        }
    }

    // ng-controller="a2BrowserRecordingsBySiteController"
    
    $scope.$on('a2-persisted', activate);
    
    var setBrowserType = function(type){
        var new_$type, old_$type = self.$type;
        self.type = type;
        if(type && type.controller){
            if(!type.$controller){
                type.$controller = $controller(type.controller, {
                    $scope : $scope, 
                    a2RecordingsBrowser : self
                });
            }
            new_$type = self.$type = type.$controller;
        }

        var differ = new_$type !== old_$type;
        var d = $q.defer();
        d.resolve();
        return d.promise.then(function(){
            if(differ && old_$type && old_$type.deactivate){
                return old_$type.deactivate();
            }
        }).then(function(){
            if(differ && new_$type && new_$type.activate){
                activate();
            }
        });
    }
    
    $scope.$watch('browser.type', function(new_type){
        setBrowserType(new_type);
    });

    $scope.$watch('browser.recording', function(newValue, oldValue){
        var location = newValue && self.$type.get_location(newValue);
        $scope.onRecording({location:location, recording:newValue});
        $timeout(function(){
            var $e = $element.find('.recording-list-item.active');
            if($e.length) {
                var $p = $e.parent();
                var $eo = $e.offset(), $po = $p.offset(), $dt=$eo.top-$po.top;
                $p.animate({scrollTop:$p.scrollTop() + $dt});
            }
        });
    });
    $scope.selectRecording = function(recording){
        if(recording) {
            var d = $q.defer();
            d.resolve();
            d.promise.then(function(){
                return self.lovo && self.lovo.find(recording);
            }).then(function(r){
                return r || recording;
            }).then(function(r){
                self.auto = {
                    recording : r
                };
                if(self.$type.auto_select){
                    self.$type.auto_select(recording);
                }
            });
        }
    };
    $scope.$on('prev-recording', function(){
        if(self.recording && self.lovo) {
            self.lovo.previous(self.recording.id).then($scope.selectRecording);
        }
    });
    $scope.$on('next-recording', function(){
        if(self.recording && self.lovo) {
            self.lovo.next(self.recording.id).then($scope.selectRecording);
        }
    });
    $scope.$on('set-browser-location',function(evt, location){
        var m;
        if(m=/([\w+]+)(\/(.+))?/.exec(location)){
            if(browser_lovos[m[1]]){
                var loc = m[3];
                setBrowserType(browser_lovos[m[1]]).then(function(){
                    return self.$type.resolve_location(loc);
                }).then(function(recording){
                    if(recording){
                        $scope.selectRecording(recording);
                    }
                });
            }
        }
    });
    
    activate();
    
})
.service('a2RecordingsBySiteLOVO', function($q, Project){
    var lovo = function(site, date){        
        this.initialized = false;
        this.site = site;
        this.date = date;
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
                var site=this.site, date=this.date;
                var key = [site.name, date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
                Project.getRecordings(key, {show:'thumbnail-path'},(function(recordings){
                    this.list = recordings;
                    this.count = recordings.length;
                    d.resolve(false);
                }).bind(this));
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
    };
    return lovo;
})
.controller('a2BrowserRecordingsBySiteController', function($scope, a2RecordingsBrowser, rbDateAvailabilityCache, Project, $timeout, $q, a2RecordingsBySiteLOVO){
    var project = Project;
    var self = this;
    // var $scope = pscope.$new();
    this.sites = [];
    this.dates = {
        refreshing  : false,
        max_date: null,
        min_date: null,
        display_year:null,
        date_counts:[],
        datepickerMode : 'year',
        cache : rbDateAvailabilityCache,
        get_counts_for : function(year){
            var site = self.site;
            var site_name = site && site.name;
            if(!site_name) {
                return true;
            }

            var key = [site_name, year, '[1:12]'].join('-');

            var availability = self.dates.cache.get(key);
            if(!availability) {
                self.dates.fetch_counts(key);
            } else if(availability.data){
                self.dates.date_counts = availability.data;
            }
        },
        fetch_counts: function(key){
            self.dates.cache.put(key, {fetching:true});
            self.loading.dates = true;
            Project.getRecordingAvailability(key, function(data){
                $timeout(function(){
                    var avail = {};
                    for(var site in data){
                        var site_years = data[site];
                        for(var year in site_years){
                            var year_months = site_years[year];
                            for(var month in year_months){
                                var month_days = year_months[month];
                                for(var day in month_days){
                                    var akey = year + '-' + (month < 10 ? '0' : '' ) + month + '-' + (day < 10 ? '0' : '') + day;
                                    avail[akey] = (avail[akey] | 0) + month_days[day];
                                };
                            };
                        };
                    };
                    
                    self.dates.cache.get(key).data = avail || {};
                    self.dates.date_counts = avail;
                    self.loading.dates = false;
                });
            })
        },
        fetch_year_range : function(site, callback){
            var site_name = site && site.name;
            if(!site_name) {
                return;
            }
            Project.getRecordingAvailability(site_name, function(data){
                $timeout(function(){
                    var range={max:-1/0, min:1/0, count:0};
                    for(var site in data){
                        var site_years = data[site];
                        for(var year in site_years){
                            range.count++;
                            range.min = Math.min(year, range.min);
                            range.max = Math.max(year, range.max);
                        };
                    };
                    if(!range.count){
                        range.max = range.min = new Date().getFullYear();
                    }
                    self.dates.min_date = new Date(range.min,  0,  1,  0,  0,  0,   0);
                    self.dates.max_date = new Date(range.max, 11, 31, 23, 59, 59, 999);
                    
                    self.loading.dates = false;
                    callback(range);
                });
            })
        },
        fetching  : false,
        available : {}
    };
    this.loading = {
        sites : false,
        dates : false
    };
    this.auto={};
    this.site = null;
    this.date = null;
    this.lovo = null;
    
    this.activate = function(){
        var defer = $q.defer();
        self.loading.sites = true;
        project.getSites(function(sites){
            self.sites = sites;
            self.loading.sites = false;
            $timeout(function(){
                self.active = true;
                defer.resolve(sites);
            });
        });      
        return defer.promise;
    }
    this.deactivate = function(){
        var defer = $q.defer();
        defer.resolve();
        self.active = false;
        return defer.promise;
    }
    this.auto_select = function(recording){
        if(recording) {
            var utcdateaslocal = new Date(recording.datetime);
            var recdate = new Date(utcdateaslocal.getTime() + utcdateaslocal.getTimezoneOffset()*60*1000);
            
            self.auto = {
                site  : self.sites.filter(function(s){return s.name == recording.site;}).pop(),
                date  : new Date(recdate.getFullYear(), recdate.getMonth(), recdate.getDate(), 0, 0, 0, 0)
            }
            
            if(self.site != self.auto.site) {
                self.site = self.auto.site;
            } else if (self.date != self.auto.date) {
                self.date = self.auto.date
            } else {
                a2RecordingsBrowser.setLOVO(make_lovo());
            }
        }
    };

    this.resolve_location = function(location){
        var defer = $q.defer();
        Project.getOneRecording(location, function(recording){
            defer.resolve(recording);
        })
        return defer.promise;
    }
    this.get_location = function(recording){
        return 'rec/' + recording.id;
    }
    
    var make_lovo = function(){
        var site = self.site;
        var date = self.date;
        if(site && date){
            self.lovo = new a2RecordingsBySiteLOVO(site, date);
        }
        return self.lovo;
    }
    
    $scope.$watch('browser.$type.dates.display_year', function(new_display_year){
        if(!self.active){ return; }
        self.dates.get_counts_for(new_display_year);
    });

    $scope.$watch('browser.$type.site', function(newValue, oldValue){
        if(!self.active){ return; }
        self.recordings = [];
        // reset the selections and stuff
        self.date = null;
        a2RecordingsBrowser.recording = null;
        // setup auto-selection
        var auto_select = self.auto && self.auto.date;
        if(auto_select) {
            self.auto.date = null;
            self.date = auto_select;
        }
        // reset date picker year range and counts
        self.dates.fetch_year_range(newValue, function(year_range){
            $timeout(function(){
                self.dates.display_year = year_range.max;
                self.dates.get_counts_for(self.dates.display_year);
            });
        });
    });
    $scope.$watch('browser.$type.date', function(newValue, oldValue){
        if(!self.active){ return; }
        $(document).find('.dropdown.open').removeClass('open');
        var site = self.site;
        var date = self.date;
        if (site && date) {
            if(newValue && oldValue && newValue.getTime() == oldValue.getTime() && self.lovo){
                a2RecordingsBrowser.setLOVO(self.lovo);
                return
            } else {
                a2RecordingsBrowser.setLOVO(make_lovo());
            }
        }
    });
})
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
;
