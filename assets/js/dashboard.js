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
                var map = $scope.map = $window.L.map('summary-map', { zoomControl: false }).setView([10, -20], 1);
                L.control.zoom({ position: 'topright'}).addTo($scope.map);
                
                $window.L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
                
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
                        
                        $window.L.marker([site.lat, site.lon]).addTo(map)
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
                    return notify.serverError();
                }
                
                if(result.error) {
                    return notify.error(result.error);
                }
                
                notify.log('Project info updated');
                
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
                    notify.serverError();
                }
                
                if(result.error) {
                    notify.error(result.error);
                }
                else {
                    notify.log('User added to project');
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
                    notify.serverError();
                }
                
                if(result.error) {
                    notify.error(result.error);
                }
                else {
                    notify.log('User role updated');
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
                        notify.serverError();
                    }
                    
                    if(result.error) {
                        notify.error(result.error);
                    }
                    else {
                        notify.log('User deleted from project');
                    }
                    
                    Project.getUsers(function(err, users){
                        $scope.users = users;
                    });
                });
            });
        };
    })
;
