angular.module('a2.admin.projects.list', [
    'ui.router',
    'ui.bootstrap',
    'a2.utils',
    'a2.services',
    'templates-arbimon2',
    'a2.orders.directives.tier-select',
    'humane',
    'ui.select',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('projects.list', {
            url: '',
            controller:'AdminProjectsListCtrl as controller',
            templateUrl: '/admin/projects/list.html'
        })
        .state('projects.list.detail', {
            url: '/:url',
            views: {
                'detail': {
                    templateUrl: '/admin/projects/list-detail.html',
                    controller: 'AdminProjectsListDetailCtrl as controller'
                }
            },
        });

})
.controller('AdminProjectsListCtrl', function($scope, $state, AdminProjectsListService) {
    this.initialize = function(){
        AdminProjectsListService.getList().then((function(data) {
            this.projects = data;
            if($state.params.url){
                var url = $state.params.url;
                this.selected = this.projects.reduce(function(_, project){
                    return project.url == url ? project : _;
                }, null);
            }
        }).bind(this));

    };

    this.select = function(project) {
        return $state.go('projects.list.detail', {url:project.url});
    };

    this.notifyProjectUpdated = function(project) {
        var projectObject = this.projects.reduce(function(_, p, $index){
            return p.project_id == project.project_id ? project : _;
        }, null);

        angular.merge(projectObject, project);
    };

    this.initialize();
})
.controller('AdminProjectsListDetailCtrl', function($scope, $state, $q, notify, AdminProjectsListService) {
    this.initialize= function(){
        console.log("$state", $state);
        this.setProject({url:$state.params.url});
    };

    this.setProject = function(projectData) {
        return $q.all([
            AdminProjectsListService.getProjectInfo(projectData),
            AdminProjectsListService.getProjectSites(projectData),
            AdminProjectsListService.getProjectRecordingCount(projectData),
        ]).then((function(all){
            this.project = all[0];
            this.project.is_enabled = this.project.is_enabled | 0;
            this.sites = all[1];
            this.recCount = all[2];
        }).bind(this));
    };

    this.close = function() {
        $state.go('projects.list');
    };

    this.save = function(){
        return AdminProjectsListService.updateProject(this.project).then((function(project){
            this.project = project;
            notify.log("Project " + project.name + " info updated.");
        }).bind(this)).catch(function(err){
            notify.error(err);
        });
    };

    this.handleAedToggle = function () {
        this.project.clustering_enabled = this.project.aed_enabled
    }

    this.initialize();
})
.service('AdminProjectsListService', function($http){
    return {
        getList : function() {
            return $http.get('/admin/projects').then(function(response){
                return response.data;
            });
        },

        getProjectInfo : function(project) {
            return $http.get('/legacy-api/project/'+project.url+'/info').then(function(response){
                var data = response.data;
                data.is_enabled = !!data.is_enabled;
                return data;
            });
        },

        getProjectSites : function(project) {
            return $http.get('/legacy-api/project/'+project.url+'/sites').then(function(response) {
                return response.data;
            });
        },

        getProjectRecordingCount : function(project) {
            return $http.get('/legacy-api/project/'+project.url+'/recordings/count').then(function(response) {
                return response.data.count;
            });
        },

        updateProject : function(project) {
            var projectData = {
                project_id : project.project_id,
                name : project.name,
                url : project.url,
                description : project.description,
                project_type_id : project.project_type_id,
                is_private : project.is_private,
                is_enabled : project.is_enabled,
                current_plan : project.current_plan,
                storage_usage : project.storage_usage,
                processing_usage : project.processing_usage,
                citizen_scientist_enabled : !!project.citizen_scientist_enabled,
                cnn_enabled : !!project.cnn_enabled,
                pattern_matching_enabled : !!project.pattern_matching_enabled,
                aed_enabled : !!project.aed_enabled,
                clustering_enabled : !!project.clustering_enabled,
                reports_enabled : !!project.reports_enabled,
                plan : {
                    tier: project.tier,
                    storage: project.storage_limit,
                    processing: project.processing_limit,
                    activation: project.plan_activated,
                    duration_period: project.plan_period
                }
            };
            return $http.put('/admin/projects/' + project.project_id, {
                project: projectData
            }).then(function(response){
                return response.data;
            });
        },
    };
})
;
