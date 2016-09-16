angular.module('a2.admin.dashboard.plotter-controller', [
    'templates-arbimon2',
    'a2.admin.dashboard.data-service',
    'a2.directive.plotly-plotter',
])
.controller('AdminDashboardPlotterController', function($scope, $window, $q, AdminDashboardDataService){
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
        return $q(function(resolve, reject){
            $window.Plotly.d3.csv(data.url, function(err, data){
                if(err){reject(err);}
                else if(data){resolve(data);}
            });
        }).then((function(data){
            this.chart = {
                data: [{
                    type:'scatter',
                    mode:'lines',
                    x : data.map(function(_){ return new Date(+_.datetime).toString(); }),
                    y : data.map(function(_){ return +_.activity; }),
                }],
                layout:{
                    xaxis: {boundsmode: 'auto'},
                    yaxis: {boundsmode: 'auto'},
                }
                // axes : {
                //     x : {
                //         tick: {
                //             format: function (x) { 
                //                 return moment(new Date(x)).utc().format('MM-DD-YYYY HH:mm'); 
                //             }
                //         }
                //     }
                // }
            };
            console.log(this.chart);
        }).bind(this));
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
