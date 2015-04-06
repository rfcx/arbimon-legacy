angular.module('audiodata.sites', [
    'a2services', 
    'a2directives', 
    'ui.bootstrap',
    'humane',
    'a2-qr-js'
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
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            controller: function() {
                this.messages = [
                    "You are about to delete: ",
                    $scope.selected.name,
                    "Are you sure??"
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

    $scope.site_token = function() {
        
        if(!$scope.selected || $scope.selected.imported)
            return;
            
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/site-tokens-popup.html',
            controller: 'SitesTokenGenaratorCtrl',
            scope: $scope
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
.controller('PublishedSitesBrowserCtrl', function($scope, a2Sites, project, $modalInstance, $window) {
        var geocoder = new $window.google.maps.Geocoder();
        
        a2Sites.listPublished(function(sites) {
            
            sites.forEach(function(site) {
                geocoder.geocode({ 
                        location: { 
                            lat: site.lat, 
                            lng: site.lon 
                        } 
                }, function(result, status) {
                    
                    if(result.length){
                        site.location = result[1].formatted_address;
                    }
                    else {
                        site.location = 'unknown';
                    }
                    
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
    })
.controller('SitesTokenGenaratorCtrl', function($scope, a2Sites, $modal, notify){
        $scope.site = $scope.selected;
        $scope.loading = {};
        
        var confirmRevoke = function(title, btnOk) {
            var modalInstance = $modal.open({
                templateUrl: '/partials/pop-up.html',
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
                    notify.error("Error communicating with server.");
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
                        notify.error("Error communicating with server.");
                    });
            });
        };
    })
;
