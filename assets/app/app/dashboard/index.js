angular.module('a2.app.dashboard',[
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'ui.router',
    'ct.ui.router.extras',
    'a2.forms',
    'humane',
    'a2.googlemaps'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('dashboard', {
        url: '/dashboard',
        controller:'SummaryCtrl',
        templateUrl: '/app/dashboard/index.html',
    });
})
.controller('SummaryCtrl', function($scope, Project, a2Templates, a2GoogleMapsLoader, a2TrainingSets, $timeout, notify, $window, $compile, $templateFetch) {
    $scope.loading = 10;
    
    var done = function() {
        if($scope.loading > 0) --$scope.loading;
    };
    
    Project.getInfo(function(info){
        $scope.project = info;
        done();
    });
    
    Project.getClasses(function(species){
        species = [...species];
        $scope.species = species
        let i = -1;
        let count = 0;
        const getValitateData = () => {
            i++;
            if (i < species.length) {
                const s = species[i]
                try {
                    Project.validationBySpeciesSong(s.species, s.songtype, data => {
                        const idx = $scope.species.findIndex(sp => sp.species === s.species && sp.songtype === s.songtype)
                        if(idx > -1) {
                            $scope.species[idx].validate = data.total > 0
                            if (data.total > 0) count ++
                        }
                        getValitateData()
                    }) 
                } catch (e) {
                    console.log("validate error:", e)
                    getValitateData()
                }
            } else {
                $scope.validatedSpecies = count
                done()
            }
        }
        getValitateData()
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
            a2GoogleMapsLoader.then(function(google){
                
                $scope.map = new google.maps.Map($window.document.getElementById('summary-map'), {
                    center: { lat: 18.3, lng: -66.5},
                    zoom: 8
                });
                
                var bounds = new google.maps.LatLngBounds();
                    
                angular.forEach($scope.sites, function(site){
                    var position = new google.maps.LatLng(site.lat, site.lon);
                    
                    var marker = new google.maps.Marker({
                        position: position,
                        title: site.name
                    });
                    
                    bounds.extend(position);
                    marker.setMap($scope.map);
                    
                    $scope.map.fitBounds(bounds);
                });
            });
        }, 100);
        
    });

    Project.getUsage().success(function(data) {
        console.log("Usage", data)
        $scope.recMins = data.min_usage;
        done();
    });
    
    Project.getRecTotalQty(function(data) {
        $scope.recsQty = data;
        done();
    });

    a2Templates.getList().then(data => {
        $scope.templateQty = data.length;
        done();
    })
})
;
