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
        getMatchesFor: function(patternMatchingId, limit, offset) {
            return $http.get('/api/project/' + Project.getUrl() + '/pattern_matchings/' + patternMatchingId + '/matches/' + (offset||0) + '_' + (limit||0)).then(function(response){
                return response.data;
            });
        },
        create: function(classificationData, callback) {
            // $http.post('/api/project/'+Project.getUrl()+'/classifications/new', classificationData)
            //     .success(callback)
            //     .error(notify.serverError);
        },
        delete: function(classificationId, callback) {
            // $http.get('/api/project/' + Project.getUrl() + '/classifications/' + classificationId + '/delete')
            //     .success(callback)
            //     .error(notify.serverError);
        },
    };
})
;
