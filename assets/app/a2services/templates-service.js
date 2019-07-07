angular.module('a2.srv.templates', ['a2.srv.project'])
.factory('a2Templates', function(Project, $http) {
    return {
        getList: function() {
            var projectName = Project.getUrl();
            return $http.get('/api/project/'+projectName+'/templates').then(function(response) {
                return response.data;
            });
        },

        add: function(template_data) {
            var projectName = Project.getUrl();
            return $http.post('/api/project/'+projectName+'/templates/add', template_data).then(function(response) {
                return response.data;
            });
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
