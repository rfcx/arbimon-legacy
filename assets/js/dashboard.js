angular.module('a2.dashboard',[
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'ui.router',
    'ct.ui.router.extras',
    'a2.forms',
    'humane',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('dashboard', {
        url: '/dashboard',
        controller:'SummaryCtrl',
        templateUrl: '/partials/dashboard/index.html',
    });
})
.controller('SummaryCtrl', function($scope, Project, a2TrainingSets, $timeout, notify, $window, $compile, $templateFetch) {
    $scope.loading = 9;
    
    var done = function() {
        if($scope.loading > 0) --$scope.loading;
    };
    
    var google = $window.google;
    
    Project.getInfo(function(info){
        $scope.project = info;
        done();
    });
    
    Project.getClasses(function(species){
        $scope.species = species;
        done();
    });
    
    Project.getModels(function(err, models){
        if(err) {
            notify.serverError();
        }
        
        $scope.modelsQty = models.length;
        done();
    });
    
    Project.getClassi(function(err, classi){
        if(err) {
            notify.serverError();
        }
        
        $scope.classiQty = classi.length;
        done();
    });
    
    Project.validationsCount(function(count){
        $scope.valsQty = count;
        done();
    });
    
    a2TrainingSets.getList(function(trainingSets){
        $scope.trainingSetsQty = trainingSets.length;
        done();
    });
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
        done();
        
        
        $timeout(function() {
            
            var satellite = $window.L.esri.basemapLayer('Imagery');
            var topo = $window.L.esri.basemapLayer('Topographic');
            
            $scope.map = $window.L.map('summary-map', { 
                    zoomControl: false ,
                    layers: [satellite, topo],
                }).setView([10, -20], 1);
            
            $scope.maplayers = {
                'Satellite': satellite,
                'Topographic': topo, 
            };
            
            L.control.zoom({ position: 'topright'}).addTo($scope.map);
            L.control.layers($scope.maplayers, {}, { position: 'topright'}).addTo($scope.map);
            
            
            if(!$scope.sites.length){
                return;
            }
            
            var bounds = [];
            angular.forEach($scope.sites, function(site){
                bounds.push([site.lat, site.lon]);
                
                var infowindow_scope = $scope.$new();
                infowindow_scope.site = site;
                $templateFetch('/partials/dashboard/site-info-window.html', function(layer_tmp){
                    
                    var content = $compile(layer_tmp)(infowindow_scope)[0];
                    
                    $window.L.marker([site.lat, site.lon]).addTo($scope.map)
                        .bindPopup(content);
                });
            });
            
            $scope.map.fitBounds(bounds);
            
        }, 100);
        
    });

    Project.getUsage().success(function(data) {
        $scope.recMins = data.min_usage;
        done();
    });
    
    Project.getRecTotalQty(function(data) {
        $scope.recsQty = data;
        done();
    });
})
;
