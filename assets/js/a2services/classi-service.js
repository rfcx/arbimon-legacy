angular.module('a2.srv.classi', [
    'a2.srv.project',
    'humane'
])
.factory('a2Classi', function($http, Project, notify) {
    var saveData = null;
    return {
        saveState : function(data) {
            saveData = data;
        },
        getState : function() {
            return saveData;
        },
        list: function(callback) {
            $http.get('/api/project/'+Project.getUrl()+'/classifications')
                .success(callback)
                .error(notify.serverError);
        },
        getDetails: function(classificationId, callback) {
            $http.get('/api/project/' + Project.getUrl() + '/classifications/' + classificationId)
                .success(callback)
                .error(notify.serverError);
        },
        getResultDetails: function(classificationId, first, limit, callback) {
            $http.get('/api/project/'+ Project.getUrl() +'/classifications/'+classificationId+'/more/'+ first + '/' + limit)
                .success(callback)
                .error(notify.serverError);
        },
        getRecVector: function(classificationId, recId) {
            return $http.get('/api/project/'+Project.getUrl()+'/classifications/'+classificationId+'/vector/'+recId);
        },
        create: function(classificationData, callback) {
            $http.post('/api/project/'+Project.getUrl()+'/classifications/new', classificationData)
                .success(callback)
                .error(notify.serverError);
        },
        delete: function(classificationId, callback) {
            $http.get('/api/project/' + Project.getUrl() + '/classifications/' + classificationId + '/delete')
                .success(callback)
                .error(notify.serverError);
        },
    };
})
;
