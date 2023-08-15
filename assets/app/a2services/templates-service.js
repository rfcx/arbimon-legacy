angular.module('a2.srv.templates', ['a2.srv.project'])
.factory('a2Templates', function(Project, $http, notify) {
    return {
        getList: function(opts) {
            var projectName = Project.getUrl();
            var config = {
                params: {}
            };
            if (opts && opts.showRecordingUri) {
                config.params.showRecordingUri = opts.showRecordingUri;
            }
            if (opts && opts.projectTemplates) {
                config.params.projectTemplates = opts.projectTemplates;
            }
            if (opts && opts.publicTemplates) {
                config.params.publicTemplates = opts.publicTemplates;
            }
            if (opts && opts.q) {
                config.params.q = opts.q;
            }
            if (opts && opts.limit) {
                config.params.limit = opts.limit;
            }
            if (opts && opts.offset !== undefined) {
                config.params.offset = opts.offset;
            }
            return $http.get('/api/project/'+projectName+'/templates', config).then(function(response) {
                return response.data;
            });
        },

        count: function(opts) {
            var config = {
                params: {}
            };
            if (opts && opts.publicTemplates) {
                config.params.publicTemplates = opts.publicTemplates;
            }
            return $http.get('/api/project/' + Project.getUrl() + '/templates/count', config)
                .then(function(response){
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
            return '/api/project/' + Project.getUrl() + '/templates/audio/' + template.id + template.recExt;
        },

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
