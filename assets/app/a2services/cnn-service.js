angular.module('a2.srv.cnn', [
    'a2.srv.project',
    'humane'
])
.factory('a2CNN', function($q, $http, Project, notify) {
    var saveData = null;

    return {
        listROIs: function (job_id, callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/cnn/rois/'+job_id).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        listResults: function (job_id, callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/cnn/results/'+job_id).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        listModels: function(callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/cnn/models').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        saveState : function(data) {
            saveData = data;
        },
        getState : function() {
            return saveData;
        },
        list: function(callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/cnn').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getDetailsFor: function(cnnId) {
            return $http.get('/api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/details').then(function(response){
                return response.data;
            });
        },
        getRoisFor: function(cnnId, limit, offset) {
            return $http.get('/api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/rois/' + (offset||0) + '_' + (limit||0)).then(function(response){
                return response.data;
            });
        },
        getExportUrl: function(params){
            return '/api/project/' + Project.getUrl() + '/cnn/' + params.patternMatching + '/rois.csv';
        },
        getAudioUrlFor: function(roi){
            return '/api/project/' + Project.getUrl() + '/cnn/' + roi.pattern_matching_id + '/audio/' + roi.id;
        },
        validateRois: function(cnnId, rois, validation) {
            return $http.post('/api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/validate', {
                rois: rois,
                validation: validation,
            }).then(function(response){
                return response.data;
            });
        },
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/cnn/new', data).then(function(response){
                return response.data;
            });
        },
        delete: function(cnnId) {
            return $http.post('/api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/remove').then(function(response){
                return response.data;
            });
        },
    };
})
;
