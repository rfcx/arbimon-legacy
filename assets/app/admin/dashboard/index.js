angular.module('a2.admin.dashboard', [
    'ui.router', 
    'ui.bootstrap', 
    'a2.utils',
    'a2.services',
    'a2.directives',
    'templates-arbimon2',
    'humane',
    'ui.select',
    'a2.admin.dashboard.data-service',
    'a2.admin.dashboard.plotter-controller',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise("/dashboard");
    
    $stateProvider
        .state('dashboard', {
            url: '/dashboard',
            controller:'AdminDashboardCtrl',
            templateUrl: '/admin/dashboard/index.html'
        });
})
.controller('AdminDashboardCtrl', function($scope, $http, $q, $controller) {
    
    $scope.plots = $controller('AdminDashboardPlotterController', {'$scope':$scope});
    
    $http.get('/admin/dashboard-stats')
        .success(function(data) {
            $scope.newUsers = data.newUsers;
            $scope.newProjects = data.newProjects;
            $scope.Jobs = data.jobsStatus;
        });
    
    $scope.getSystemSettings = function() {
        $http.get('/admin/system-settings')
            .success(function(data) {
                $scope.settings = data;
            });
    };
    $scope.getSystemSettings();

    $scope.setSetting = function(setting, value){
        var d=$q.defer();
        
        if(!setting){
            d.resolve();
        } else {        
        $http.put('/admin/system-settings', {
                setting: setting,
                value: value
            })
            .success(function(data) {
                $scope.getSystemSettings();
                d.resolve(data[setting]);
            })
            .error(function(data) {
                console.error(data);
                $scope.getSystemSettings();
                d.reject(data);
            });
        }
        return d.promise;
    };
    
    $scope.toggleSetting = function(setting) {
        var value = $scope.settings[setting] == 'on' ? 'off' : 'on';
        return this.setSetting(setting, value);
    };
})
;
