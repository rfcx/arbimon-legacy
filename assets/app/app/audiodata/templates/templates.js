angular.module('a2.audiodata.templates', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane'
])
.config(function($stateProvider) {
    $stateProvider.state('audiodata.templates', {
        url: '/templates',
        controller: 'TemplatesCtrl as controller',
        templateUrl: '/app/audiodata/templates/templates.html'
    });
})
.controller('TemplatesCtrl', function($state, $scope, a2Templates, Project, $q, a2UserPermit, notify, $modal) {
    var self = this;
    Project.getInfo(function(data) {
        $scope.projectData = data;
    });
    Object.assign(this, {
        initialize: function(){
            this.loading = false;
            this.templates = [];
            this.getList();
            this.projecturl = Project.getUrl();
        },
        getTemplateVisualizerUrl: function(template){
            var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',')
            return template ? "/project/"+this.projecturl+"/#/visualizer/rec/"+template.recording+"?a="+box : '';
        },
        getList: function(){
            self.loading = true;
            return a2Templates.getList({ showOwner: true, showRecordingUri: true }).then((function(data){
                self.loading = false;
                self.templates = data;
            }.bind(this)));
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
        importTemplates: function() {
            self.loading = true;
            a2Templates.getList({ allAccessibleProjects: true, showOwner: true, showRecordingUri: true }).then(function(data){
                self.loading = false;
                self.templates = data;
            });
        },
    });
    this.initialize();
})
;
