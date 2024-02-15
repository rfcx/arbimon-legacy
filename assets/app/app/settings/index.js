angular.module('a2.settings',[
    'a2.services',
    'a2.directives',
    'a2.forms',
    'a2.orders',
    'a2.permissions',
    'a2.directive.sidenav-bar',
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
        templateUrl: '/app/settings/index.html',
        allowAccess: accessCheck
    })
    .state('settings.details', {
        url: '/details',
        controller:'SettingsDetailsCtrl',
        templateUrl: '/app/settings/details.html',
        allowAccess: accessCheck
    })
    .state('settings.users', {
        url: '/users',
        controller:'SettingsUsersCtrl',
        templateUrl: '/app/settings/users.html',
        allowAccess: accessCheck
    });
})
.controller('SettingsDetailsCtrl', function($scope, Project, notify, $window, $timeout, a2order, a2UserPermit, $modal) {
    $scope.today = new Date();

    Project.getInfo(function(info) {
        if(info.plan_activated && info.plan_period) {
            info.plan_due = new Date(info.plan_activated);
            info.plan_due.setFullYear(info.plan_due.getFullYear()+info.plan_period);
        }

        $scope.project = info;
    });

    Project.getUsage().success(function(usage) {
        $scope.minUsage = usage.min_usage;
    });

    $scope.save = function() {
        console.log($scope);
        if(!$scope.isValid)  return;

        if (!$scope.project.description) {
            $scope.project.description = ''
        }

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

    $scope.deleteProject = function() {
        if(!a2UserPermit.can('delete project')) {
            notify.error('You do not have permission to delete this project');
            return;
        }

        $scope.popup = {
            title: 'Delete project',
            messages: ['Are you sure you want to delete this project?'],
            btnOk: 'Yes',
            btnCancel: 'No',
        };

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            scope: $scope
        });

        modalInstance.result.then(function() {
            return Project.removeProject({ external_id: $scope.project.external_id })
                .then(function() {
                    notify.log('Project deleted');
                    $window.location.href = '/my-projects';
                });
        });
    }

    $scope.changePlan = function() {
        var modalInstance = a2order.changePlan({});
    };
})
.controller('SettingsUsersCtrl', function($scope, $http, Project, $modal, notify) {
    $scope.userToAdd = '';
    $scope.curQuery = ''

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
        $scope.curQuery = query
        return $http.get('/legacy-api/user/search/'+ query).then(function(response) { return response.data; });
    };

    $scope.inviteUser = function(data) {
        return $http.post('/legacy-api/user/invite', data).then(function(response) { return response.data; });
    };

    $scope.add = function() {
        if (!$scope.userToAdd) {
            return;
        }

        Project.addUser({
            project_id: $scope.project.project_id,
            user_id: $scope.userToAdd.id,
            user_email: $scope.userToAdd.email
        },
        function (err) {
            if (err) {
                notify.error(err);
            } else {
                $scope.curQuery = ''
                notify.log('User added to project');
            }

            Project.getUsers(function(err, users){
                $scope.users = users;
            });
        });
    };

    $scope.invite = function () {
        $scope.showInvitationPopup($scope.curQuery)
    }

    $scope.showInvitationPopup = function (email) {
        var modalInstance = $modal.open({
            templateUrl: '/app/settings/invitation.html',
            controller: 'UserInvitationCtrl as controller',
            resolve: {
                email: function() { return email },
                inviteUser: function() { return $scope.inviteUser }
            }
        });
        modalInstance.result.then(function (user) {
            $scope.noResults = false
            $scope.userToAdd = user
            $scope.userToAdd.id = user.user_id
            $scope.add()
        });
    };

    $scope.changeRole = function($index) {

        var role = $scope.roles.filter(function(value){
            return $scope.users[$index].rolename === value.name;
        })[0];

        Project.changeUserRole({
            project_id: $scope.project.project_id,
            user_id: $scope.users[$index].id,
            user_email: $scope.users[$index].email,
            role_id: role.id
        },
        function (err) {
            if (err) {
                notify.error(err);
            } else {
                notify.log('User role updated');
            }
            Project.getUsers(function(err, users){
                $scope.users = users;
            });
        });
    };

    const message = ['Are you sure you would like to remove the following user from this project?'];

    $scope.del = function($index) {
        const user = $scope.users[$index]
        $scope.popup = {
            messages : message.concat(user.firstname + ' ' + user.lastname + ' ' + '(' + user.email + ')'),
            btnOk: "Delete",
            btnCancel: "Cancel",
        };

        var modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            scope: $scope
        });

        modalInstance.result.then(function() {
            Project.removeUser({
                project_id: $scope.project.project_id,
                user_id: $scope.users[$index].id,
                user_email: $scope.users[$index].email
            },
            function (err) {
                if (err) {
                    notify.error(err);
                } else {
                    notify.log('User deleted from project');
                }
                Project.getUsers(function(err, users){
                    $scope.users = users;
                });
            });
        });
    };
})
.controller('UserInvitationCtrl', function($modalInstance, notify, email, inviteUser) {
    Object.assign(this, {
        initialize: function() {
            this.isLoading = false;
            this.data = {
                email: email,
                firstname: '',
                lastname: ''
            };
        },
        submit: function () {
            try {
                this.isLoading = true;
                return inviteUser(this.data)
                    .then(function(user) {
                        $modalInstance.close(user);
                    })
                    .catch(notify.serverError)
                    .finally(() => {
                        this.isLoading = false
                    });
            } catch(error) {
                console.error('UserInvitationCtrl.submit error: ', error);
            }
        },
        cancel: function () {
            $modalInstance.close(null);
        },
        isDataValid: function () {
            return this.data.email.trim().length > 0 && this.data.firstname.trim().length > 0 && this.data.lastname.trim().length > 0;
        }
    });
    this.initialize();
})
