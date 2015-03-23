angular.module('dashboard',[
    'a2services', 
    'a2directives', 
    'ui.bootstrap',
    'ui.router',
    'ct.ui.router.extras',
    'a2forms',
    'humane',
])
.config(function($stickyStateProvider, $stateProvider, $urlRouterProvider) {
        $stateProvider.state('dashboard', {
            url: '/dashboard',
            controller:'SummaryCtrl',
            templateUrl: '/partials/dashboard/index.html',
        })
        .state('settings', {
            url: '/settings',
            controller:'SettingsCtrl',
            templateUrl: '/partials/dashboard/settings.html'
        })
        .state('users', {
            url: '/users',
            controller:'UsersCtrl',
            templateUrl: '/partials/dashboard/users.html'
        });
    })
.controller('SummaryCtrl', function($scope, Project, a2TrainingSets, $timeout, notify, $window) {
        $scope.loading = 8;
        var done = function() {
            if($scope.loading > 0) --$scope.loading;
        };
        
        var google = $window.google;
        
        var mapOptions = {
            center: { lat: 18.3, lng: -66.5},
            zoom: 8
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
                notify.error('Error Communicating with Server');
            }
            
            $scope.modelsQty = models.length;
            done();
        });
        
        Project.getClassi(function(err, classi){
            if(err) {
                notify.error('Error Communicating with Server');
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
                
                $scope.map = new google.maps.Map($window.document.getElementById('summary-map'), mapOptions);
                
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
                
            }, 100);
            
        });

        Project.getRecTotalQty(function(count) {
            $scope.recsQty = count;
            done();
        });
    })
.controller('SettingsCtrl', function($scope, Project, notify, $window, $timeout) {
        Project.getInfo(function(info) {
            $scope.project = info;
        });
        
        $scope.save = function() {
            if(!$scope.isValid)  return;
            
            Project.updateInfo({
                project: $scope.project
            }, 
            function(err, result){
                if(err) {
                    return notify.error('Error Communicating with Server');
                }
                
                if(result.error) {
                    return notify.error(result.error);
                }
                
                notify.log('Project Info Updated');
                
                if(result.url) {
                    $timeout(function() {
                        $window.location.assign('/project/'+ result.url +'/#/settings');
                    }, 1000);
                }
            });
        };
    })
.controller('UsersCtrl', function($scope, $http, Project, $modal, notify) {
    
        Project.getInfo(function(info) {
            $scope.project = info;
        });
        
        Project.getUsers(function(err, users){
            $scope.users = users;
        });
        
        Project.getRoles(function(err, roles){
            $scope.roles = roles;
        });
        
        $scope.findUser = function(query) {
            return $http.get('/api/user/search/'+ query)
                .then(function(response) { 
                    return response.data;
                });
        };
        
        $scope.add = function() {
            if(!$scope.userToAdd)
                return;
            
            
            Project.addUser({
                project_id: $scope.project.project_id,
                user_id: $scope.userToAdd.id
            },
            function(err, result){
                if(err) {
                    notify.error('Error Communicating with Server');
                }
                
                if(result.error) {
                    notify.error(result.error);
                }
                else {
                    notify.log('User Added to Project');
                }
                
                Project.getUsers(function(err, users){
                    $scope.users = users;
                });
            });
        };
        
        $scope.changeRole = function($index) {
            
            var role = $scope.roles.filter(function(value){
                return $scope.users[$index].rolename === value.name;
            })[0];
            
            Project.changeUserRole({
                project_id: $scope.project.project_id,
                user_id: $scope.users[$index].id,
                role_id: role.id
            },
            function(err, result){
                if(err)
                {
                    notify.error('Error Communicating with Server');
                }
                
                if(result.error) {
                    notify.error(result.error);
                }
                else {
                    notify.log('User Role Updated');
                }
                
                Project.getUsers(function(err, users){
                    $scope.users = users;
                });
            });
        };
        
        $scope.del = function($index) {
            
            $scope.popup = {
                messages : [
                    "You are about to remove: ",
                    $scope.users[$index].username,
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
                Project.delUser({
                    project_id: $scope.project.project_id,
                    user_id: $scope.users[$index].id
                },
                function(err, result){
                    if(err)
                    {
                        notify.error('Error Communicating with Server');
                    }
                    
                    if(result.error) {
                        notify.error(result.error);
                    }
                    else {
                        notify.log('User Deleted from Project');
                    }
                    
                    Project.getUsers(function(err, users){
                        $scope.users = users;
                    });
                });
            });
        };
    })
;
