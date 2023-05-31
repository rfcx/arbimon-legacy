angular.module('a2.audiodata.sites', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane',
    'a2.qr-js',
    'a2.googlemaps',
    'a2.srv.project'
])
.directive('fileChange',['$parse', function($parse) {
    return{
      require:'ngModel',
      restrict:'A',
      link:function($scope, element, attrs) {
        var attrHandler=$parse(attrs['fileChange']);
        var handler=function(e){
          $scope.$apply(function(){
            attrHandler($scope, {$event:e, files:e.target.files});
          });
        };
        element[0].addEventListener('change', handler,false);
      }
    }
  }])
.controller('SitesCtrl', function($scope, $state, $filter, Project, $modal, notify, a2Sites, $window, $controller, $q, a2UserPermit, a2GoogleMapsLoader, $downloadResource) {
    $scope.loading = true;
    $scope.markers = [];
    $scope.search = ''

    Project.getInfo(function(info){
        $scope.project = info;
    });

    var p={
        site : $state.params.site,
        show : $state.params.show
    };
    if(p.show){
        p.show_path = p.show.split(':');
        p.show = p.show_path.shift();
    }

    Project.getSites({ count: true, logs: true }, function(sites) {
        $scope.sortByLastUpdated(sites);
        $scope.loading = false;

        if (p.site) {
            var site = sites.filter(function(s){return s.id == p.site;}).shift();
            if (site && site.id) {
                $scope.sel(site).then(function(){
                    if(p.show){
                        $scope.set_show(p.show, p.show_path);
                    }
                });
            }
        }
        a2GoogleMapsLoader.then(function(google){
            $scope.map = new google.maps.Map($window.document.getElementById('map-site'), {
                center: { lat: 0, lng: 0},
                mapTypeId: google.maps.MapTypeId.SATELLITE,
                zoom: 8, minZoom: 2
            });

            var bounds = new google.maps.LatLngBounds();

            angular.forEach($scope.sites, function(site) {
                if (site.lat > 85 || site.lat < -85 || site.lon > 180 || site.lon < -180) {
                    return;
                }
                var position = new google.maps.LatLng(site.lat, site.lon);
                var marker = new google.maps.Marker({
                    position: position,
                    title: site.name
                });

                $scope.markers.push(marker);
                bounds.extend(position);
            });

            $scope.map.fitBounds(bounds);

            if ($scope.markers.length) {
                $scope.setMapOnAll($scope.map);
            };
        });
    });

    $scope.onFilterChanged = function() {
        const sites = $filter('filter')($scope.originalSites, function (i) {
            return i.name.toLowerCase().includes($scope.search.toLowerCase())
        })
        $scope.sites = sites
    }

    $scope.sortByLastUpdated = function(sites) {
        $scope.sites = sites.sort(function(a, b) { return (a.updated_at < b.updated_at) ? 1 : -1;});
        $scope.originalSites = $scope.sites
    }

    // Sets the map on all markers in the array
    $scope.setMapOnAll = function(map) {
        for (var i = 0; i < $scope.markers.length; i++) {
            $scope.markers[i].setMap(map);
        }
    };

    // Removes the markers from the map, but keeps them in the array
    $scope.clearMarkers = function() {
        $scope.setMapOnAll(null);
    }

    // Shows any markers currently in the array
    $scope.showMarkers = function(map) {
        $scope.setMapOnAll(map);
    }

    // Deletes all markers in the array by removing references to them
    $scope.deleteMarkers = function() {
        $scope.clearMarkers();
        $scope.markers = [];
    }

    $scope.editing = false;

    $scope.importSite = function() {
        if(!a2UserPermit.can('manage project sites')) {
            notify.error("You do not have permission to add sites");
            return;
        }

        var modalInstance =  $modal.open({
          templateUrl: "/app/audiodata/import.html",
          controller: "ImportSiteInstanceCtrl"
        });

        modalInstance.result.then(function(response) {
            // Check the file is valid
            const sites = parseSitesFromCsv(response);
            if (!sites) {
                notify.error("Wrong format of csv file")
                return
            }

            // Save the sites
            createSites(sites).then(function () {
                notify.log("Sites created");

                // Refresh data
                Project.getSites({ count: true, logs: true }, function(sites) {
                    $scope.sortByLastUpdated(sites);
                });
            }).catch(function (error) {
                notify.error("Error: " + error);
            });
        });
    };

    function parseSitesFromCsv(allText) {
        var allTextLines = allText.split(/\r\n|\n/);
        var headers = allTextLines[0].split(',');

        if(!headers.includes("name") || !headers.includes("lat") || !headers.includes("lon") || !headers.includes("alt")) {
            return false;
        }

        var sites = [];
        for (var i=1; i<allTextLines.length; i++) {
            var data = allTextLines[i].split(',');
            if (data.length == headers.length) {
                var site = {};
                for (var j=0; j<headers.length; j++) {
                    if(headers[j] === "lat" && (data[j] > 85 ||  data[j] < -85)) {
                        return notify.log('Please enter latitude number between -85 to 85');
                    }
                    if(headers[j] === "lon" && (data[j] > 180 ||  data[j] < -180)) {
                        return notify.log('Please enter longitude number between -180 to 180');
                    }
                    site[headers[j]] = data[j]
                }
                sites.push(site);
            }
        }
        return sites;
    }

    function createSites(sites) {
        return Promise.all(
            sites.map(function (site) {
                return new Promise(function (resolve, reject) {
                    a2Sites.create(site, function(data) {
                        if (data.error) {
                            reject(data.error)
                        } else {
                            resolve()
                        }
                    });
                })
            })
        )
    };

    $scope.close = function() {
        $scope.creating = false;
        $scope.editing = false;
        if($scope.marker){
            a2GoogleMapsLoader.then(function(google){
                var position = new google.maps.LatLng($scope.selected && $scope.selected.lat, $scope.selected && $scope.selected.lon);
                $scope.marker.setDraggable(false);
                $scope.marker.setPosition(position);
                $scope.marker.setTitle($scope.selected && $scope.selected.name);
            });
        }
    };

    $scope.exportSites = function() {
        if (a2UserPermit.isSuper()) return $downloadResource(Project.getSitesExportUrl());
        if ((a2UserPermit.all && !a2UserPermit.all.length) || !a2UserPermit.can('export report')) {
            return notify.error('You do not have permission to export sites')
        } else $downloadResource(Project.getSitesExportUrl());
    };

    $scope.status_controller = $controller('SiteStatusPlotterController', {'$scope':$scope});
    var onLogsRefreshed = $scope.status_controller.on('logs-refreshed', function(logParams){
        if($scope.show.status){
            var new_show = [$state.params.show.split(':').slice(0, 1)].concat(logParams).join(':');
            console.log("logParams", logParams, new_show);
            $state.transitionTo($state.current.name, {site:$state.params.site, show:new_show}, {notify:false});
        }
    });

    $scope.$on('$destroy', function(){
        $scope.status_controller.off('logs-refreshed', onLogsRefreshed);
    });

    $scope.save = function() {
        var action = $scope.editing ? 'update' : 'create';

        if($scope.temp.lat > 85 || $scope.temp.lat < -85){
            notify.log('Please enter latitude number between -85 to 85');
            return
        }

        if($scope.temp.lon > 180 || $scope.temp.lon < -180) {
            notify.log('Please enter longitude number between -180 to 180');
            return
        }

        if($scope.siteForm.$invalid) return;

        var tempObj = Object.assign({}, $scope.temp);

        // Do not include equal location metadata / updated at data to the update endpoint.
        if (action === 'update') {
            const attrArray = ['alt', 'updated_at'];
            for (var i = 0; i < attrArray.length; i++) {
                var key = attrArray[i];
                if ($scope.temp[key] === $scope.selected[key]) {
                  delete tempObj[key]
                }
            }
            const locationArray = ['lat', 'lon'];
            if ($scope.temp[locationArray[0]] === $scope.selected[locationArray[0]] && $scope.temp[locationArray[1]] === $scope.selected[locationArray[1]]) {
                delete tempObj[locationArray[0]]
                delete tempObj[locationArray[1]]
            }
        }

        a2Sites[action](action === 'create'? $scope.temp : tempObj, function(data) {
            if(data.error)
                return notify.error(data.error);

            if(action === 'create') {
                $scope.creating = false;
            }
            else {
                $scope.editing = false;
            }

            Project.getSites({ count: true, logs: true }, function(sites) {
                $scope.sortByLastUpdated(sites);
            });

            var message = (action == "update") ? "Site updated" : "Site created";

            notify.log(message);
        });
    };

    $scope.del = function() {
        if(!$scope.selected)
            return;

        if(!a2UserPermit.can('delete site')) {
            notify.error("You do not have permission to remove sites");
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            controller: function() {
                this.messages = [
                    "You are about to delete: ",
                    $scope.selected.name,
                    "Are you sure?"
                ];
                this.btnOk = "Yes, do it!";
                this.btnCancel = "No";
            },
            controllerAs: 'popup'
        });

        modalInstance.result.then(function() {
            a2Sites.delete($scope.selected, function(data) {
                if(data.error)
                    return notify.error(data.error);

                Project.getSites({ count: true, logs: true }, function(sites) {
                    $scope.sortByLastUpdated(sites);
                });
                notify.log('Site removed');
            });
        });
    };

    $scope.show = {map:false, status:false};
    $scope.show[p.show || 'map'] = true;

    $scope.set_show = function(new_show, show_path){
        var d=$q.defer(), promise=d.promise;
        d.resolve();
        var show_state_param = new_show;
        if(new_show == 'status' && $scope.selected && $scope.selected.has_logs){
            show_state_param = [new_show].concat(show_path).join(':');
            promise = promise.then(function(){
                return $scope.status_controller.activate($scope.selected, show_path);
            });
        } else {
            promise = promise.then(function(){
                new_show='map';
            });
        }

        return promise.then(function(){
            for(var i in $scope.show){
                $scope.show[i] = false;
            }

            $scope.show[new_show] = true;

            return $state.transitionTo($state.current.name, {site:$state.params.site, show:show_state_param}, {notify:false});
        });
    };

    $scope.create = function() {

        if(!a2UserPermit.can('manage project sites')) {
            notify.error("You do not have permission to add sites");
            return;
        }

        $scope.temp = {};
        $scope.set_show('map');

        a2GoogleMapsLoader.then(function(google){
            if(!$scope.marker) {
                    $scope.marker = new google.maps.Marker({
                        position: $scope.map.getCenter(),
                        title: 'New Site Location'
                    });
                    $scope.marker.setMap($scope.map);
            }
            else {
                $scope.marker.setPosition($scope.map.getCenter());
            }

            $scope.marker.setDraggable(true);
            $scope.creating = true;

            google.maps.event.addListener($scope.marker, 'dragend', function(position) {
                $scope.$apply(function () {
                    $scope.temp.lat = position.latLng.lat();
                    $scope.temp.lon = position.latLng.lng();
                });
            });
        });

        $scope.creating = true;
    };

    $scope.edit = function() {
        if(!$scope.selected) return;

        if(!a2UserPermit.can('manage project sites')) {
            notify.error("You do not have permission to edit sites");
            return;
        }

        $scope.set_show('map');
        $scope.temp = angular.copy($scope.selected);
        $scope.temp.published = ($scope.temp.published === 1);
        Project.getProjectsList('my', function(data) {
            $scope.projects = data.map(project => {
                return {
                    project_id: project.project_id,
                    name: project.name,
                    url: project.url
                }
            })
        });
        Project.getInfo(function(data) {
            $scope.temp.project = data;
        });
        $scope.marker.setDraggable(true);

        google.maps.event.addListener($scope.marker, 'dragend', function(position) {
            $scope.$apply(function () {
                $scope.temp.lat = position.latLng.lat();
                $scope.temp.lon = position.latLng.lng();
            });
        });
        $scope.editing = true;
    };

    $scope.onSelect = function($item) {
        $scope.temp.project = $item;
    };

    $scope.showAssetsCarousel = false;

    $scope.showCarousel = function(id) {
        $scope.images.forEach((image) => {
            image.active = image.id === id;
        })
        $scope.showAssetsCarousel = true;
    }

    $scope.capitalizeFirstLetter = function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    $scope.sel = function(site) {
        return $state.transitionTo($state.current.name, {site: site && site.id, show:$state.params.show}, {notify:false}).then(function(){
            $scope.images = [];
            $scope.close();
            $scope.selected = site;
            if ($scope.selected && $scope.selected.external_id) {
                a2Sites.getListOfAssets($scope.selected.external_id)
                    .then(data => {
                        $scope.assets = data;
                        if ($scope.assets && $scope.selected.external_id) {
                            for (var i = 0; i < $scope.assets.length; i++) {
                                var src = '/api/project/'+ $scope.project.url + '/streams/'+ $scope.selected.external_id +'/assets/' + $scope.assets[i].id
                                $scope.images.push({
                                    id: i,
                                    src: src,
                                    active: i === 0,
                                    label:  $scope.assets[i] &&  $scope.assets[i].meta &&  $scope.assets[i].meta.label ? $scope.capitalizeFirstLetter($scope.assets[i].meta.label) : 'No label image'
                                })
                            }
                        };
                    }).catch(err => {
                        console.log('\nerr', err);
                    });
            }

            $scope.clearMarkers()

            if ($scope.selected) {
                a2GoogleMapsLoader.then(function(google) {
                    var position = new google.maps.LatLng($scope.selected.lat, $scope.selected.lon);
                    if(!$scope.marker) {
                        $scope.marker = new google.maps.Marker({
                            position: position,
                            title: $scope.selected.name
                        });
                        $scope.marker.setMap($scope.map);
                    }
                    else {
                        $scope.marker.setDraggable(false);
                        $scope.marker.setPosition(position);
                        $scope.marker.setTitle($scope.selected.name);
                    }
                    $scope.map.panTo(position);
                });
            } else {
                var bounds = new google.maps.LatLngBounds();
                angular.forEach($scope.sites, function(site) {
                    if (site.lat > 85 || site.lat < -85 || site.lon > 180 || site.lon < -180) {
                        return;
                    }
                    var position = new google.maps.LatLng(site.lat, site.lon);
                    var marker = new google.maps.Marker({
                        position: position,
                        title: site.name
                    });

                    $scope.markers.push(marker);
                    bounds.extend(position);
                });

                $scope.map.fitBounds(bounds);

                if ($scope.markers.length) {
                    $scope.setMapOnAll($scope.map);
                };
            }
        });
    };

})
.controller('ImportSiteInstanceCtrl', function ($scope, $modalInstance) {
    $scope.files=[];

    $scope.handler = function(e, files) {
        var reader = new FileReader();
        reader.onload = function(e) {
            $modalInstance.close(reader.result);
        }
        reader.readAsText(files[0]);
    }

    $scope.cancel = function(){
        $modalInstance.dismiss();
    }
})
.controller('SitesTokenGenaratorCtrl', function($scope, a2Sites, $modal, notify){
        $scope.site = $scope.selected;
        $scope.loading = {};

        var confirmRevoke = function(title, btnOk) {
            var modalInstance = $modal.open({
                templateUrl: '/common/templates/pop-up.html',
                controller : function(){
                    this.title = title;
                    this.messages = [
                        "This action will revoke the current token for the site <b>" +
                        $scope.site.name + "</b>. " +
                        "Are you sure you want to do this?"
                    ];
                    this.btnOk = btnOk;
                    this.btnCancel = "No";
                },
                controllerAs: 'popup'
            });
            return modalInstance;
        };

        var genToken = function() {
            a2Sites.generateToken($scope.site)
                .success(function(data) {
                    $scope.loading.generate = false;
                    if(data.error)
                        return notify.error(data.error);

                    $scope.site.token_created_on = new Date(data.created*1000);
                    $scope.base64 = data.base64token;
                    $scope.token = {
                        type: data.type,
                        name: data.name,
                        created: data.created,
                        expires: data.expires,
                        token: data.token
                    };
                    notify.log("New site token generated.");
                })
                .error(function(data) {
                    $scope.loading.generate = false;
                    notify.serverError();
                });
        };


        $scope.generateToken = function(){
            $scope.loading.generate = true;

            if($scope.site.token_created_on) {
                var modalInstance = confirmRevoke(
                    "<h4>Confirm revoke and generate token</h4>",
                    "Yes, revoke and generate a new token"
                );

                modalInstance.result.then(function ok() {
                    genToken();
                }, function cancel() {
                    $scope.loading.generate = false;
                });
            }
            else {
                genToken();
            }


        };

        $scope.revokeToken = function(){

            var modalInstance = confirmRevoke(
                "<h4>Confirm revoke token</h4>",
                "Yes, revoke token"
            );

            modalInstance.result.then(function() {
                $scope.loading.revoke = true;

                a2Sites.revokeToken($scope.site)
                    .success(function(data) {
                        $scope.loading.revoke = false;
                        $scope.site.token_created_on = null;
                        $scope.token = null;
                        notify.log("site token revoked.");
                    })
                    .error(function(data) {
                        $scope.loading.generate = false;
                        notify.serverError();
                    });
            });
        };
    })

