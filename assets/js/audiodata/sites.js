angular.module('audiodata.sites', [
    'a2services', 
    'a2directives', 
    'ui.bootstrap',
    'humane',
    'google-maps'
])
.controller('SitesCtrl', function($scope, Project, $http, $modal, notify, a2Sites) {
    $scope.loading = true;
    
    Project.getInfo(function(info){
        $scope.project = info;
    });
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
        $scope.loading = false;
    });
    
    $scope.editing = false;
    
    var mapOptions = {
        center: { lat: 18.3, lng: -66.5},
        zoom: 8
    };
    
    $scope.map = new google.maps.Map(document.getElementById('map-site'), mapOptions);
    
    $scope.close = function() {
        $scope.creating = false;
        $scope.editing = false;
    };
    
    $scope.save = function() {
        var action = $scope.editing ? 'update' : 'create';
        
        a2Sites[action]($scope.temp, function(data) {
            if(data.error)
                return notify.error(data.error);
                
            if(action === 'create') {
                $scope.creating = false;
            }
            else {
                $scope.editing = false;
            }
            
            Project.getSites(function(sites) {
                $scope.sites = sites;
            });
            
            var message = (action == "update") ? "site updated" : "site created";
            
            notify.log(message);
        });
    };
    
    
    
    $scope.del = function() {
        if(!$scope.selected)
            return;
        
        $scope.popup = {
            messages: [
                "You are about to delete: ",
                $scope.selected.name,
                "Are you sure??"
            ],
            btnOk: "Yes, do it!",
            btnCancel: "No",
        };
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            scope: $scope
        });
        
        modalInstance.result.then(function() {
            a2Sites.delete($scope.selected, function(data) {
                if(data.error)
                    return notify.error(data.error);
                
                Project.getSites(function(sites) {
                    $scope.sites = sites;
                });
                notify.log("site removed");
            });
        });
    };
    
    
    $scope.browseShared = function() {
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/browse-published-sites.html',
            controller: 'PublishedSitesBrowserCtrl',
            size: 'lg',
            resolve: {
                project: function() {
                    var p = angular.copy($scope.project);
                    p.sites = $scope.sites;
                    return p;
                }
            }
        });
        
        modalInstance.result.then(function(data) {
            Project.getSites(function(sites) {
                $scope.sites = sites;
                $scope.loading = false;
            });
            notify.log(data.msg);
        })
        .catch(function(reason) {
            if(reason) {
                notify.error(reason);
            }
        });
    };
    
    $scope.create = function() {
        $scope.temp = {};
        
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
            //~ console.log(position);
            $scope.$apply(function () {
                $scope.temp.lat = position.latLng.lat();
                $scope.temp.lon = position.latLng.lng();
            });
        });
    };

    $scope.edit = function() {
        
        if(!$scope.selected)
            return;
            
        $scope.temp = angular.copy($scope.selected);
        $scope.temp.published = ($scope.temp.published === 1);
        
        $scope.marker.setDraggable(true);
        
        google.maps.event.addListener($scope.marker, 'dragend', function(position) {
            //~ console.log(position);
            $scope.$apply(function () {
                $scope.temp.lat = position.latLng.lat();
                $scope.temp.lon = position.latLng.lng();
            });
        });
        
        $scope.editing = true;
    };

    $scope.register = function() {
        
        if(!$scope.selected || $scope.selected.imported)
            return;
            
        $scope.popup = {
            site: $scope.selected,
            token_uri:null,
            action : {
                generate_token: function(){
                    //
                },
                revoke_token: function(callback){
                    callback();
                },
            }
        };

        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/register-popup.html',
            scope: $scope
        });

        modalInstance.result.then(function() {
            a2Sites.delete($scope.selected, function(data) {
                if(data.error)
                    return notify.error(data.error);
                
                Project.getSites(function(sites) {
                    $scope.sites = sites;
                });
                notify.log("site removed");
            });
        });
    };
    
    $scope.sel = function(site) {
        //~ console.log('sel');
        
        $scope.editing = false;
        $scope.creating = false;
        
        $scope.selected = site;
        
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
        //~ console.log($scope.selected);
    };
                    
})
.controller('PublishedSitesBrowserCtrl', [
    '$scope', 
    'a2Sites', 
    'project', 
    '$modalInstance',
    'geocoding',
    function($scope, a2Sites, project, $modalInstance, geocoding) {
    
        a2Sites.listPublished(function(sites) {
            
            sites.forEach(function(site) {
                geocoding.geocode({ 
                        location: { 
                            lat: site.lat, 
                            lng: site.lon 
                        } 
                }, function(result, status) {
                    site.location = result[1].formatted_address || "";
                    $scope.$apply();
                });
                
            });
            
            $scope.sites = sites;
        });
        
        
        $scope.addSite = function(site) {
            
            if(site.project_id === project.project_id) {
                $modalInstance.dismiss("site is owned by this project");
                return;
            }
            
            var result = project.sites.filter(function(value) {
                return value.id === site.id;
            });
            
            if(result.length > 0) {
                $modalInstance.dismiss("site is already on this project");
                return;
            }
            
            a2Sites.import(site, function(data) {
                $modalInstance.close(data);
            });
        };
    }
])
;
