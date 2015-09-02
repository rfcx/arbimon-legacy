angular.module('a2.audiodata.sites', [
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'humane',
    'a2.qr-js'
])
.controller('SitesCtrl', function($scope, $state, Project, $modal, notify, a2Sites, $window, $controller, a2UserPermit) {
    $scope.loading = true;
    
    Project.getInfo(function(info){
        $scope.project = info;
    });
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
        $scope.loading = false;
        
        var psite = $state.params.site;
        var pshow = $state.params.show;
        if(psite){
            var site = sites.filter(function(s){return s.id == psite;}).shift();
            if(site){
                $scope.sel(site).then(function(){
                    if(pshow){
                        $scope.set_show(pshow);
                    }
                });
            }
        }
// )
    });
    
    $scope.editing = false;
    
    $scope.map = $window.L.map('map-site', { zoomControl: false }).setView([10, -20], 1);
    L.control.zoom({ position: 'topright'}).addTo($scope.map);
    
    $window.L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo($scope.map);
    
    var moveMarker = function(e) {
        console.log(e.latlng);
        
        if(!$scope.marker) {
            console.log('no marker');
            $scope.marker = $window.L.marker(e.latlng).addTo($scope.map);
        }
        else {
            console.log('marker');
            $scope.marker.setLatLng(e.latlng);
        }
        
        $scope.$apply(function () {
            $scope.temp.lat = e.latlng.lat;
            $scope.temp.lon = e.latlng.lng;
        });
    };
    
    $scope.close = function() {
        $scope.creating = false;
        $scope.editing = false;
        $scope.map.removeEventListener('click', moveMarker);
    };

    $scope.status_controller = $controller('SiteStatusPlotterController', {'$scope':$scope});
    
    $scope.save = function() {
        var action = $scope.editing ? 'update' : 'create';
        
        if($scope.siteForm.$invalid) return;
        
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
        
        if(!a2UserPermit.can('manage project sites')) {
            notify.log("You do not have permission to remove sites");
            return;
        }
        
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
    
    $scope.show = 'map';
    $scope.set_show = function(new_show){
        if(new_show == 'status' && $scope.selected && $scope.selected.has_logs){
            $scope.status_controller.activate($scope.selected);
        } else {
            new_show='map';
        }
        $scope.show = new_show;
        return $state.transitionTo($state.current.name, {site:$state.params.site, show:new_show}, {notify:false});
    };
    // $scope.browseShared = function() {
    //     var modalInstance = $modal.open({
    //         templateUrl: '/partials/audiodata/browse-published-sites.html',
    //         controller: 'PublishedSitesBrowserCtrl',
    //         size: 'lg',
    //         resolve: {
    //             project: function() {
    //                 var p = angular.copy($scope.project);
    //                 p.sites = $scope.sites;
    //                 return p;
    //             }
    //         }
    //     });
    //     
    //     modalInstance.result.then(function(data) {
    //         Project.getSites(function(sites) {
    //             $scope.sites = sites;
    //             $scope.loading = false;
    //         });
    //         notify.log(data.msg);
    //     })
    //     .catch(function(reason) {
    //         if(reason) {
    //             notify.error(reason);
    //         }
    //     });
    // };
    
    $scope.create = function() {
        
        if(!a2UserPermit.can('manage project sites')) {
            notify.log("You do not have permission to add sites");
            return;
        }
        
        $scope.temp = {};
        $scope.set_show('map');
        
        if($scope.marker) {
            $scope.map.removeLayer($scope.marker);
            $scope.map.setView([10, -20], 1);
            delete $scope.marker;
        }
        
        
        $scope.map.on('click', moveMarker);
        $scope.creating = true;
    };

    $scope.edit = function() {
        if(!$scope.selected) return;
        
        if(!a2UserPermit.can('manage project sites')) {
            notify.log("You do not have permission to edit sites");
            return;
        }
        
        $scope.set_show('map');
        $scope.temp = angular.copy($scope.selected);
        $scope.temp.published = ($scope.temp.published === 1);
        
        $scope.map.on('click', moveMarker);
        $scope.editing = true;
    };

    $scope.site_token = function() {
        
        if(!$scope.selected || $scope.selected.imported)
            return;
        
        if(!a2UserPermit.can('manage project sites')) {
            notify.log("You do not have permission to edit sites");
            return;
        }
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/site-tokens-popup.html',
            controller: 'SitesTokenGenaratorCtrl',
            scope: $scope
        });
    };
    
    $scope.sel = function(site) {
        return $state.transitionTo($state.current.name, {site:site.id, show:$state.params.show}, {notify:false}).then(function(){
            $scope.close();
            
            $scope.selected = site;
            
            if(!site || !site.has_logs){
                $scope.set_show('map');
            }
            
            if(!$scope.marker) {
                $scope.marker = new $window.L.marker(site)
                    .bindPopup(site.name)
                    .addTo($scope.map);
            }
            else {
                $scope.marker.setLatLng(site);
                $scope.marker.closePopup()
                    .unbindPopup()
                    .bindPopup(site.name);
            }
            
            $scope.map.setView(site, 10, { animate:true });
        });
    };
    
})
// TODO remove properly published
// .controller('PublishedSitesBrowserCtrl', function($scope, a2Sites, project, $modalInstance, $window) {
//     var geocoder = new $window.google.maps.Geocoder();
//     
//     a2Sites.listPublished(function(sites) {
//         
//         sites.forEach(function(site) {
//             geocoder.geocode({ 
//                     location: { 
//                         lat: site.lat, 
//                         lng: site.lon 
//                     } 
//             }, function(result, status) {
//                 
//                 if(result.length){
//                     site.location = result[1].formatted_address;
//                 }
//                 else {
//                     site.location = 'unknown';
//                 }
//                 
//                 $scope.$apply();
//             });
//             
//         });
//         
//         $scope.sites = sites;
//     });
//     
//     
//     $scope.addSite = function(site) {
//         
//         if(site.project_id === project.project_id) {
//             $modalInstance.dismiss("site is owned by this project");
//             return;
//         }
//         
//         var result = project.sites.filter(function(value) {
//             return value.id === site.id;
//         });
//         
//         if(result.length > 0) {
//             $modalInstance.dismiss("site is already on this project");
//             return;
//         }
//         
//         a2Sites.import(site, function(data) {
//             $modalInstance.close(data);
//         });
//     };
// })
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

.controller('SiteStatusPlotterController', function($scope, a2Sites){
    this.activate = function(selected_site){
        this.selected_site = selected_site;
        this.refresh_logs();
    };
    
    this.refresh_logs = function(){
        // conso
    };
    this.data = {
        series:[
            {name:'Battery Status', icon:'fa fa-fw fa-plug'},
            {name:'Voltage', icon:'fa fa-fw fa-bolt'},
            {name:'Power', icon:'fa fa-fw fa-battery-half'}
        ],
        // min_date: 0,
        // max_date: 10000,
    };
    this.selected = {
        series:[],
        from:undefined,
        to:undefined
    };
})
;
