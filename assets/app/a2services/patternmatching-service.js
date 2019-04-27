angular.module('a2.srv.patternmatching', [
    'a2.srv.project',
    'humane'
])
.factory('a2PatternMatching', function($q, $http, Project, notify) {
    var saveData = null;

    return {
        saveState : function(data) {
            saveData = data;
        },
        getState : function() {
            return saveData;
        },
        list: function(callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/pattern-matchings').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getDetailsFor: function(patternMatchingId) {
            return $http.get('/api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/details').then(function(response){
                return response.data;
            });
        },
        getRoisFor: function(patternMatchingId, limit, offset) {
            return $http.get('/api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/rois/' + (offset||0) + '_' + (limit||0)).then(function(response){
                return response.data;
            });
        },
        getExportUrl: function(params){
            return '/api/project/' + Project.getUrl() + '/pattern-matchings/' + params.patternMatching + '/rois.csv';
        },
        validateRois: function(patternMatchingId, rois, validation) {
            return $http.post('/api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/validate', {
                rois: rois,
                validation: validation,
            }).then(function(response){
                return response.data;
            });
        },
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/pattern-matchings/new', data).then(function(response){
                return response.data;
            });
        },
        delete: function(patternMatchingId) {
            return $http.post('/api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/remove').then(function(response){
                return response.data;
            });
        },
    };
})
;
