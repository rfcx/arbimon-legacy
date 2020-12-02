angular.module('a2.srv.templates', ['a2.srv.project'])
.factory('a2Templates', function(Project, $http, notify) {
    return {
        getList: function(opts) {
            var projectName = Project.getUrl();
            var config = {
                params: {}
            };
            if (opts && opts.firstByDateCreated) {
                config.params.firstByDateCreated = opts.firstByDateCreated;
            }
            if (opts && opts.showRecordingUri) {
                config.params.showRecordingUri = opts.showRecordingUri;
            }
            if (opts && opts.showOwner) {
                config.params.showOwner = opts.showOwner;
            }
            if (opts && opts.allAccessibleProjects) {
                config.params.allAccessibleProjects = opts.allAccessibleProjects;
            }
            return $http.get('/api/project/'+projectName+'/templates', config).then(function(response) {
                return response.data;
            });
        },

        add: function(template_data) {
            var projectName = Project.getUrl();
            return $http.post('/api/project/'+projectName+'/templates/add', template_data).then(function(response) {
                return response.data;
            }).catch(notify.serverError);
        },

        getAudioUrlFor: function(template){
            return '/api/project/' + Project.getUrl() + '/templates/' + template.id + '/audio';
        },

        // edit: function(templateId, template_data) {
        //     var projectName = Project.getUrl();
        //     return $http.post('/api/project/'+projectName+'/templates/edit/'+templateId, template_data);
        // },
        //
        delete: function(templateId) {
            var projectName = Project.getUrl();
            return $http.post('/api/project/'+projectName+'/templates/' + templateId + '/remove');
        },

        getImage: function(templateId) {
            var projectName = Project.getUrl();
            return $http.get('/api/project/'+projectName+'/templates/data/'+templateId+'/image').then(function(response) {
                return response.data;
            });
        },

    };
})
;
