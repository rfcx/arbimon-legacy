angular.module('a2.app.dashboard',[
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'ui.router',
    'ct.ui.router.extras',
    'a2.forms',
    'humane',
    'a2.heremaps'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('dashboard', {
        url: '/dashboard',
        controller:'SummaryCtrl',
        templateUrl: '/app/dashboard/index.html',
    });
})
.controller('SummaryCtrl', function($scope, Project, a2HereMapsLoader, a2TrainingSets, $timeout, notify, $window, $compile, $templateFetch) {
    $scope.loading = 9;
    
    var done = function() {
        if($scope.loading > 0) --$scope.loading;
    };
    
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
            a2HereMapsLoader.then(function(heremaps){
                var defaultLayers = heremaps.platform.createDefaultLayers();
                
                $scope.map = new heremaps.api.Map($window.document.getElementById('summary-map'),
                    defaultLayers.normal.map, {
                    center: { lat: 18.3, lng: -66.5},
                    zoom: 8
                });
                
                var group = new heremaps.api.map.Group();

                group.addObjects(($scope.sites || []).map(function (site){
                    return new heremaps.api.map.DomMarker({
                        lat: site.lat,
                        lng: site.lon
                    }, {
                        icon: heremaps.makeTextIcon(site.name)
                    });
                }));

                $scope.map.addObject(group);

                $scope.map.setViewBounds(group.getBounds());

            });
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
