angular.module('a2-models-service', [
    'a2-project-service',
    'humane'
])
.factory('a2Models', function($http, Project, notify) {
    return {
        list: function(callback) {
            $http.get( '/api/project/' + Project.getUrl() + '/models')
                .success(callback)
                .error(notify.serverError);
        },
        getFormInfo: function(callback) {
            $http.get( '/api/project/' + Project.getUrl() + '/models/forminfo')
                .success(callback)
                .error(notify.serverError);
        },
        findById: function(modelId, callback) {
            $http.get( '/api/project/' + Project.getUrl() + '/models/' + modelId)
                .success(callback)
                .error(notify.serverError);
        },
        create: function(modelData) {
            return $http.post('/api/project/' + Project.getUrl() + '/models/new', modelData);
        },
        delete: function(modelId, callback) {
            $http.get( '/api/project/' + Project.getUrl() + '/models/' + modelId + "/delete")
                .success(callback)
                .error(notify.serverError);
        },
        getValidationResults: function(modelId, callback) {
            $http.get( '/api/project/' + Project.getUrl() + '/models/' + modelId + '/validation-list/')
                .success(callback)
                .error(notify.serverError);
        },
        setThreshold: function(modelId, thresholdValue) {
            var data = {
                m: modelId,
                t: thresholdValue
            };
            
            return $http.post('/api/project/' + Project.getUrl() + '/models/savethreshold', data);
        }
    };
})
;
