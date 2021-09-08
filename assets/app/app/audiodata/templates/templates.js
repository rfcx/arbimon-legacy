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
.controller('TemplatesCtrl', function($state, $scope, a2Templates, Project, $q, a2UserPermit, notify, $modal, $window, a2AudioBarService) {
    var self = this;
    Object.assign(this, {
        initialize: function(){
            this.loading = false;
            this.templates = [];
            this.getList();
            this.projecturl = Project.getUrl();
            this.currentTab = 'showOwner';
        },
        goToSourceProject: function(projectId) {
            if (!projectId) return;
            Project.getProjectById(projectId, function(data) {
                if (data) {
                    $window.location.pathname = "/project/"+data.url+"/audiodata/templates";
                }
            });
        },
        getList: function() {
            self.loading = true;
            return a2Templates.getList({ showOwner: true, showRecordingUri: true, firstByDateCreated: true }).then((function(data){
                self.loading = false;
                self.templates = data;
            }.bind(this))).catch((function(err){
                self.loading = false;
                notify.serverError(err);
            }).bind(this));
        },
        getTemplateVisualizerUrl: function(template){
            var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
            return template ? "/project/"+template.project_url+"/#/visualizer/rec/"+template.recording+"?a="+box : '';
        },
        deleteTemplate: function(templateId){
            if(!a2UserPermit.can('manage templates')) {
                notify.log('You do not have permission to delete templates');
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
        importTemplates: function(access) {
            self.currentTab = access;
            var opts = {
                showRecordingUri: true,
            }
            opts[access] = true;
            self.loading = true;
            a2Templates.getList(opts).then(function(data){
                self.loading = false;
                self.templates = data;
            }).catch((function(err){
                self.loading = false;
                self.templates = [];
                notify.serverError(err);
            }));
        },
        addTemplate: function(template) {
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
                if (template.id === 0) notify.error('The template already exists in the project templates.');
                else if (template.error) notify.error('You do not have permission to manage templates');
                else notify.log('The template is added to the project.');
            })).catch((function(err){
                console.log('err', err);
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
