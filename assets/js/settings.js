angular.module('a2.settings',[
    'a2.services', 
    'a2.directives', 
    'a2.forms',
    'a2.orders',
    'a2.permissions',
    'ui.bootstrap',
    'ui.router',
    'ct.ui.router.extras',
    'humane',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/settings", "/settings/details");
    
    var accessCheck = function(a2UserPermit) {
        return a2UserPermit.can("manage project settings");
    };
    
    $stateProvider.state('settings', {
        url: '/settings',
        templateUrl: '/partials/settings/index.html',
        allowAccess: accessCheck
    })
    .state('settings.details', {
        url: '/details',
        controller:'SettingsDetailsCtrl',
        templateUrl: '/partials/settings/details.html',
        allowAccess: accessCheck
    })
    .state('settings.users', {
        url: '/users',
        controller:'SettingsUsersCtrl',
        templateUrl: '/partials/settings/users.html',
        allowAccess: accessCheck
    });
})
.controller('SettingsDetailsCtrl', function($scope, Project, notify, $window, $timeout, a2order) {
    Project.getInfo(function(info) {
        $scope.project = info;
    });
    
    Project.getUsage().success(function(usage) {
        $scope.minUsage = usage.min_usage;
        console.log(usage);
        console.log($scope.minUsage);
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
    
    $scope.changePlan = function() {
        var modalInstance = a2order.changePlan({});
    };
})
.controller('SettingsUsersCtrl', function($scope, $http, Project, $modal, notify) {

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
                if(err) {
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
