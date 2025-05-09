angular.module('a2.srv.models', [
    'a2.srv.project',
    'humane'
])
.factory('a2Models', function($http, Project, notify) {
    var saveData = null;
    var openedModel = false;
    
    return {
        modelState : function(s) {
            openedModel = s;
        },
        isModelOpen : function() {
            return openedModel;
        },
        saveState : function(data) {
            saveData = data;
        },
        getState : function() {
            return saveData;
        },
        list: function(callback) {
            $http.get( '/legacy-api/project/' + Project.getUrl() + '/models')
                .success(callback)
                .error(notify.serverError);
        },
        getFormInfo: function(callback) {
            $http.get( '/legacy-api/project/' + Project.getUrl() + '/models/forminfo')
                .success(callback)
                .error(notify.serverError);
        },
        findById: function(modelId) {
            return $http.get( '/legacy-api/project/' + Project.getUrl() + '/models/' + modelId);
        },
        create: function(modelData) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/models/new', modelData);
        },
        shareModel: function(modelData) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/models/share-model', modelData)
        },
        delete: function(modelId, callback) {
            $http.get( '/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + "/delete")
                .success(callback)
                .error(notify.serverError);
        },
        getValidationResults: function(modelId, options, callback) {
            var query = Object.keys(options || {}).map(function(option){
                return option + '=' + encodeURIComponent(options[option]);
            }).join('&');
            $http.get( '/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + '/validation-list?' + query)
                .success(callback)
                .error(notify.serverError);
        },
        getRecVector: function(modelId, recId, callback) {
            return $http.get( '/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + '/training-vector/' + recId);
        },
        getModelRetrainingDates: function(modelId, jobId) {
            const config = {
                params: { jobId: jobId }
            };
            return $http.get( '/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + '/retraining', config);
        },
        getSharedModels: function(modelId, modelName) {
            const config = {
                params: { modelName: modelName }
            };
            return $http.get( '/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + '/shared', config);
        },
        unshareModel: function(modelId, modelData) {
            const data = {
                model: modelData.modelId,
                project: modelData.projectId
            };
            return $http.post( '/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + '/unshare', data);
        },
        setThreshold: function(modelId, thresholdValue) {
            var data = {
                m: modelId,
                t: thresholdValue
            };
            
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/models/savethreshold', data);
        }
    };
})
;
