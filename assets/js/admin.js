angular.module('a2.admin', [
    'ui.router', 
    'ui.bootstrap', 
    'a2.utils',
    'a2.services',
    'a2.directives',
    'templates-arbimon2',
    'humane',
    'ui.select',
    'a2.admin.projects',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise("/dashboard");
    
    $stateProvider
        .state('dashboard', {
            url: '/dashboard',
            controller:'AdminDashboardCtrl',
            templateUrl: '/partials/admin/dashboard.html'
        })
        // TODO complete projects and users sections
        // .state('projects', {
        //     url: '/projects',
        //     controller:'AdminProjectsCtrl',
        //     templateUrl: '/partials/admin/projects.html'
        // })
        // .state('users', {
        //     url: '/users',
        //     controller:'AdminUsersCtrl',
        //     templateUrl: '/partials/admin/users.html'
        // })
        .state('jobs', {
            url: '/jobs',
            controller:'AdminJobsCtrl',
            templateUrl: '/partials/admin/jobs.html'
        });
})
.controller('AdminDashboardCtrl', function($scope, $http, $q, $controller) {
    
    $scope.plots = $controller('AdminDashboardPlotterController', {'$scope':$scope});
    
    $http.get('/admin/dashboard-stats')
        .success(function(data) {
            $scope.newUsers = data.newUsers;
            $scope.newProjects = data.newProjects;
            $scope.Jobs = data.jobsStatus;
        });
    
    $scope.getSystemSettings = function() {
        $http.get('/admin/system-settings')
            .success(function(data) {
                $scope.settings = data;
            });
    };
    $scope.getSystemSettings();

    $scope.setSetting = function(setting, value){
        var d=$q.defer();
        
        if(!setting){
            d.resolve();
        } else {        
        $http.put('/admin/system-settings', {
                setting: setting,
                value: value
            })
            .success(function(data) {
                $scope.getSystemSettings();
                d.resolve(data[setting]);
            })
            .error(function(data) {
                console.error(data);
                $scope.getSystemSettings();
                d.reject(data);
            });
        }
        return d.promise;
    };
    
    $scope.toggleSetting = function(setting) {
        var value = $scope.settings[setting] == 'on' ? 'off' : 'on';
        return this.setSetting(setting, value);
    };
})
.controller('AdminJobsCtrl', function($scope, $http, $interval, Project) {
    
    var getJobQueueInfo = function(argument) {
        $http.get('/admin/job-queue')
            .success(function(data) {
                $scope.jobsStatus = data;
            });
    };
    
    $scope.findJobs = function() {
        var query = {};
        var getTags = /(\w+):["'](.+)["']|(\w+):([\w\-]+)/g;
        
        if($scope.params.search) {
            // iterate over getTags results
            $scope.params.search.replace(getTags, function(match, key1, value1, key2, value2) {
                // key1 matches (\w+):["'](.+)["']
                // key2 matches (\w+):([\w\-]+)
                
                var key = key1 ? key1 : key2;
                var value = value1 ? value1 : value2;
                
                if(!query[key]) 
                    query[key] = [];
                
                query[key].push(value);
            });
        }
        
        if($scope.params.states) {
            query.states = $scope.params.states.map(function(s) { return s.name; });
        }
        if($scope.params.types) {
            query.types = $scope.params.types.map(function(t) { return t.id; });
        } 
        
        $http.get('/admin/jobs', {
                params: query
            })
            .success(function(data) {
                $scope.activeJobs = data;
                // console.log(query);
            });
    };
    
    $scope.initParams = function() {
        $scope.params = {
            search: "is:visible "
        };
    };
    
    
    $scope.job_types = [];
    $scope.states = [
        {
            name: 'waiting',
            color: 'black',
            show: true
        },
        {
            name: 'initializing',
            color: 'blue',
            show: true
        },
        {
            name: 'ready',
            color: '#007777',
            show: true
        },
        {
            name: 'processing',
            color: 'olive',
            show: true
        },
        {
            name: 'completed',
            color: 'green',
            show: false
        },
        {
            name: 'error',
            color: 'red',
            show: true
        },
        {
            name: 'canceled',
            color: 'gray',
            show: false
        },
        {
            name: 'stalled',
            color: 'gray',
            show: false
        },
    ];
    
    $scope.initParams();
    getJobQueueInfo();
    
    
    $http.get('/api/jobs/types')
        .success(function(jobTypes) {
            var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528'];
            
            $scope.colors = {};
            
            for(var i = 0; i < jobTypes.length; i++) {
                
                var t = jobTypes[i];
                $scope.colors[t.name] = colors[i % colors.length];
            }
            
            $scope.job_types = jobTypes;
        });
    

    $scope.findJobs();
    
    // $scope.queueLoop = $interval(function() {
    //     getJobQueueInfo();
    // }, 5000);
    // 
    // $scope.jobsLoop = $interval(function() {
    //     findJobs();
    // }, 5000);
    
    // kill loops after page is exited
    // $scope.$on('$destroy', function() {
    //     $interval.cancel($scope.queueLoop);
    //     // $interval.cancel($scope.jobsLoop);
    // });
})

.service('AdminDashboardDataService', function($q){
    return {
        getPlotData: function(series, from, to, period){
            return $q.when('/admin/plot-data/data.txt?stat='+series+'&q='+period+'&from='+from.getTime()+'&to='+to.getTime());
        },
    };
})
.controller('AdminDashboardPlotterController', function($scope, $q, AdminDashboardDataService){
    function mk_time_range_fn(from, delta){
        return function(){
            var fromdt = (from == 'now' ? new Date() : new Date(from));
            var todt = new Date(fromdt.getTime() + delta);
            if(delta < 0){
                var t=fromdt;
                fromdt=todt;
                todt=t;
            }
            return [fromdt, todt];
        };
    }
    function get_by_tag(arr, tag){
        return arr.filter(function(x){return x.tag == tag;}).shift();
    }
    function make_setter(options){
        var attr = options.data;
        var selattr = options.sel || attr;
        var def = options.def;
        return function set(value){
            if(typeof(value) == 'string'){
                value = get_by_tag(this.data[attr], value);
            }
            if(!value){
                value = get_by_tag(this.data[attr], def);
            }
            this.selected[selattr] = value;
            if(value.apply){
                value.apply(this);
            }
            
            return this.refresh_logs();
                    
        };
    }
    
    this.data = {
        series:[
            {tag:'activity', name:'Activity', icon:'fa fa-fw fa-ra'},
            // {tag:'voltage', name:'Voltage', icon:'fa fa-fw fa-bolt'},
            // {tag:'power', name:'Power', icon:'fa fa-fw fa-battery-half'}
        ],
        time_ranges:[
            {tag:'1-hour' , text:'Last Hour'     , range:mk_time_range_fn('now', -      3600*1000)},
            {tag:'3-hour' , text:'Last 3 Hours'  , range:mk_time_range_fn('now', -    3*3600*1000)},
            {tag:'6-hour' , text:'Last 6 Hours'  , range:mk_time_range_fn('now', -    6*3600*1000)},
            {tag:'12-hour', text:'Last 12 Hours' , range:mk_time_range_fn('now', -   12*3600*1000)},
            {tag:'24-hour', text:'Last 24 Hours' , range:mk_time_range_fn('now', -   24*3600*1000)},
            {tag:'3-days' , text:'Last 3 Days'   , range:mk_time_range_fn('now', - 3*24*3600*1000)},
            {tag:'1-week' , text:'Last Week'     , range:mk_time_range_fn('now', - 7*24*3600*1000)},
            {tag:'2-weeks', text:'Last 2 Weeks'  , range:mk_time_range_fn('now', -14*24*3600*1000)},
            {tag:'1-month', text:'Last Month'    , range:mk_time_range_fn('now', -31*24*3600*1000)}            
        ],
        periods:[
            {tag:'1-minute'   , text:'1 Minute'   , sampling:'1 min'  , granularity:       1 * 60 * 1000},
            {tag:'5-minutes'  , text:'5 Minutes'  , sampling:'5 mins' , granularity:       5 * 60 * 1000},
            {tag:'10-minutes' , text:'10 Minutes' , sampling:'10 mins', granularity:      10 * 60 * 1000},
            {tag:'30-minutes' , text:'30 Minutes' , sampling:'30 mins', granularity:      30 * 60 * 1000},
            {tag:'1-hour'     , text:'1 Hour'     , sampling:'1 hour' , granularity:  1 * 60 * 60 * 1000},
            {tag:'3-hours'    , text:'3 Hours'    , sampling:'3 hours', granularity:  3 * 60 * 60 * 1000},
            {tag:'6-hours'    , text:'6 Hours'    , sampling:'6 hours', granularity:  6 * 60 * 60 * 1000},
            {tag:'1-day'      , text:'1 Day'      , sampling:'1 day'  , granularity: 24 * 60 * 60 * 1000},
        ],
        // min_date: 0,
        // max_date: 10000,
    };
    this.loading={};
    this.selected = {
        series: get_by_tag(this.data.series, 'activity'),
        time_range: get_by_tag(this.data.time_ranges, '1-week'),
        period: get_by_tag(this.data.periods, '1-day'),
    };
    
    this.set_series      = make_setter({data:'series'     , sel:'series'    , def:'activity' });
    this.set_time_range  = make_setter({data:'time_ranges', sel:'time_range', def:'1-week'});
    this.set_period      = make_setter({data:'periods'    , sel:'period'    , def:'1-day'});

    this.load_data = function(series, range, period){
        var loading = this.loading;
        loading.data=true;
        return AdminDashboardDataService.getPlotData(series.tag, range[0], range[1], period.sampling).then(function(data){
            loading.data=false;
            return {x:'datetime', url:data};
        });
    };
    
    this.make_chart_struct = function(data){
        this.chart = {
            data: data,
            
            axes : {
                x : {
                    tick: {
                        format: function (x) { 
                            return moment(new Date(x)).utc().format('MM-DD-YYYY HH:mm'); 
                        }
                    }
                }
            }
        };
    };

    
    this.refresh_logs = function(){
        var d = $q.defer(), promise=d.promise;
        d.resolve();
        var series = this.selected.series;
        var time_range = this.selected.time_range;
        var period = this.selected.period;
        
        if(series && time_range && period) {
            var range = time_range.range();
            var granularity = period.granularity;
            promise = d.promise.then((function(){
                if(series.data) {
                    if(series.data.period != period || !(
                        series.data.range[0] - granularity >= range[0] && range[1] <= series.data.range[1] + granularity
                    )){
                        series.data = null;
                    } 
                }
                if(!series.data){
                    return this.load_data(series, range, period).then(function(data){
                        series.data = {data:data, range:range, period:period};
                        return series.data.data;
                    });
                } else {
                    return series.data.data;
                }
            }).bind(this)).then((function(chart_data){
                console.log("chart_data : ", chart_data);
                if (chart_data) {
                    this.make_chart_struct(chart_data);
                }
            }).bind(this));
        }
        
        return promise;
        
    };

    $q.when().then(this.refresh_logs.bind(this));
})
;
