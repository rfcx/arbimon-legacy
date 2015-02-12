angular.module('dashboard',[
    'a2services', 
    'a2directives', 
    'ui.bootstrap',
    'ui.router',
    'ct.ui.router.extras',
    'a2forms',
    'humane'
])
.config(function($stickyStateProvider, $stateProvider, $urlRouterProvider) {

    // $urlRouterProvider.when("/dashboard", "/dashboard/summary");

    $stateProvider.state('dashboard', {
        url: '/dashboard',
        controller:'SummaryCtrl',
        templateUrl: '/partials/dashboard/index.html',
    })
    .state('dashboard.summary', {
        url: '/summary',
        templateUrl: '/partials/dashboard/summary.html'
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
.controller('SummaryCtrl', function($scope, Project, a2TrainingSets, $timeout,notify) {
    
    $scope.loading = true;

    Project.getInfo(function(info){
         $scope.project = info;
    });
    
    Project.getClasses(function(species){
        $scope.species = species;
    });
    
    Project.getModels(function(err, models){
        if(err)
        {
            notify.error('Error Communicating with Server');
        }
        
        $scope.modelsQty = models.length;
    });
    
    Project.getClassi(function(err, classi){
        if(err)
        {
            notify.error('Error Communicating with Server');
        }
        
        $scope.classiQty = classi.length;
    });
    
    Project.validationsCount(function(count){
        $scope.valsQty = count;
    });
    
    a2TrainingSets.getList(function(trainingSets){
        $scope.trainingSetsQty = trainingSets.length;
    });

    var mapOptions = {
        center: { lat: 18.3, lng: -66.5},
        zoom: 8
    };

    
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
        
        $timeout(function() {
        
            $scope.map = new google.maps.Map(document.getElementById('map-summary'), mapOptions);
            
            var bounds = new google.maps.LatLngBounds();
            
            for(var i in sites) {
                var position = new google.maps.LatLng(sites[i].lat,sites[i].lon);

                sites[i].marker = new google.maps.Marker({
                    position: position,
                    title: sites[i].name
                });

                bounds.extend(position);

                sites[i].marker.setMap($scope.map);
            }

            $scope.map.fitBounds(bounds);
            
        }, 50);
        
        $scope.loading = false;
    });

    Project.getRecTotalQty(function(count) {
        $scope.recsQty = count;
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
            
            if(result.url) {
                notify.log('Project Info Updated');
                $timeout(function() {
                    $window.location.assign('/project/'+ result.url +'/#/settings');
                }, 1000);
            }
        });
    };
})
.controller('UsersCtrl', function($scope, $http, Project, $modal,notify) {
    
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
            if(err)
            {
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
