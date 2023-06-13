angular.module('a2.app.dashboard',[
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'ui.router',
    'ct.ui.router.extras',
    'a2.forms',
    'humane',
    'a2.googlemaps',
    'a2.directive.warning-banner'
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('dashboard', {
        url: '/dashboard',
        controller:'SummaryCtrl',
        templateUrl: '/app/dashboard/index.html',
    });
})
.controller('SummaryCtrl', function($scope, Project, a2Templates, a2GoogleMapsLoader, a2UserPermit, $timeout, notify, $window, $compile, $templateFetch, a2PatternMatching) {
    $scope.loading = 5;

    var done = function() {
        if($scope.loading > 0) --$scope.loading;
    };

    Project.getInfo(function(info){
        $scope.project = info;
        $scope.isSpeciesLoading = true
        $scope.showErrorBanner = $scope.project && $scope.project.disabled && a2UserPermit.isProjectMember()

        Project.getProjectTotalSpecies(info.project_id, function(data) {
            $scope.speciesQty = data || 0;
            $scope.isSpeciesLoading = false
        });

        done();
    });

    Project.getSites(function(sites) {
        $scope.sites = sites;
        done();
        $timeout(function() {
            a2GoogleMapsLoader.then(function(google){

                $scope.map = new google.maps.Map($window.document.getElementById('summary-map'), {
                    center: { lat: 0, lng: 0},
                    mapTypeId: google.maps.MapTypeId.SATELLITE,
                    zoom: 8, minZoom: 2
                });

                var bounds = new google.maps.LatLngBounds();

                angular.forEach($scope.sites, function(site){
                    if (site.lat > 85 || site.lat < -85 || site.lon > 180 || site.lon < -180) {
                        return;
                    }

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

    Project.getRecTotalQty(function(data) {
        $scope.recsQty = data;
        done();
    });

    a2Templates.getList().then(data => {
        $scope.templateQty = data.length;
        done();
    })

    a2PatternMatching.getPatternMatchingsTotal((data) => {
        $scope.pmQty = data;
        done();
    })
})
;
