angular.module('a2recordingsbrowser', ['a2utils', 'ui.bt.datepicker2'])
.service('browser_playlists', function(){
    var g=[], i={}, plists = {$grouping : g};
    ([
        {   name       : 'recordings-by-site',
            icon       : 'fa fa-map-marker',
            tooltip    : 'Browse Recordings by Site',
            controller : 'a2BrowserRecordingsBySiteController',
            template   : '/partials/visualizer/browser/recordings-by-site.html'
        }, 
        {   name     : 'recordings-by-playlist',
            icon     : 'fa fa-list',
            tooltip  : "Browse Recordings by Playlist",
            template : ''
        }
    ]).forEach(function(type){
        var group = type.name.split('-')[0];
        i[group] || g.push(i[group] = []);
        i[group].push(plists[type.name] = type);
    });
    
    return plists;
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
.controller('a2BrowserController', function($scope, $element, $attrs, $timeout, $controller, browser_playlists, itemSelection, Project){
    var self = $scope.browser = this;
    var project = Project;
    
    this.types = browser_playlists.$grouping;
    this.type  = browser_playlists['recordings-by-site'];
    this.recordings = [];
    this.loading = {
        sites: false,
        dates: false,
        times: false
    };
    this.auto={};
    this.recording = null;
    this.playlist  = null;
    var perform_auto_select = function(){
        var auto_select = self.auto && self.auto.recording;
        if(auto_select) {
            self.auto.recording = null;
            var found = self.recordings.filter(function(r){return r.id == auto_select.id;}).pop();
            if (found) {
                self.recording = found;
            } else {
                console.error("Could not find auto-selected recording in list.");
            }
        }
    }
    var initialized = false;
    var activate = function(){
        if(self.$type && self.$type.activate){
            self.$type.activate().then(initialized ? undefined : function(){
                initialized = true;
                $scope.$emit('browser-available');
            });
        }

    }
    
    this.setPlaylist = function(playlist){
        self.playlist = playlist;
        if(playlist && self.auto.recording){
            playlist.find(self.auto.recording).then(function(recording){
                self.recording = recording;
            });            
        }
    }

    // ng-controller="a2BrowserRecordingsBySiteController"
    
    $scope.$on('a2-persisted', activate);
    
    $scope.$watch('browser.type', function(new_type, old_type){
        if(old_type && old_type.$controller && old_type.$controller.deactivate){
            old_type.$controller.deactivate();
        }
        if(new_type && new_type.controller){
            if(!new_type.$controller){
                new_type.$controller = $controller(new_type.controller, {
                    $scope : $scope, 
                    a2RecordingsBrowser : self
                });
            }
            self.$type = new_type.$controller;
            activate();
        }        
    });

    $scope.$watch('browser.recording', function(newValue, oldValue){
        $scope.onRecording({recording:newValue});
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
            self.auto = {
                recording : self.recordings.filter(function(r){return r.id == recording.id;}).pop() || recording
            }
            
            if(self.$type.auto_select){
                self.$type.auto_select(recording);
            }
        }
    };
    $scope.$on('prev-recording', function(){
        if(self.recording && self.playlist) {
            self.playlist.previous(self.recording.id).then($scope.selectRecording);
        }
    });
    $scope.$on('next-recording', function(){
        if(self.recording) {
            self.playlist.next(self.recording.id).then($scope.selectRecording);
        }
    });
    $scope.$on('select-recording',function(evt, recording_path){
        Project.getOneRecording(recording_path, function(recording){
            $scope.selectRecording(recording);
        })
    });
    
    activate();
    
})
.service('playlist_RecordingsBySite', function($q, Project){
    var playlist_RecordingsBySite = function(site, date, recordings){        
        this.site = site;
        this.date = date;
        
        this.offset = 0;
        this.count  = recordings.length;
        this.list   = recordings;
    }
    playlist_RecordingsBySite.prototype.find = function(recording){
        var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
        d.resolve(this.list.filter(function(r){
            return r.id == id;
        }).shift());
        return d.promise;
    }
    playlist_RecordingsBySite.prototype.previous = function(recording){
        var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
        Project.getPreviousRecording(id, d.resolve);
        return d.promise;
    }
    playlist_RecordingsBySite.prototype.next = function(recording){
        var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
        Project.getNextRecording(id, d.resolve);
        return d.promise;
    }
    return playlist_RecordingsBySite;
})
.controller('a2BrowserRecordingsBySiteController', function($scope, itemSelection, a2RecordingsBrowser, rbDateAvailabilityCache, Project, $timeout, $q, playlist_RecordingsBySite){
    var project = Project;
    var self = this;
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
            var site = self.selection.site.value;
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
    this.selection = {
        site : itemSelection.make(),
        date : null
    };
    
    var load_project_sites = function(){
        var defer = $q.defer();
        self.loading.sites = true;
        project.getSites(function(sites){
            self.sites = sites;
            self.loading.sites = false;
            $timeout(function(){
                defer.resolve(sites)
            });
        });      
        return defer.promise;
    }
    
    
    this.activate = function(){
        return load_project_sites();
    }
    this.auto_select = function(recording){
        if(recording) {
            var utcdateaslocal = new Date(recording.datetime);
            var recdate = new Date(utcdateaslocal.getTime() + utcdateaslocal.getTimezoneOffset()*60*1000);
            
            self.selection.auto = {
                site  : self.sites.filter(function(s){return s.name == recording.site;}).pop(),
                date  : new Date(recdate.getFullYear(), recdate.getMonth(), recdate.getDate(), 0, 0, 0, 0)
            }
            
            if(self.selection.site.value != self.selection.auto.site) {
                self.selection.site.select(self.selection.auto.site);
            } else if (self.selection.date != self.selection.auto.date) {
                self.selection.date = self.selection.auto.date
            } else {
                set_playlist();
            }
        }
    };
    
    var set_playlist = function(recordings){
        if(recordings){
            self.selection.playlist = new playlist_RecordingsBySite(self.selection.site.value, self.selection.date, recordings);
        }
        a2RecordingsBrowser.setPlaylist(self.selection.playlist);
    }
    
    $scope.$on('a2-persisted', load_project_sites);
    
    $scope.$watch('browser.$type.dates.display_year', function(new_display_year){
        self.dates.get_counts_for(new_display_year);
    });

    $scope.$watch('browser.$type.selection.site.value', function(newValue, oldValue){
        self.recordings = [];
        // reset the selections and stuff
        self.selection.date = null;
        a2RecordingsBrowser.recording = null;
        // setup auto-selection
        var auto_select = self.selection.auto && self.selection.auto.date;
        if(auto_select) {
            self.selection.auto.date = null;
            self.selection.date = auto_select;
        }
        // reset date picker year range and counts
        self.dates.fetch_year_range(newValue, function(year_range){
            $timeout(function(){
                self.dates.display_year = year_range.max;
                self.dates.get_counts_for(self.dates.display_year);
            });
        });
    });
    $scope.$watch('browser.$type.selection.date', function(newValue, oldValue){
        $(document).find('.dropdown.open').removeClass('open');
        self.selection.time = null;
        var site = self.selection.site.value;
        var date = self.selection.date;
        if (site && date) {
            if(newValue && oldValue && newValue.getTime() == oldValue.getTime()){
                set_playlist();
                return
            }
            var comps = [site.name, date.getFullYear(), date.getMonth() + 1, date.getDate()];
            var key = comps.join('-');
            self.loading.times = true;
            Project.getRecordings(key, {show:'thumbnail-path'},function(recordings){
                $timeout(function(){
                    self.loading.times = false;
                    set_playlist(recordings);
                });
            })
        }
    });
})
;
