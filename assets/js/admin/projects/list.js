angular.module('a2.admin.projects.list', [
    'ui.router', 
    'ui.bootstrap', 
    'a2.utils',
    'a2.services',
    'templates-arbimon2',
    'humane',
    'ui.select',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('projects.list', {
            url: '',
            controller:'AdminProjectsListCtrl',
            templateUrl: '/partials/admin/projects/list.html'
        });

})
.controller('AdminProjectsListCtrl', function($scope, $q, notify, AdminProjectsListService) {
    $scope.loadProject = function() {
        return AdminProjectsListService.getList().then(function(data) {
            $scope.projects = data;
        });
    };
        
    $scope.getProjectInfo = function(project) {
        return $q.all([
            AdminProjectsListService.getProjectInfo(project),
            AdminProjectsListService.getProjectSites(project),
            AdminProjectsListService.getProjectRecordingCount(project),
        ]).then(function(all){
            $scope.currentProject = all[0];
            $scope.sites = all[1];
            $scope.recCount = all[2];
        });
    };
    
    $scope.updateProject = function() {
        return AdminProjectsListService.updateProject($scope.currentProject).then(function(data) {
            $scope.loadProject();
            notify.log('project updated');
        }).catch(function(err) {
            notify.error(err);
        });
    };
    
    $scope.closeProjectInfo = function() {
        $scope.currentProject = null;
    };
    
    $scope.loadProject();
})
.service('AdminProjectsListService', function($http){
    return {
        getList : function() {
            return $http.get('/admin/projects').then(function(response){
                return response.data;
            });
        },
            
        getProjectInfo : function(project) {
            return $http.get('/api/project/'+project.url+'/info').then(function(response){
                var data = response.data;
                data.is_enabled = !!data.is_enabled;
                return data;
            });
        },

        getProjectSites : function(project) {
            return $http.get('/api/project/'+project.url+'/sites').then(function(response) {
                return response.data;
            });
        },
            
        getProjectRecordingCount : function(project) {
            return $http.get('/api/project/'+project.url+'/recordings/count').then(function(response) {
                return response.data.count;
            });
        },
        
        updateProject : function(project) {
            return $http.put('/admin/projects/' + project.project_id, {
                project: project
            }).then(function(response){
                return response.data;
            });
        },
    };
})
;
