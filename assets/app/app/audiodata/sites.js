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
.controller('SitesCtrl', function($scope, $state, $anchorScroll, Project, $modal, notify, a2Sites, $window, $controller, $q, a2UserPermit, a2GoogleMapsLoader, $downloadResource) {
    $scope.loading = true;
    $scope.markers = [];
    $scope.search = '';
    $scope.editing = false;
    $scope.creating = false;
    $scope.totalSites = 0;
    
    var siteNameInput = document.getElementById('siteNameInput');
    siteNameInput.addEventListener('invalid', function(){
        siteNameInput.setCustomValidity(!$scope.temp.lat && !$scope.temp.lon ? 'Please enter the site name, latitude, and longitude \nto create a site.' : 'Please fill in the site name to create a site.')
    });
    
    siteNameInput.addEventListener('input', function(event){
        if(event.target.value) {
            siteNameInput.setCustomValidity('')
            return
        }
    });

    var latInput = document.getElementById('latInput');
    latInput.addEventListener('invalid', function(){
        if(!$scope.temp.lat && !$scope.temp.lon) {
            latInput.setCustomValidity('Please enter latitude and longitude, or check \'Exclude this \nsite from Abrimon Insights\' to create a site.')
        } else {
            latInput.setCustomValidity('Please enter latitude or check \'Exclude this \nsite from Abrimon Insights\' to create a site.')
        }
    });
    
    latInput.addEventListener('input', function(event){
        if(event.target.value) {
            latInput.setCustomValidity('')
            return
        }
    });

    var lonInput = document.getElementById('lonInput');
    lonInput.addEventListener('invalid', function(){
        if(!$scope.temp.lat && !$scope.temp.lon) {
            lonInput.setCustomValidity('Please enter latitude and longitude, or check \'Exclude this \nsite from Abrimon Insights\' to create a site.')
        } else {
            lonInput.setCustomValidity('Please enter longitude or check \'Exclude this \nsite from Abrimon Insights\' to create a site.')
        }
    });
    
    lonInput.addEventListener('input', function(event){
        if(event.target.value) {
            lonInput.setCustomValidity('')
            return
        }
    });

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

    Project.getSites({ count: true, logs: true, deployment: true }, function(sites) {
        $scope.sortByLastUpdated(sites);
        $scope.loading = false;
        $scope.totalSites = sites.length

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
        a2GoogleMapsLoader.then(function(google) {
            const mapSite = $window.document.getElementById('mapSite')
            if (mapSite) {
                $scope.map = new google.maps.Map(mapSite, {
                    center: { lat: 0, lng: 0},
                    mapTypeId: google.maps.MapTypeId.SATELLITE,
                    zoom: 8, minZoom: 2
                });
                $scope.fitBounds()
            }
        });
        $scope.mapHeader = $window.document.getElementById('mapHeader')
        if ($scope.mapHeader) $scope.mapHeaderPosition = $scope.mapHeader.getBoundingClientRect();
    });

    $scope.fitBounds = function() {
        const bounds = new google.maps.LatLngBounds();

        angular.forEach($scope.sites, function(site) {
            if (site.lat > 85 || site.lat < -85 || site.lon > 180 || site.lon < -180 || site.hidden || site.lon === 0 && site.lat === 0 || site.lon === null || site.lat === null) {
                return;
            }
            var marker
            const position = new google.maps.LatLng(site.lat, site.lon);
            // set custop pin to selected site
            if ($scope.selected && ($scope.selected.id === site.id)) {
                marker = new google.maps.Marker({
                    position: position,
                    title: site.name,
                    zIndex: 999,
                    icon: {
                        url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Pin_selected_24.png',
                    }
                });
            }
            else {
                marker = new google.maps.Marker({
                    position: position,
                    title: site.name,
                    icon: {
                        url: 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Pin_map_24.png',
                    }
                });
            }
            // add draggable layer for an editig site
            if (($scope.editing || $scope.creating) && ($scope.temp && $scope.temp.id === site.id)) {
                marker.setDraggable(true);
                $scope.map.panTo(position);
                $scope.map.setZoom(8)

                google.maps.event.addListener(marker, 'dragend', function(position) {
                    $scope.$apply(function () {
                        $scope.temp.lat = position.latLng.lat();
                        $scope.temp.lon = position.latLng.lng();
                    });
                });
            }
            marker.addListener("click", () => {
                $scope.sel(site)
                $scope.scrollTo(site.id)
            });
            $scope.markers.push(marker);
            bounds.extend(position);
        });

        if ($scope.map) $scope.map.fitBounds(bounds);

        if ($scope.markers.length) {
            $scope.setMapOnAll($scope.map);
        };
    }

    $scope.scrollTo = function(id) {
        const bookmark = 'site-' + id;
        $anchorScroll.yOffset = 60;
        console.log(bookmark);
        $anchorScroll(bookmark)
    }

    $scope.onScroll = function($event, $controller){
        this.scrollElement = $controller.scrollElement;
        this.scrollPos = $controller.scrollElement.scrollY;
        $scope.scrollPos = this.scrollPos
        $scope.scrolledPastHeader = this.scrollPos < 600;
    }

    $scope.getMapHeaderTop = function() {
        // calculate top offset for the map
        const defaultOffset = '122px'
        if ($scope.mapHeaderPosition) {
            const topOffset = $scope.mapHeaderPosition.top + $scope.mapHeader.offsetHeigh
            return topOffset < 1 ? defaultOffset : topOffset
        }
        else return defaultOffset
    }

    $scope.scrollMap = function($event, $controller) {
        return $scope.show.map && $scope.editing === false
            && $scope.creating === false
            && $scope.sites && $scope.sites.length > 15
            && $scope.scrollPos
    },

    $scope.onFilterChanged = function() {
        $scope.sites = $scope.sortByKeywordArray($scope.originalSites, $scope.search)
    }

    $scope.sortByKeywordArray = function (array, keyword) {
        if (array && !array.length) return []
        return array.filter(item => {
          // Filter results by doing case insensitive match on name
          return item.name.toLowerCase().includes(keyword.toLowerCase())
        }).sort((a, b) => {
          // Sort results by matching name with keyword position in name
          if (a.name.toLowerCase().indexOf(keyword.toLowerCase()) > b.name.toLowerCase().indexOf(keyword.toLowerCase())) {
            return 1
          } else if (a.name.toLowerCase().indexOf(keyword.toLowerCase()) < b.name.toLowerCase().indexOf(keyword.toLowerCase())) {
            return -1
          } else {
            if (a.name > b.name) return 1
            else return -1
          }
        })
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
                Project.getSites({ count: true, logs: true, deployment: true }, function(sites) {
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
                if (site.hidden || site.lon === 0 && site.lat === 0 || site.lon === null || site.lat === null) {
                    return;
                }
                var position = new google.maps.LatLng($scope.selected && $scope.selected.lat, $scope.selected && $scope.selected.lon);
                $scope.marker.setDraggable(false);
                $scope.marker.setPosition(position);
                $scope.marker.setTitle($scope.selected && $scope.selected.name);
            });
        }
    };

    $scope.exportSites = function() {
        if (a2UserPermit.isSuper()) return $downloadResource(Project.getSitesExportUrl());
        if (a2UserPermit.getUserRole() === 'Data Entry') {
            $downloadResource(Project.getSitesExportUrl());
        }
        else if (!a2UserPermit.can('manage project sites')) {
            return notify.error('You do not have permission to export sites')
        } else $downloadResource(Project.getSitesExportUrl());
    };

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

        if($scope.temp.lat === '0' && $scope.temp.lon === '0') {
            $scope.temp.hidden = true
        }

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

            Project.getSites({ count: true, logs: true, deployment: true }, function(sites) {
                $scope.sortByLastUpdated(sites);
                $state.params.site = ''
                $state.params.show = ''
                $scope.selected = undefined
                $state.transitionTo($state.current.name, {site: '', show: ''}, { notify: false });
                // rebuild map pins
                $scope.deleteMarkers()
                $scope.fitBounds()
            });

            var message = (action == "update") ? "Site updated" : "Site created";

            notify.log(message);
        });
    };

    $scope.del = function() {
        if (!$scope.selected) {
            notify.log('Please select site to remove');
            return;
        }

        if(!a2UserPermit.can('delete site')) {
            notify.error("You do not have permission to remove sites");
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            controller: function() {
                this.messages = [
                    "Are you sure you would like to remove the following site?",
                    $scope.selected.name
                ];
                this.btnOk = "Delete";
                this.btnCancel = "Cancel";
            },
            controllerAs: 'popup'
        });

        modalInstance.result.then(function() {
            a2Sites.delete([$scope.selected.id], function(data) {
                if(data.error)
                    return notify.error(data.error);

                Project.getSites({ count: true, logs: true, deployment: true }, function(sites) {
                    $scope.sortByLastUpdated(sites);
                    // rebuild map pins
                    $scope.deleteMarkers()
                    $scope.fitBounds()
                });
                notify.log('Site removed');
            });
        });
    };

    $scope.delAllEmptySites = function() {
        if(!a2UserPermit.can('manage project settings')) {
            notify.error("You do not have permission to remove sites");
            return;
        }
        var list = [], siteIds = [];
        $scope.sites.forEach(function(site, index) {
            if (site.rec_count === 0 && !list.includes(site.name)) {
                list.push(site.name)
                siteIds.push(site.id)
            }
        })
        if (!list.length) {
            notify.log("There is no empty site in your project");
            return;
        }
        if (list.length > 3) {
            const msg = '& ' + (list.length - 3) + ' other sites'
            list = list.slice(0, 3)
            list.push(msg)
        }
        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            controller: function() {
                this.messages = ["Are you sure you would like to remove the following sites?"];
                this.list = list;
                this.btnOk = "Delete";
                this.btnCancel = "Cancel";
            },
            controllerAs: 'popup'
        });

        modalInstance.result.then(function() {
            a2Sites.delete(siteIds, function(data) {
                if(data.error)
                    return notify.error(data.error);

                Project.getSites({ count: true, logs: true, deployment: true }, function(sites) {
                    $scope.sortByLastUpdated(sites);
                    // rebuild map pins
                    $scope.deleteMarkers()
                    $scope.fitBounds()
                });
                notify.log('Empty sites removed');
            });
        });
    };

    $scope.show = {map:false};
    $scope.show['map'] = true;

    $scope.set_show = function(new_show, show_path){
        var d=$q.defer(), promise=d.promise;
        d.resolve();
        var show_state_param = new_show;
        promise = promise.then(function(){
            new_show='map';
        });

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
        $scope.creating = true;
        // rebuild map pins
        $scope.deleteMarkers()
        $scope.fitBounds()
    };

    $scope.isLocationEmpty = function(lat, lon) {
        return(lat === 0 && lon === 0) || (lat === null && lon === null)
    }

    $scope.edit = function() {
        if(!$scope.selected) return;
        if(!a2UserPermit.can('manage project sites')) {
            notify.error("You do not have permission to edit sites");
            return;
        }
        $scope.set_show('map');
        $scope.temp = angular.copy($scope.selected);
        $scope.temp.published = ($scope.temp.published === 1);
        $scope.temp.hidden = ($scope.temp.hidden === 1);
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
            if ($scope.temp) $scope.temp.project = data;
        });
        $scope.editing = true;
        // rebuild map pins
        $scope.deleteMarkers()
        $scope.fitBounds()
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
                            $scope.assets = $scope.assets.filter(asset => asset.meta !== null)
                            for (var i = 0; i < $scope.assets.length; i++) {
                                var src = '/legacy-api/project/'+ $scope.project.url + '/streams/'+ $scope.selected.external_id +'/assets/' + $scope.assets[i].id
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
            // rebuild map pins
            $scope.deleteMarkers()
            $scope.fitBounds()
            // zoom in to the selected pin
            if ($scope.selected) {
                a2GoogleMapsLoader.then(function(google) {
                    if (site.hidden || site.lon === 0 && site.lat === 0 || site.lon === null || site.lat === null) {
                        return;
                    }
                    var position = new google.maps.LatLng($scope.selected.lat, $scope.selected.lon);
                    if ($scope.map) {
                        $scope.map.panTo(position);
                        $scope.map.setZoom(17)
                    }
                });
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
