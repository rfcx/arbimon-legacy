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
            return $http.get('/api/project/'+Project.getUrl()+'/pattern_matchings').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getDetailsFor: function(patternMatchingId) {
            return $http.get('/api/project/' + Project.getUrl() + '/pattern_matchings/' + patternMatchingId + '/details').then(function(response){
                return response.data;
            });
        },
        getRoisFor: function(patternMatchingId, limit, offset) {
            return $http.get('/api/project/' + Project.getUrl() + '/pattern_matchings/' + patternMatchingId + '/rois/' + (offset||0) + '_' + (limit||0)).then(function(response){
                return response.data;
            });
        },
        validateRois: function(patternMatchingId, rois, validation) {
            return $http.post('/api/project/' + Project.getUrl() + '/pattern_matchings/' + patternMatchingId + '/validate', {
                rois: rois,
                validation: validation,
            }).then(function(response){
                return response.data;
            });
        },
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/pattern_matchings/new', data).then(function(response){
                return response.data;
            });
        },
        delete: function(classificationId, callback) {
            // $http.get('/api/project/' + Project.getUrl() + '/classifications/' + classificationId + '/delete')
            //     .success(callback)
            //     .error(notify.serverError);
        },
    };
})
;
