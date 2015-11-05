angular.module('a2.audiodata.recordings', [
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'humane'
])
.controller('RecsCtrl', function($scope, Project, a2Classi, $http, $modal, notify, a2UserPermit, $window) {
    
    var readFilters = function() {
        $scope.message = '';
        var params = {};
        
        if($scope.params.range && $scope.params.range.from && $scope.params.range.to) {
            params.range = $scope.params.range;
            
            params.range.from.setUTCHours(0);
            params.range.from.setUTCMinutes(0);
            params.range.to.setUTCHours(23);
            params.range.to.setUTCMinutes(59);
        }
    
        var mapValue = function(x) { return x.value; };
        
        if($scope.params.sites && $scope.params.sites.length) {
            params.sites = $scope.params.sites.map(mapValue);
        }
        if($scope.params.hours && $scope.params.hours.length) {
            params.hours = $scope.params.hours.map(mapValue);
        }
        if($scope.params.months && $scope.params.months.length) {
            params.months = $scope.params.months.map(mapValue);
        }
        if($scope.params.years && $scope.params.years.length) {
            params.years = $scope.params.years.map(mapValue);
        }
        if($scope.params.days && $scope.params.days.length) {
            params.days = $scope.params.days.map(mapValue);
        }
        if($scope.params.validations && $scope.params.validations.length) {
            params.validations = $scope.params.validations.map(function(soundClass) {
                return soundClass.id;
            });
        }
        if($scope.params.presence) {
            params.presence = $scope.params.presence;
        }
        if($scope.params.classifications && $scope.params.classifications.length) {
            params.classifications = $scope.params.classifications.map(function(classification) {
                return classification.id;
            });
        }
        if($scope.params.classification_results && $scope.params.classification_results.length) {
            params.classification_results = $scope.params.classification_results.map(function(r) {
                return r.flags;
            });
        }
        
        return params;
    };
    var searchRecs = function(output) {
        var params = readFilters();
        params.output = output || 'list';
        params.limit = $scope.limitPerPage;
        params.offset = (params.output == 'list') ? ($scope.currentPage-1) * $scope.limitPerPage : 0;
        params.sortBy = $scope.sortKey;
        params.sortRev = $scope.reverse;
        
        Project.getRecs(params, function(data) {
            if(params.output == 'list') {
                $scope.recs = data;
            
                $scope.recs.forEach(function(rec) {
                    rec.datetime = new Date(rec.datetime);
                });
                $scope.loading = false;
            }
            else if(params.output == 'count'){
                $scope.totalRecs = data[0].count;
            }
            else if(params.output == 'date_range') {
                $scope.minDate = new Date(data[0].min_date);
                $scope.maxDate = new Date(data[0].max_date);
            }
        });
    };
    
    var findObjectWith = function(arr, key, value) {
        var result = arr.filter(function(obj) {
            return obj[key] === value;
        });
        return result.length > 0 ? result[0] : null;
    };
    
    var getAvalilableFilters = function(filters) {
        Project.getRecordingAvailability('---[1:31]', function(data) {
            
            var lists = {
                sites: [], // sitesList
                years: [], // yearsList
                months: [], // monthsList
                days: [], // daysList
                hours: [], // hoursList
            };
            
            var levelIds = Object.keys(lists);
            
            var getFilterOptions = function(filters, obj, level) {
                var count = 0;
                var currentLevel = levelIds[level];
                
                for(var child in obj) {
                    if(
                        Object.keys(filters).length && 
                        filters[currentLevel] && 
                        filters[currentLevel].indexOf(child) === -1
                    ) { // skip if filter is define and the value is not in it
                        continue;
                    }
                    
                    var item = findObjectWith(lists[currentLevel], 'value', child);
                    
                    if(!item) {
                        item = { value: child, count: 0 };
                        lists[currentLevel].push(item);
                    }
                    
                    var itemCount;
                    if(typeof obj[child] == 'number') {
                        itemCount = obj[child];
                    }
                    else {
                        if(level === 0) count = 0;
                            
                        itemCount = getFilterOptions(filters, obj[child], level+1);
                    }
                    
                    item.count += itemCount;
                    count += itemCount;
                }
                
                return count;
            };
            getFilterOptions(filters, data, 0);
            
            $scope.sites = lists.sites;
            $scope.years = lists.years;
            
            $scope.months = lists.months.map(function(month) {
                month.value = parseInt(month.value);
                month.value--;
                return { 
                    value: month.value, 
                    string: $window.moment().month(month.value).format('MMM'), 
                    count: month.count
                };
            });
            
            $scope.days = lists.days.map(function(day) {
                day.value = parseInt(day.value);
                return day;
            });
            
            $scope.hours = lists.hours.map(function(hour) {
                hour.value = parseInt(hour.value);
                return { 
                    value: hour.value, 
                    string: $window.moment().hour(hour.value).minute(0).format('HH:mm'), 
                    count: hour.count
                };
            });
            
            var sort = function(a, b) {
                return a.value > b.value;
            };
            
            $scope.sites.sort(sort);
            $scope.years.sort(sort);
            $scope.months.sort(sort);
            $scope.days.sort(sort);
            $scope.hours.sort(sort);
        });
    };
    
    $scope.sortRecs = function(sortKey, reverse) {
        $scope.sortKey = sortKey;
        $scope.reverse = reverse;
        searchRecs();
    };
    $scope.applyFilters = function() {
        $scope.currentPage = 1;
        searchRecs('count');
        searchRecs();
    };
    $scope.resetFilters = function() {
        $scope.currentPage = 1;
        $scope.params = {};
        searchRecs('count');
        searchRecs();
    };
    $scope.reloadList = function() {
        searchRecs('count');
        searchRecs();
    };
    $scope.createPlaylist = function() {
        var listParams = readFilters();
        
        if(!Object.keys(listParams).length)
            return;
            
        if(!a2UserPermit.can('manage playlists')) {
            notify.log('You do not have permission to create playlists');
            return;
        }
        
        var modalInstance = $modal.open({
            controller: 'SavePlaylistModalInstanceCtrl',
            templateUrl: '/partials/audiodata/create-playlist.html',
            resolve: {
                listParams: function() {
                    return listParams;
                }
            }
        });
        
        modalInstance.result.then(function() {
            notify.log('Playlist created');
        });
    };
    
    $scope.del = function() {
        if(!a2UserPermit.can('manage project recordings')) {
            notify.log('You do not have permission to delete recordings');
            return;
        }
        
        var recs = $scope.checked.filter(function(rec){ 
                return !rec.imported; 
            });
            
        if(!recs || !recs.length)
            return notify.log('Recordings from imported sites can not be deleted');
        
        var recCount = {};
        
        for(var i = 0; i < recs.length; i++) {
            recCount[recs[i].site] = recCount[recs[i].site] + 1 || 1;
        }
        
        var sites = Object.keys(recCount).map(function(site) {
            var s = recCount[site] > 1 ? 's' : '';
            
            return recCount[site] + ' recording'+s+' from "' + site + '"';
        });
        
        
        var msg = ["You are about to delete: "];
        msg = msg.concat(sites);
        msg.push("Are you sure??");
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            controller: function() {
                this.messages = msg;
                this.btnOk =  "Yes";
                this.btnCancel =  "No, cancel";
            },
            controllerAs: 'popup'
        });
        
        modalInstance.result.then(function() {
            
            var recIds = recs.map(function(rec) { return rec.id; });
            
            $http.post('/api/project/'+Project.getUrl()+'/recordings/delete', { recs: recs })
                .success(function(data) {
                    if(data.error)
                        return notify.error(data.error);
                    
                    searchRecs('count');
                    $scope.recs = $scope.recs.filter(function(rec) {
                        return data.deleted.indexOf(rec.id) === -1;
                    });
                    
                    notify.log(data.msg);
                });
        });
    };
    
    $scope.loading = true;
    $scope.params = {};
    $scope.classes = [];
    $scope.classifications = [];
    $scope.presence = ['present', 'absent'];
    $scope.sites = [];
    $scope.years = [];
    $scope.months = [];
    $scope.days = [];
    $scope.hours = [];
    $scope.loading = true;
    $scope.currentPage  = 1;
    $scope.limitPerPage = 10;
    
    var classification_results={
        model_only : [
            {caption:'<i class="fa a2-absent"></i> Absent', tooltip:'Absent' , flags:{model:0}, equiv:{model_th:[0,2]}},
            {caption:'<i class="fa a2-present"></i> Present'   , tooltip:'Present', flags:{model:1}, equiv:{model_th:[1,3]}}
        ],
        model_th : [
            {caption:'Model: <i class="fa a2-absent"></i>, Th: <i class="fa a2-absent"></i>', tooltip:'Model: absent, Theshold: absent'  , flags:{model:0, th:0}, equiv:{model_only:[0]}},
            {caption:'Model: <i class="fa a2-present"></i>, Th: <i class="fa a2-absent"></i>'    , tooltip:'Model: present, Theshold: absent' , flags:{model:1, th:0}},
            {caption:'Model: <i class="fa a2-absent"></i>, Th: <i class="fa a2-present"></i>'    , tooltip:'Model: absent, Theshold: present' , flags:{model:0, th:1}},
            {caption:'Model: <i class="fa a2-present"></i>, Th: <i class="fa a2-present"></i>'        , tooltip:'Model: present, Theshold: present', flags:{model:1, th:1}, equiv:{model_only:[1]}}
        ]
    };
    
    this.data = {
        classifications:[],
        classification_results: classification_results.model_only
    };
    
    Project.getClasses(
        {
            validations: true,
        },
        function(classes) {
            $scope.classes = classes;
        }
    );

    a2Classi.list((function(classifications) {
        this.data.classifications = classifications.map(function(c){
            c.name = c.cname;
            c.id = c.job_id;
            delete c.cname;
            return c;
        });
    }).bind(this));
    
    this.computeClassificationResults = function(){
        var haveThreshold = $scope.params.classifications && $scope.params.classifications.reduce(function(a, b){
            return a || !!b.threshold;
        }, false);
        var old_crs = this.data.classification_results;
        var crs_key = haveThreshold ? 'model_th' : 'model_only';
        var new_crs = classification_results[crs_key];
        this.data.classification_results = new_crs;
        if(old_crs != new_crs){
            $scope.params.classification_results = $scope.params.classification_results.reduce(function(r, cr){
                var equiv = cr.equiv && cr.equiv[crs_key];
                if(equiv){
                    equiv.forEach(function(i){
                        var new_cr = new_crs[i];
                        if(!r.index[new_cr]){
                            r.index[i] = 1;
                            r.list.push(new_cr);
                        }
                    });
                }
                return r;
            }, {list:[], index:{}}).list;
        }
    };
    
    searchRecs('count');
    searchRecs('date_range');
    getAvalilableFilters({});
    
    this.setCurrentPage = function(currentPage){
        $scope.currentPage = currentPage;
        searchRecs();
    };
    this.setLimitPerPage = function(limitPerPage){
        $scope.limitPerPage = limitPerPage;
        searchRecs();
    };
    
    searchRecs();
    
})
.controller('SavePlaylistModalInstanceCtrl', function($scope, $modalInstance, a2Playlists, listParams) {
    $scope.savePlaylist = function(name) {
        a2Playlists.create({
            playlist_name: name,
            params: listParams
        },
        function(data) {
            if (data.error) {
                $scope.errMess = data.error;
            }
            else {
                $modalInstance.close();
            }
        });
    };
})
;
