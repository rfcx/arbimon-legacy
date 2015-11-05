angular.module('a2.audiodata.recordings', [
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'humane'
])
.controller('RecsCtrl', function($scope, Project, a2Classi, $http, $modal, notify, a2UserPermit, $window) {
    
    var searchRecs = function(output) {
        var params = $scope.params;
        output = output || ['list'];
        params.output = output;
        params.limit = $scope.limitPerPage;
        params.offset = (params.output == 'list') ? ($scope.currentPage-1) * $scope.limitPerPage : 0;
        params.sortBy = $scope.sortKey;
        params.sortRev = $scope.reverse;
        var expect = output.reduce(function(obj, a){
            obj[a] = true;
            return obj;
        }, {});

        Project.getRecs(params, function(data) {
            if(output.length == 1){
                data = output.reduce(function(obj, a){
                    obj[a] = data;
                    return obj;
                }, {});
            }
            if(expect.list) {
                $scope.recs = data.list;
            
                $scope.recs.forEach(function(rec) {
                    rec.datetime = new Date(rec.datetime);
                });
                $scope.loading = false;
            }
            if(expect.count){
                $scope.totalRecs = data.count;
            }
            if(expect.date_range) {
                $scope.minDate = new Date(data.date_range.min_date);
                $scope.maxDate = new Date(data.date_range.max_date);
            }
        });
    };
    
    $scope.sortRecs = function(sortKey, reverse) {
        $scope.sortKey = sortKey;
        $scope.reverse = reverse;
        searchRecs();
    };
    $scope.applyFilters = function(filters) {
        $scope.currentPage = 1;
        $scope.params = filters;
        searchRecs(['count', 'list']);
    };
    $scope.reloadList = function() {
        searchRecs(['count', 'list']);
    };
    $scope.createPlaylist = function(filters) {
        var listParams = filters;
        
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
                    
                    searchRecs(['count', 'list']);
                    
                    notify.log(data.msg);
                });
        });
    };
    
    $scope.loading = true;
    $scope.params = {};
    $scope.loading = true;
    $scope.currentPage  = 1;
    $scope.limitPerPage = 10;

    searchRecs(['count', 'date_range', 'list']);
    
    this.setCurrentPage = function(currentPage){
        $scope.currentPage = currentPage;
        searchRecs();
    };
    this.setLimitPerPage = function(limitPerPage){
        $scope.limitPerPage = limitPerPage;
        searchRecs();
    };
    
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
.directive('recordingFilterParameters', function(){
    return {
        restrict:'E',
        templateUrl:'/partials/audiodata/recording-filter-parameters.html',
        scope:{
            isOpen : '=',
            maxDate : '=',
            minDate : '=',
            onApplyFilters : '&',
            onCreatePlaylist : '&',
        },
        controller:'recordingFilterParametersController as controller',
        requires:'^RecsCtrl', 
        link: function(scope, element, attrs) {
            var controller = scope.controller;
            
            scope.applyFilters = function() {
                scope.onApplyFilters({filters: controller.getFilters()});
            };
            scope.resetFilters = function() {
                controller.params = {};
                scope.onApplyFilters({filters: controller.getFilters()});
            };
            scope.createPlaylist = function() {
                scope.onCreatePlaylist({filters: controller.getFilters()});
            };
            
            controller.fetchOptions();
        }
    };
})
.controller('recordingFilterParametersController', function($scope, Project, a2Classi, $http, $modal, notify, a2UserPermit, $window) {
    function _1_get(attribute){
        return function(_1){
            return _1[attribute];
        };
    }
    function _1_mapper(mapFn){
        return function(_1){
            return _1.length !== undefined && _1.map(mapFn);
        };
    }
    
    var _1_get_value_mapper = _1_mapper(_1_get("value"));
    var _1_get_id_mapper    = _1_mapper(_1_get("id"));
    var _1_get_flags_mapper = _1_mapper(_1_get("flags"));
    
    var findObjectWith = function(arr, key, value) {
        var result = arr.filter(function(obj) {
            return obj[key] === value;
        });
        return result.length > 0 ? result[0] : null;
    };

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
    this.options = {
        classes : [],
        presence : ['present', 'absent'],
        sites : [],
        years : [],
        months : [],
        days : [],
        hours : [],
        classifications:[],
        classification_results: classification_results.model_only
    };
    
    var filterDefs = [
        {name:"range"                 , map: function set_range_bounds(range){
            if(range && range.from && range.to) {
                range.from.setUTCHours(0);
                range.from.setUTCMinutes(0);
                range.to.setUTCHours(23);
                range.to.setUTCMinutes(59);
            }
            return range;
        }},
        {name:"sites"                 , map: _1_get_value_mapper},
        {name:"hours"                 , map: _1_get_value_mapper},
        {name:"months"                , map: _1_get_value_mapper},
        {name:"years"                 , map: _1_get_value_mapper},
        {name:"days"                  , map: _1_get_value_mapper},
        {name:"validations"           , map: _1_get_id_mapper},
        {name:"presence"},
        {name:"classifications"       , map: _1_get_id_mapper},
        {name:"classification_results", map: _1_get_flags_mapper}
    ];

    this.getFilters = function() {
        var filters = {};
        var params = this.params;
                
        filterDefs.forEach(function(filterDef){
            var param = params[filterDef.name];
            var value = (param && filterDef.map) ? filterDef.map(param) : param;
            if(value){
                filters[filterDef.name] = value;
            }
        });
        
        return filters;
    };

    this.fetchOptions = function(filters) {
        if(filters === undefined){
            filters = {};
        }
        
        var options = this.options;
        
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
            
            options.sites = lists.sites;
            options.years = lists.years;
            
            options.months = lists.months.map(function(month) {
                month.value = parseInt(month.value);
                month.value--;
                return { 
                    value: month.value, 
                    string: $window.moment().month(month.value).format('MMM'), 
                    count: month.count
                };
            });
            
            options.days = lists.days.map(function(day) {
                day.value = parseInt(day.value);
                return day;
            });
            
            options.hours = lists.hours.map(function(hour) {
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
            
            options.sites.sort(sort);
            options.years.sort(sort);
            options.months.sort(sort);
            options.days.sort(sort);
            options.hours.sort(sort);
        });
        Project.getClasses(
            {
                validations: true,
            },
            function(classes) {
                options.classes = classes;
            }
        );

        a2Classi.list((function(classifications) {
            options.classifications = classifications.map(function(c){
                c.name = c.cname;
                c.id = c.job_id;
                delete c.cname;
                return c;
            });
        }).bind(this));
    };
    
    this.computeClassificationResults = function(classifications){
        var haveThreshold = classifications && classifications.reduce(function(a, b){
            return a || !!b.threshold;
        }, false);
        var old_crs = this.options.classification_results;
        var crs_key = haveThreshold ? 'model_th' : 'model_only';
        var new_crs = classification_results[crs_key];
        this.options.classification_results = new_crs;
        if(old_crs != new_crs){
            params.classification_results = params.classification_results.reduce(function(r, cr){
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

})
;
