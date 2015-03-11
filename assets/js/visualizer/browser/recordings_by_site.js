angular.module('a2browser_recordings_by_site', [])
.factory('rbDateAvailabilityCache', function ($cacheFactory) {
    return $cacheFactory('recordingsBrowserDateAvailabilityCache');
})
.service('a2RecordingsBySiteLOVO', function($q, Project, $filter){
    var lovo = function(site, date){
        this.initialized = false;
        this.site = site;
        this.date = date;
        this.object_type = "recording";
        this.offset = 0;
        this.order  = 'datetime';
        this.count  = 0;
        this.list   = [];
    };
    lovo.prototype = {
        initialize: function(){
            var d = $q.defer();
            if(this.initialized){
                d.resolve(true);
            } else {
                var site=this.site, date=this.date;
                var key = [site.name, date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
                Project.getRecordings(key, {show:'thumbnail-path'},(function(recordings){
                    recordings = $filter('orderBy')(recordings, 'datetime');
                    recordings.forEach(function(recording){
                        recording.caption = [recording.site, moment(recording.datetime).utc().format('lll')].join(', ');
                    });
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
    };
    this.deactivate = function(){
        var defer = $q.defer();
        defer.resolve();
        self.active = false;
        return defer.promise;
    };
    this.auto_select = function(recording){
        if(recording) {
            var utcdateaslocal = new Date(recording.datetime);
            var recdate = new Date(utcdateaslocal.getTime() + utcdateaslocal.getTimezoneOffset()*60*1000);

            self.auto = {
                site  : self.sites.filter(function(s){return s.name == recording.site;}).pop(),
                date  : new Date(recdate.getFullYear(), recdate.getMonth(), recdate.getDate(), 0, 0, 0, 0)
            };

            if(self.site != self.auto.site) {
                self.site = self.auto.site;
            } else if (self.date != self.auto.date) {
                self.date = self.auto.date;
            } else {
                a2Browser.setLOVO(make_lovo());
            }
        }
    };

    this.resolve_location = function(location){
        var defer = $q.defer();
        Project.getOneRecording(location, function(recording){
            defer.resolve(recording);
        });
        return defer.promise;
    };
    this.get_location = function(recording){
        return 'rec/' + recording.id;
    };

    var make_lovo = function(){
        var site = self.site;
        var date = self.date;
        if(site && date){
            self.lovo = new a2RecordingsBySiteLOVO(site, date);
        }
        return self.lovo;
    };

    $scope.$watch('browser.$type.dates.display_year', function(new_display_year){
        if(!self.active){ return; }
        self.dates.get_counts_for(new_display_year);
    });

    $scope.$watch('browser.$type.site', function(newValue, oldValue){
        if(!self.active){ return; }
        self.recordings = [];
        // reset the selections and stuff
        self.date = null;
        a2Browser.recording = null;
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
                a2Browser.setLOVO(self.lovo);
                return;
            } else {
                a2Browser.setLOVO(make_lovo());
            }
        }
    });
});