.controller('SiteStatusPlotterController', function($scope, $q, a2Sites, $debounce, a2EventEmitter){
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
        return function set(value, dontRefreshLogs){
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

            return dontRefreshLogs ? $q.resolve() : this.refresh_logs();

        };
    }

    var events = new a2EventEmitter();
    this.on = events.on.bind(events);
    this.off = events.off.bind(events);


    this.itemGroup = function (item){
      return item.group;
    };
    this.data = {
        series:[
            {tag:'status', group:'Site', name:'Battery Status', icon:'fa fa-fw fa-plug', axis:{y:{tick:{
                values:[0,1,2,3], format:function(x){
                    return ['unknown', 'charging', 'not charging', 'full'][(x)|0];
                }
            }}}},
            {tag:'voltage'   , group:'Site', name:'Voltage', icon:'fa fa-fw fa-bolt'},
            {tag:'power'     , group:'Site', name:'Power', icon:'fa fa-fw fa-battery-half'},
            {tag:'uploads'   , group:'Data', name:'Uploads', icon:'fa fa-fw fa-upload'},
            {tag:'recordings', group:'Data', name:'Recordings', icon:'fa fa-fw fa-volume-up'}
        ],
        time_ranges:[
            {tag:'1-hour' , text:'Last Hour'    , group:'Hours', range:mk_time_range_fn('now', -      3600*1000)},
            {tag:'3-hour' , text:'Last 3 Hours' , group:'Hours', range:mk_time_range_fn('now', -    3*3600*1000)},
            {tag:'6-hour' , text:'Last 6 Hours' , group:'Hours', range:mk_time_range_fn('now', -    6*3600*1000)},
            {tag:'12-hour', text:'Last 12 Hours', group:'Hours', range:mk_time_range_fn('now', -   12*3600*1000)},
            {tag:'24-hour', text:'Last 24 Hours', group:'Hours', range:mk_time_range_fn('now', -   24*3600*1000)},
            {tag:'3-days' , text:'Last 3 Days'  , group:'Days', range:mk_time_range_fn('now', - 3*24*3600*1000)},
            {tag:'1-week' , text:'Last Week'    , group:'Weeks', range:mk_time_range_fn('now', - 7*24*3600*1000)},
            {tag:'2-weeks', text:'Last 2 Weeks' , group:'Weeks', range:mk_time_range_fn('now', -14*24*3600*1000)},
            {tag:'1-month', text:'Last Month'   , group:'Month', range:mk_time_range_fn('now', -31*24*3600*1000)}
        ],
        periods:[
            {tag:'1-minute'   , text:'1 Minute'   , group: 'Minutes' , sampling:'1 min'  , granularity:       1 * 60 * 1000},
            {tag:'5-minutes'  , text:'5 Minutes'  , group: 'Minutes' , sampling:'5 mins' , granularity:       5 * 60 * 1000},
            {tag:'10-minutes' , text:'10 Minutes' , group: 'Minutes' , sampling:'10 mins', granularity:      10 * 60 * 1000},
            {tag:'30-minutes' , text:'30 Minutes' , group: 'Minutes' , sampling:'30 mins', granularity:      30 * 60 * 1000},
            {tag:'1-hour'     , text:'1 Hour'     , group: 'Hours'   , sampling:'1 hour' , granularity:  1 * 60 * 60 * 1000},
            {tag:'3-hours'    , text:'3 Hours'    , group: 'Hours'   , sampling:'3 hours', granularity:  3 * 60 * 60 * 1000},
            {tag:'6-hours'    , text:'6 Hours'    , group: 'Hours'   , sampling:'6 hours', granularity:  6 * 60 * 60 * 1000},
            {tag:'1-day'      , text:'1 Day'      , group: 'Days'    , sampling:'1 day'  , granularity: 24 * 60 * 60 * 1000},
        ],
        // min_date: 0,
        // max_date: 10000,
    };
    this.loading={};
    this.selected = {
        series: get_by_tag(this.data.series, 'power'),
        time_range: get_by_tag(this.data.time_ranges, '1-week'),
        period: get_by_tag(this.data.periods, '1-hour'),
    };

    this.set_series      = make_setter({data:'series'     , sel:'series'    , def:'power' });
    this.set_time_range  = make_setter({data:'time_ranges', sel:'time_range', def:'1-week'});
    this.set_period      = make_setter({data:'periods'    , sel:'period'    , def:'7-days'});

    this.activate = function(selected_site, plot_uri){
        this.selected.site = selected_site;
        if(plot_uri){
            if(plot_uri.length){
                this.set_series(plot_uri.shift());
            }
            if(plot_uri.length){
                this.set_time_range(plot_uri.shift());
            }
            if(plot_uri.length){
                this.set_period(plot_uri.shift());
            }
        }
        return this.refresh_logs();
    };

    this.load_data = function(site, series, range, period){
        var loading = this.loading;
        loading.data=true;
        return a2Sites.getSiteLogData(site.id, series.tag, range[0], range[1], period.sampling).then(function(data){
            loading.data=false;
            data.x = 'datetime';
            data.axis = series.axis;
            data.empty = {
                label: {text: "No data to show."}
            };
            return data;
        });
    };

    this.make_chart_struct = function(data){
        var axes = {
            x : {
                tick: {
                    format: function (x) {
                        return moment(new Date(x)).utc().format('MM-DD-YYYY HH:mm');
                    }
                }
            }
        };
        if(data.axis){
            angular.merge(axes, data.axis);
            delete data.axis;
        }
        this.chart = {
            data: data, axes : axes
        };
    };


    this.refresh_logs = $debounce(function(){
        var d = $q.defer(), promise=d.promise;
        d.resolve();
        var site = this.selected.site;
        var series = this.selected.series;
        var time_range = this.selected.time_range;
        var period = this.selected.period;

        if(site && series && time_range && period) {
            var range = time_range.range();
            var granularity = period.granularity;
            promise = d.promise.then((function(){
                if(series.data) {
                    if(series.data.site != site || series.data.period != period || !(
                        series.data.range[0] - granularity >= range[0] && range[1] <= series.data.range[1] + granularity
                    )){
                        series.data = null;
                    }
                }
                if(!series.data){
                    return this.load_data(site, series, range, period).then(function(data){
                        series.data = {data:data, site:site, range:range, period:period};
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
            }).bind(this)).then(function(){
                events.emit('logs-refreshed', [
                    series.tag,
                    time_range.tag,
                    period.tag
                ]);
            });
        }

        return promise;

    }, 10);
})
;
