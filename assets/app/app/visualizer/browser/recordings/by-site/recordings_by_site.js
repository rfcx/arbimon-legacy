angular.module('a2.browser_recordings_by_site', [
    'a2.browser_common'
])
.config(function(BrowserLOVOsProvider){
    BrowserLOVOsProvider.add({
        name       : 'rec',
        group       : 'recordings',
        vobject_type: 'recording',
        default    : true,
        icon       : 'fa fa-map-marker',
        tooltip    : 'Browse Recordings by Site',
        controller : 'a2BrowserRecordingsBySiteController',
        template   : '/app/visualizer/browser/recordings/by-site/recordings-by-site.html'
    });
})
.factory('rbDateAvailabilityCache', function ($cacheFactory) {
    return $cacheFactory('recordingsBrowserDateAvailabilityCache');
})
.service('a2RecordingsBySiteLOVO', function($q, Project, $filter){
    var lovo = function(site, date, limit, offset, recording_id){
        this.loading = false;
        this.initialized = false;
        this.site = site;
        this.date = date;
        this.object_type = "recording";
        this.recordingsBySite = true;
        this.offset = offset || 0;
        this.limit = limit;
        this.order = 'datetime';
        this.count = 0;
        this.list = [];
        this.page = 0;
        this.recording_id = recording_id;
        this.finished = false;
    };
    lovo.prototype = {
        initialize: function() {
            var d = $q.defer();
            if(this.initialized) {
                d.resolve(true);
            } else {
                return this.loadNext()
            }
            return d.promise;
        },
        updateRecording: function(recording_id) {
            this.recording_id = recording_id;
        },
        getRecordings : function(limit, offset, recording_id) {
            var d = $q.defer();
            this.limit = limit, this.offset = offset;
            var site=this.site, date=this.date;
            var key = ['!q:'+site.id, date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
            var opts = {
                show:'thumbnail-path'
            };
            if (recording_id === undefined) {
                opts.limit = limit;
                opts.offset = offset;
            };
            if (recording_id !== undefined) {
                opts.recording_id = recording_id;
            };
            this.loading = true;
            Project.getRecordings(key, opts,(function(recordings){
                recordings = $filter('orderBy')(recordings, 'datetime');
                recordings.forEach(function(recording) {
                    recording.caption = [recording.site, moment.utc(recording.datetime).format('lll')].join(', ');
                    recording.vaxis = {
                        font:'7px', color:'#333333',
                        range:[0, recording.sample_rate/2000],
                        count:5,
                        unit:''
                    };
                });
                if (recordings && recordings.length) {
                    // not use infinite-scroll functionality for navigating recording
                    if (recording_id) {
                        if (angular.equals(this.list, recordings)) {
                            this.finished = true;
                        };
                        this.list = [];
                        this.list = recordings;
                    } else {
                        this.list.push.apply(this.list, recordings)
                        this.page++
                    }
                }
                else {
                    this.finished = true;
                }
                this.count += recordings.length;
                this.loading = false;
                d.resolve(false);
            }).bind(this));
            return d.promise;
        },
        loadNext: function () {
            if (this.finished) {
                return $q.defer().resolve(false);
            }
            return this.getRecordings(this.limit, this.page * this.limit, this.recording_id);
        },
        find : function(recording){
            var d = $q.defer(), id = (recording && recording.id) || (recording | 0);
            d.resolve(this.list.filter(function(r){
                return r.id == id;
            }).shift());
            return d.promise;
        },
        previous : function(recording){
            console.log("previous : function(recording){ :: ", recording);
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
.controller('a2BrowserRecordingsBySiteController', function($scope, a2Browser, rbDateAvailabilityCache, Project, $timeout, $q, a2RecordingsBySiteLOVO){
    var project = Project;
    var self = this;
    $scope.siteInfo = {};
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
            var site_id = site && site.id;
            if(!site_id) {
                return true;
            }

            var key = ['!q:'+site_id, year, '[1:12]'].join('-');

            var availability = self.dates.cache.get(key);
            if(!availability) {
                self.dates.fetch_counts(key);
            }
            else if(availability.data){
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
                                }
                            }
                        }
                    }

                    self.dates.cache.get(key).data = avail || {};
                    self.dates.date_counts = avail;
                    self.loading.dates = false;
                });
            });
        },
        fetch_year_range : function(site, callback){
            var site_id = site && site.id;
            if(!site_id) {
                return;
            }
            Project.getRecordingAvailability('!q:'+site_id, function(data){
                $timeout(function(){
                    var range={max:-1/0, min:1/0, count:0};
                    for(var site in data){
                        var site_years = data[site];
                        for(var year in site_years){
                            range.count++;
                            range.min = Math.min(year, range.min);
                            range.max = Math.max(year, range.max);
                        }
                    }
                    if(!range.count){
                        range.max = range.min = new Date().getFullYear();
                    }
                    self.dates.min_date = new Date(range.min,  0,  1,  0,  0,  0,   0);
                    self.dates.max_date = new Date(range.max, 11, 31, 23, 59, 59, 999);

                    self.loading.dates = false;
                    callback(range);
                });
            });
        },
        fetching  : false,
        available : {}
    };
    this.loading = {
        sites : false,
        dates : false,
        records: false
    };
    this.auto={};
    this.site = null;
    this.date = null;
    this.lovo = null;
    $scope.limit = 10;

    this.activate = function(){
        var defer = $q.defer();
        self.loading.sites = true;
        project.getSites({ count: true, logs: true }, function(sites){
            self.sites = sites;
            self.loading.sites = false;
            $timeout(function(){
                self.active = true;
                defer.resolve(sites);
            });
        });
        return defer.promise;
    };
    this.deactivate = function(){
        var defer = $q.defer();
        defer.resolve();
        self.active = false;
        return defer.promise;
    };
    // Preselect of a site and a date from navigation URL
    this.auto_select = function(recording){
        if(recording) {
            var utcdateaslocal = new Date(recording.datetime);
            var recdate = new Date(utcdateaslocal.getTime() + utcdateaslocal.getTimezoneOffset()*60*1000);

            self.auto = {
                site  : self.sites.filter(function(s){return s.name == recording.site;}).pop(),
                date  : new Date(recdate.getFullYear(), recdate.getMonth(), recdate.getDate(), 0, 0, 0, 0)
            };

            if(self.site != self.auto.site) {
                self.set_site(self.auto.site);
            } else if (self.date != self.auto.date) {
                self.set_date(self.auto.date);
            } else {
                a2Browser.setLOVO(make_lovo());
            }
        }
    };

    this.resolve_location = function(location){
        var defer = $q.defer();
        if(location){
            var site_match = /^site(\/(\d+)(\/([^/]+))?)?/.exec(location);
            if(site_match){
                var site = site_match[2]|0, query=site_match[4];
                if(site){
                    var key = '!q:'+site+(query ? '-' + query : '');
                    Project.getRecordings(key, (function(recordings){
                        defer.resolve(recordings && recordings.pop());
                    }).bind(this));
                } else {
                    defer.resolve();
                }
            } else {
                Project.getOneRecording(location, function(recording){
                    defer.resolve(recording);
                });
            }
        } else {
            defer.resolve();
        }
        return defer.promise;
    };
    this.get_location = function(recording){
        return 'rec/' + recording.id;
    };

    var make_lovo = function() {
        var site = self.site;
        var date = self.date;
        if(site && date){
            // Create current browser state for the one recording in the list of recordings
            if ($scope.browser.currentRecording) {
                self.lovo = new a2RecordingsBySiteLOVO(site, date, null, null, Number($scope.browser.currentRecording));
            }
            else {
                self.lovo = new a2RecordingsBySiteLOVO(site, date, $scope.limit);
            }
        }
        return self.lovo;
    };

    $scope.onScroll = function($event, $controller){
        $scope.scrollElement = $controller.scrollElement;
        var scrollTop = $controller.scrollElement.scrollTop();
        var scrollHeight = $controller.scrollElement[0].scrollHeight;
        var elementHeight = $controller.scrollElement.height();
        var diff = scrollTop + elementHeight > scrollHeight * 0.9;
        if (diff) {
            if (!self.lovo) return;
            if (self.lovo && self.lovo.loading === true) return;
            if ($scope.browser.currentRecording && $scope.browser.annotations) return;
            if (self.lovo.list && self.lovo.list.length < 7) return;
            self.lovo.loadNext();
        }
    }

    this.set_dates_display_year = function(new_display_year){
        this.dates.display_year = new_display_year;
        if(!this.active){ return; }
        this.dates.get_counts_for(new_display_year);
    };

    this.set_site = function(newValue){
        this.site = $scope.siteInfo.site = newValue;
        if(!this.active){ return; }
        this.recordings = [];
        // reset the selections and stuff
        this.date = null;
        a2Browser.recording = null;
        // setup auto-selection
        var auto_select = this.auto && this.auto.date;
        if(auto_select) {
            this.auto.date = null;
            this.set_date(auto_select);
        }
        // reset date picker year range and counts
        this.dates.fetch_year_range(newValue, function(year_range){
            $timeout(function(){
                self.dates.display_year = year_range.max;
                self.dates.get_counts_for(self.dates.display_year);
            });
        });
    };

    this.set_date = function(date){
        if(!self.active){ return; }

        this.yearpickOpen = false;
        var site = this.site;
        this.date = $scope.siteInfo.date = date;
        if(site && date) {
            var isNewSiteAndDate = function() {
                return (
                    this.lovo &&
                    date &&
                    this.lovo.date &&
                    date.getTime() === this.lovo.date.getTime() &&
                    site.id === this.lovo.site.id
                );
            };

            if(isNewSiteAndDate()){
                a2Browser.setLOVO(self.lovo);
            }
            else {
                a2Browser.setLOVO(make_lovo()).then(function(){
                    $scope.browser.currentRecording = null;
                    $scope.browser.annotations = null;
                })
            }
        }

    };
});
