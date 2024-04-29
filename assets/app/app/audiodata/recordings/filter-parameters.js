angular.module('a2.audiodata.recordings.filter-parameters', [
    'a2.directive.a2-auto-close-on-outside-click',
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane',
])
.directive('recordingFilterParameters', function($document, $rootScope){
    return {
        restrict:'E',
        templateUrl:'/app/audiodata/recordings/filter-parameters.html',
        scope:{
            isOpen : '=',
            maxDate : '=',
            minDate : '=',
            recTotal: '=',
            isLoading: '=',
            onApplyFilters : '&'
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

            controller.fetchOptions();
        }
    };
})
.controller('recordingFilterParametersController', function(
    $scope,
    Project, a2Classi,
    a2SoundscapeCompositionService,
    a2Playlists,
    $q,
    a2Tags,
    $window
) {
    var staticMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(function (mon, ind) {
        return { value: ind, string: mon, count: null }
    })

    var staticDays = []
    for (var day = 1; day <= 31; day++) {
        staticDays.push({ value: day, count: null })
    }

    var staticHours = []
    staticHours.push({ value: -1, string: 'Select all', count: null })
    for (var hour = 0; hour < 24; hour++) {
        staticHours.push({ value: hour, string: ((hour < 10 ? '0' : '') + hour + ':00'), count: null })
    }

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
    var _1_get_tag_id_mapper  = _1_mapper(_1_get("tag_id"));
    var _1_get_flags_mapper = _1_mapper(_1_get("flags"));

    var findObjectWith = function(arr, key, value) {
        var result = arr.filter(function(obj) {
            return obj[key] === value;
        });
        return result.length > 0 ? result[0] : null;
    };

    var classification_results={
        model_only : [
            {caption:'<i class="fa a2-present"></i> Present'   , tooltip:'Present', flags:{model:1}, equiv:{model_th:[1,3]}},
            {caption:'<i class="fa a2-absent"></i> Absent', tooltip:'Absent' , flags:{model:0}, equiv:{model_th:[0,2]}}
        ],
        model_th : [
            {caption:'Model: <i class="fa a2-present"></i>, Th: <i class="fa a2-present"></i>'        , tooltip:'Model: present, Theshold: present', flags:{model:1, th:1}, equiv:{model_only:[1]}},
            {caption:'Model: <i class="fa a2-present"></i>, Th: <i class="fa a2-absent"></i>'    , tooltip:'Model: present, Theshold: absent' , flags:{model:1, th:0}},
            {caption:'Model: <i class="fa a2-absent"></i>, Th: <i class="fa a2-present"></i>'    , tooltip:'Model: absent, Theshold: present' , flags:{model:0, th:1}},
            {caption:'Model: <i class="fa a2-absent"></i>, Th: <i class="fa a2-absent"></i>', tooltip:'Model: absent, Theshold: absent'  , flags:{model:0, th:0}, equiv:{model_only:[0]}}
        ]
    };
    this.options = {
        classes : [],
        presence : ['present', 'absent'],
        sites : [],
        sites_ids : [],
        playlists : [],
        years : [],
        months : [],
        days : [],
        hours : [],
        tags : [],
        classifications:[],
        classification_results: classification_results.model_only,
        soundscape_composition:[],
        soundscape_composition_annotation : ['present', 'absent'],
    };
    this.params={};
    this.loading = {sites: false};

    var filterDefs = [
        {name:"range"                 , map: function set_range_bounds(range){
            return range;
        }},
        {name:"sites"                 , map: _1_get_value_mapper},
        {name:"sites_ids"             , map: _1_get_id_mapper},
        {name:"hours"                 , map: _1_get_value_mapper},
        {name:"months"                , map: _1_get_value_mapper},
        {name:"years"                 , map: _1_get_value_mapper},
        {name:"days"                  , map: _1_get_value_mapper},
        {name:"playlists"             , map: _1_get_id_mapper},
        {name:"validations"           , map: _1_get_id_mapper},
        {name:"tags"                  , map: _1_get_tag_id_mapper},
        {name:"presence"},
        {name:"classifications"       , map: _1_get_id_mapper},
        {name:"classification_results", map: _1_get_flags_mapper},
        {name:"soundscape_composition", map: _1_get_id_mapper},
        {name:"soundscape_composition_annotation"},
    ];

    this.onSelectClick = function($item) {
        if($item.find(h => h.value === -1)) {
            if (this.params.hours.length !== 25) {
                this.params.hours = []
                this.params.hours = staticHours.slice(1)
            } else {
                this.params.hours = []
            }
        }
    }

    this.getFilters = function() {
        var filters = {};
        var params = this.params;

        filterDefs.forEach(function(filterDef){
            var param = params[filterDef.name];
            var value = (param && filterDef.map) ? filterDef.map(param) : param;
            if(value instanceof Array ? value.length : value){
                filters[filterDef.name] = value;
            }
            if (value && filterDef.name === 'sites') {
                const vals = filterDefs[2].map(param)
                filters['sites_ids'] = vals;
            }
        });

        return filters;
    };

    this.getRecordingsStatsPerSite = function (sites, filters, options) {
        var proms = sites.map(function (site) {
            return Project.getRecordingAvailability('!q:' + site.id + '---[1:31]');
        })
        return $q.all(proms)
            .then(function (data) {
                return data.reduce(function(_, recAv){
                    return angular.merge(_, recAv);
                }, {});
            })
            .then(function(data) {
                // loading.sites = false
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
                    const currentLevel = levelIds[level];
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
                            const siteObj = currentLevel == 'sites' ? sites.find(site => site.name === child) : {}
                            item = { value: child, count: 0 };
                            if (currentLevel == 'sites') {
                                item.id = siteObj.id
                            }
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
                    return a.value > b.value ? 1 : -1;
                };

                options.sites.sort(sort);
                options.years.sort(sort);
                options.months.sort(sort);
                options.days.sort(sort);
                options.hours.sort(sort);
            });
    }

    this.setRecStatsStatic = function (sites, bounds, options) {
        options.sites = sites.map(function (site) {
            return { value: site.name, count: null, id: site.id }
        })
        var years = []
        var maxYear = (bounds.max ? new Date(bounds.max) : new Date()).getFullYear()
        var minYear = bounds.min ? new Date(bounds.min).getFullYear() : '1990'
        for (var year = maxYear; year >= minYear; year--) {
            years.push({ value: year, count: null })
        }
        options.years = years
        options.months = staticMonths
        options.days = staticDays
        options.hours = staticHours
    }

    this.fetchOptions = function(filters) {
        var self = this
        if(filters === undefined){
            filters = {};
        }

        var options = this.options;
        var loading = this.loading;
        var sites
        if ($scope.recTotal === undefined || $scope.minDate === undefined || $scope.maxDate === undefined) {
            // wait until all inputs are populated to make proper decision in a condition below
            setTimeout(function() {
                this.fetchOptions(filters)
            }.bind(this), 1000)
            return
        }

        loading.sites = true

        Project.getSites()
            .then(function(data) {
                sites = data
                if (sites.length < 50 && $scope.recTotal < 100000) {
                    return self.getRecordingsStatsPerSite(sites, filters, options)
                } else {
                    return self.setRecStatsStatic(sites, { min: $scope.minDate.toISOString(), max: $scope.maxDate.toISOString() }, options)
                }
            })
            .finally(() => {
                loading.sites = false
            })

        Project.getClasses({ validations: true}).then(function(classes) {
                options.classes = classes;
            }
        );
        a2Playlists.getList().then(function(playlists){
            options.playlists = playlists;
        });
        a2Tags.getForType('recording').then((function(tags){
            var tagsObj = {}
            tags.forEach(function(t) {
                var key = t.tag
                if (!tagsObj[key]) {
                    tagsObj[key] = {
                        tag: key,
                        tag_id: [t.tag_id],
                        count: t.count
                    }
                }
                else {
                    tagsObj[key].tag_id.push(t.tag_id);
                    tagsObj[key].count++
                }
            })
            options.tags = Object.values(tagsObj);
        }).bind(this));
        a2Classi.list((function(classifications) {
            options.classifications = classifications.map(function(c){
                c.name = c.cname;
                c.id = c.job_id;
                delete c.cname;
                return c;
            });
        }).bind(this));
        a2SoundscapeCompositionService.getClassList({isSystemClass:1}).then((function(classes){
            options.soundscape_composition = classes;
        }).bind(this));
    };

    this.computeClassificationResultsOptions = function(classifications){
        console.log("this.computeClassificationResults = function(classifications){", classifications);
        var haveThreshold = classifications && classifications.reduce(function(a, b){
            return a || !!b.threshold;
        }, false);
        var old_crs = this.options.classification_results;
        var crs_key = haveThreshold ? 'model_th' : 'model_only';
        var new_crs = classification_results[crs_key];
        this.options.classification_results = new_crs;
        if(old_crs != new_crs){
            this.params.classification_results = this.params.classification_results.reduce(function(r, cr){
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
