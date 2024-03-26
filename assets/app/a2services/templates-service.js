angular.module('a2.srv.templates', ['a2.srv.project'])
.factory('a2Templates', function(Project, $http, notify) {
    return {
        getList: function(opts) {
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
            if (opts && opts.taxon) {
                config.params.taxon = opts.taxon;
            }
            if (opts && opts.limit) {
                config.params.limit = opts.limit;
            }
            if (opts && opts.offset !== undefined) {
                config.params.offset = opts.offset;
            }
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/templates', config).then(function(response) {
                return response.data;
            });
        },

        getTemplatesByClass: function(opts) {
            const config = {
                params: opts
            };
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/templates/class', config).then(function(response) {
                return response.data;
            }).catch(notify.serverError);
        },

        count: function(opts) {
            var config = {
                params: {}
            };
            if (opts && opts.publicTemplates) {
                config.params.publicTemplates = opts.publicTemplates;
            }
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/templates/count', config)
                .then(function(response){
                    return response.data;
                });
        },

        add: function(template_data) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/templates/add', template_data).then(function(response) {
                return response.data;
            }).catch(notify.serverError);
        },

        getAudioUrlFor: function(template){
            const ext = '.mp3'
            return '/legacy-api/project/' + Project.getUrl() + '/templates/audio/' + template.id + ext;
        },

        delete: function(templateId) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/templates/' + templateId + '/remove');
        },

        getImage: function(templateId) {
            return $http.get('/legacy-api/project/' + Project.getUrl() + '/templates/data/' + templateId + '/image').then(function(response) {
                return response.data;
            });
        }
    };
})
;
