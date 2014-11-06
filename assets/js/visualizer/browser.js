angular.module('a2recordingsbrowser', ['a2utils', 'ui.bt.datepicker2'])
.factory('rbDateAvailabilityCache', function ($cacheFactory) {
    return $cacheFactory('recordingsBrowserDateAvailabilityCache');
})
.directive('a2RecordingsBrowser', function ($timeout, itemSelection, Project, rbDateAvailabilityCache) {
    var project = Project;
    return {
        restrict : 'E',
        scope : {
            onRecording : '&onRecording'
        },
        templateUrl : '/partials/visualizer/browser/main.html',
        link     : function($scope, $element, $attrs){
            var browser = $scope.browser = {
                sites : [],
                dates : {
                    refreshing  : false,
                    max_date: null,
                    min_date: null,
                    display_year:null,
                    date_counts:[],
                    datepickerMode : 'year',
                    cache : rbDateAvailabilityCache,
                    get_counts_for : function(year){
                        var site = browser.selection.site.value;
                        var site_name = site && site.name;
                        if(!site_name) {
                            return true;
                        }

                        var key = [site_name, year, '[1:12]'].join('-');

                        var availability = browser.dates.cache.get(key);
                        if(!availability) {
                            browser.dates.fetch_counts(key);
                        } else if(availability.data){
                            browser.dates.date_counts = availability.data;
                        }
                    },
                    fetch_counts: function(key){
                        browser.dates.cache.put(key, {fetching:true});
                        browser.loading.dates = true;
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
                                
                                browser.dates.cache.get(key).data = avail || {};
                                browser.dates.date_counts = avail;
                                browser.loading.dates = false;
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
                                browser.dates.min_date = new Date(range.min,  0,  1,  0,  0,  0,   0);
                                browser.dates.max_date = new Date(range.max, 11, 31, 23, 59, 59, 999);
                                
                                browser.loading.dates = false;
                                callback(range);
                            });
                        })
                    },
                    fetching  : false,
                    available : {}
                },
                recordings : [],
                loading : {
                    sites: false,
                    dates: false,
                    times: false
                },
                selection : {
                    site : itemSelection.make(),
                    date : null,
                    recording : itemSelection.make()
                }
            };
            var perform_auto_select = function(){
                var auto_select = browser.selection.auto && browser.selection.auto.recording;
                if(auto_select) {
                    browser.selection.auto.recording = null;
                    var found = browser.recordings.filter(function(r){return r.id == auto_select.id;}).pop();
                    if (found) {
                        browser.selection.recording.select(found);
                    } else {
                        console.error("Could not find auto-selected recording in list.");
                    }
                }
            }
            var load_project_sites = function(cb){
                browser.loading.sites = true;
                project.getSites(function(sites){
                    browser.sites = sites;
                    browser.loading.sites = false;
                    if(cb instanceof Function){
                        $timeout(cb);
                    }
                });       
            }            
            
            
            $scope.$on('a2-persisted', load_project_sites);
            
            $scope.$watch('browser.dates.display_year', function(new_display_year){
                browser.dates.get_counts_for(new_display_year);
            });

            $scope.$watch('browser.selection.site.value', function(newValue, oldValue){
                browser.recordings = [];
                // reset the selections and stuff
                browser.selection.date = null;
                browser.selection.recording.value = null;
                // setup auto-selection
                var auto_select = browser.selection.auto && browser.selection.auto.date;
                if(auto_select) {
                    browser.selection.auto.date = null;
                    browser.selection.date = auto_select;
                }
                // reset date picker year range and counts
                browser.dates.fetch_year_range(newValue, function(year_range){
                    $timeout(function(){
                        browser.dates.display_year = year_range.max;
                        browser.dates.get_counts_for(browser.dates.display_year);
                    });
                });
            });
            $scope.$watch('browser.selection.date', function(newValue, oldValue){
                $(document).find('.dropdown.open').removeClass('open');
                browser.selection.time = null;
                var site = browser.selection.site.value;
                var date = browser.selection.date;
                if (site && date) {
                    if(newValue && oldValue && newValue.getTime() == oldValue.getTime()){
                        perform_auto_select();
                        return
                    }
                    var comps = [site.name, date.getFullYear(), date.getMonth() + 1, date.getDate()];
                    var key = comps.join('-');
                    browser.loading.times = true;
                    Project.getRecordings(key, {show:'thumbnail-path'},function(recordings){
                        $timeout(function(){
                            browser.recordings = recordings;
                            browser.loading.times = false;
                            perform_auto_select();
                        });
                    })
                }
            });
            $scope.$watch('browser.selection.recording.value', function(newValue, oldValue){
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
                    var utcdateaslocal = new Date(recording.datetime);
                    var recdate = new Date(utcdateaslocal.getTime() + utcdateaslocal.getTimezoneOffset()*60*1000);
                    browser.selection.auto = {
                        hash : recording.file,
                        site : browser.sites.filter(function(s){return s.name == recording.site;}).pop(),
                        date : new Date(recdate.getFullYear(), recdate.getMonth(), recdate.getDate(), 0, 0, 0, 0),
                        recording : browser.recordings.filter(function(r){return r.id == recording.id;}).pop() || recording
                    }
                    if(browser.selection.site.value != browser.selection.auto.site) {
                        browser.selection.site.select(browser.selection.auto.site);
                    } else if (browser.selection.date != browser.selection.auto.date) {
                        browser.selection.date = browser.selection.auto.date
                    } else {
                        browser.selection.recording.select(browser.selection.auto.recording);
                    }
                }
            };
            $scope.$on('prev-recording', function(){
                if(browser.selection.recording.value) {
                    Project.getPreviousRecording(browser.selection.recording.value.id, $scope.selectRecording);
                }
            });
            $scope.$on('next-recording', function(){
                if(browser.selection.recording.value) {
                    Project.getNextRecording(browser.selection.recording.value.id, $scope.selectRecording);
                }
            });
            $scope.$on('select-recording',function(evt, recording_path){
                //console.log('select recording event : ', recording_path);
                Project.getOneRecording(recording_path, function(recording){
                    //console.log('selecting recording : ', recording);
                    $scope.selectRecording(recording);
                })
            });
            $element.on('click', function(e){
                var $e=$(e.target), $dm = $e.closest('.dropdown-menu.datepicker, [aria-labelledby^=datepicker]');
                if($dm.length > 0) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            })
            
            load_project_sites(function(){
                $scope.$emit('browser-available');
            });
            
        }
    };
});
