angular.module('a2.audiodata.templates', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'a2.srv.templates',
    'a2.directive.audio-bar',
    'a2.visualizer.audio-player',
    'humane'
])
.config(function($stateProvider) {
    $stateProvider.state('audiodata.templates', {
        url: '/templates',
        controller: 'TemplatesCtrl as controller',
        templateUrl: '/app/audiodata/templates/templates.html'
    });
})
.controller('TemplatesCtrl', function($scope, a2Templates, Project, $q, a2UserPermit, notify, $modal, $window, a2AudioBarService) {
    var self = this;
    Object.assign(this, {
        initialize: function(){
            this.loading = false;
            this.isAdding = false;
            this.templates = [];
            this.currentTab = 'projectTemplates';
            this.pagination = {
                page: 1,
                limit: 100,
                offset: 0,
                totalItems: 0,
                totalPages: 0
            }
            this.projecturl = Project.getUrl();
            this.search = { q: '' };
            this.getList();
            this.timeout;
        },
        goToSourceProject: function(projectId) {
            if (!projectId) return;
            Project.getProjectById(projectId, function(data) {
                if (data) {
                    $window.location.pathname = "/project/"+data.url+"/audiodata/templates";
                }
            });
        },
        setCurrentPage: function() {
            self.pagination.offset = self.pagination.page - 1;
            this.getList();
        },
        getList: function() {
            self.loading = true;
            const opts = { 
                showRecordingUri: true,
                q: self.search.q,
                limit: self.pagination.limit,
                offset: self.pagination.offset * self.pagination.limit
            }
            opts[self.currentTab] = true
            return a2Templates.getList(opts).then((function(data){
                self.loading = false;
                self.templates = data.list;
                self.pagination.totalItems = data.count;
                self.pagination.totalPages = Math.ceil(self.pagination.totalItems / self.pagination.limit);
            }.bind(this))).catch((function(err){
                self.loading = false;
                self.templates = [];
                notify.serverError(err);
            }).bind(this));
        },
        onSearchChanged: function () {
            clearTimeout(self.timeout);
            self.timeout = setTimeout(() => {
                if (self.search.q.trim().length > 0 && self.search.q.trim().length < 3) return
                this.reloadPage()
            }, 1000);
        },
        reloadPage: function () {
            this.resetPagination();
            this.getList();
        },
        getTemplateVisualizerUrl: function(template){
            const box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
            return template ? "/project/"+template.project_url+"/#/visualizer/rec/"+template.recording+"?a="+box : '';
        },
        deleteTemplate: function(templateId){
            if(!a2UserPermit.can('manage templates')) {
                notify.error('You do not have permission to delete templates');
                return;
            }

            $scope.popup = {
                title: 'Delete template',
                messages: ['Are you sure you want to delete this template?'],
                btnOk: 'Yes',
                btnCancel: 'No',
            };

            var modalInstance = $modal.open({
                templateUrl: '/common/templates/pop-up.html',
                scope: $scope
            });

            modalInstance.result.then(function(confirmed) {
                if(confirmed){
                    return a2Templates.delete(templateId).then(function(){
                        self.getList();
                    });
                }
            });

        },
        toggleTab: function(access) {
            self.currentTab = access;
            this.reloadPage()
        },
        resetPagination: function() {
            self.pagination = {
                page: 1,
                limit: 100,
                offset: 0,
                totalItems: 0,
                totalPages: 0
            }
        },
        addTemplate: function(template) {
            self.isAdding = true
            a2Templates.add({
                name : template.name,
                recording : template.recording,
                species : template.species,
                songtype : template.songtype,
                roi : {
                    x1: template.x1,
                    y1: template.y1,
                    x2: template.x2,
                    y2: template.y2,
                },
                source_project_id: template.project
            }).then((function(template){
                console.log('new template', template);
                self.isAdding = false
                if (template.id === 0) notify.error('The template already exists in the project templates.');
                else if (template.error) notify.error('You do not have permission to manage templates');
                else notify.log('The template is added to the project.');
            })).catch((function(err){
                console.log('err', err);
                self.isAdding = false
                notify.error(err);
            }));
        },
        playTemplateAudio: function(template, $event) {
            if ($event) {
                $event.preventDefault();
                $event.stopPropagation();
            };
            a2AudioBarService.loadUrl(a2Templates.getAudioUrlFor(template), true);
        }
    });
    this.initialize();
});
