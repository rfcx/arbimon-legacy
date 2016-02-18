angular.module('a2.admin.projects.codes', [
    'ui.router', 
    'a2.directives',
    'ui.bootstrap', 
    'a2.utils',
    'a2.services',
    'templates-arbimon2',
    'humane',
    'ui.select',
    'a2.admin.projects.list',
    'a2.admin.users.list',
])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('projects.codes', {
            url: '/codes',
            controller:'AdminProjectsCodesCtrl as controller',
            templateUrl: '/partials/admin/projects/codes.html'
        });
})
.controller('AdminProjectsCodesCtrl', function($modal, notify, LoaderFactory, AdminProjectsCodesService) {
    var loader = LoaderFactory.newInstance();
    this.loader = loader;
    
    this.createNewCode = function(){
        return $modal.open({
            templateUrl: '/partials/admin/projects/new-code-modal.html',
            resolve: {
                projectsList: function(AdminProjectsListService){
                    return AdminProjectsListService.getList();
                },
                usersList: function(AdminUsersListService){
                    return AdminUsersListService.getList();
                }
            },
            controller: function(projectsList, usersList) {
                this.projectsList = projectsList;
                this.usersList = usersList;
                this.data = {
                    lockToUser: undefined,
                    lockProject: undefined,
                    recordings: 10000,
                    processing: 1000000,
                    tieProcessingWithRecordings: true
                };
                this.computeProcessingAmount = function(){
                    if(this.data.tieProcessingWithRecordings){
                        this.data.processing = this.data.recordings * 100;
                    }
                };
                this.processingCountChanged = function(){
                    this.data.tieProcessingWithRecordings = false;
                };
            },
            controllerAs: 'popup'
        }).result.then(AdminProjectsCodesService.createNewCode).then((function(){
            loader.load(this, 'codes', AdminProjectsCodesService.loadCodes());
        }).bind(this));
    };
    // editSelectedCode
    // deleteSelectedCode

    loader.load(this, 'codes', AdminProjectsCodesService.loadCodes());
})
.service('AdminProjectsCodesService', function($http){
    return {
        loadCodes : function(){
            return $http.get('/admin/projects/codes').then(function(response) {
                return response.data;
            });
        },
        createNewCode : function(data){
            console.log("createNewCode", data);
            return $http.post('/admin/projects/codes', {
                user : data.lockToUser && data.lockToUser.id,
                project : data.lockProject && data.lockProject.id,
                recordings : data.recordings,
                processing : data.processing,
            }).then(function(data) {
                return data.response;
            });
        }
    };
})
.factory('LoaderFactory', function($q){
    function Loader(){
        this.loading={};
    }
    Loader.prototype = {
        load: function(valueStore, key, promise){
            this.loading[key] = true;
            return promise.then((function(value){
                this.loading[key] = false;
                if(valueStore){
                    valueStore[key] = value;
                }
                return value;
            }).bind(this), (function(err){
                this.loading[key] = false;
                throw err;
            }).bind(this));
        }
    };
    return {
        newInstance: function(){
            return new Loader();
        }
    };
})
;
