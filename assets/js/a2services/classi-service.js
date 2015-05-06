angular.module('a2-classi-service', [
    'a2-project-service',
    'humane'
])
.factory('a2Classi', function($http, Project, notify) {
    var saveData = null;
    return {
        saveState : function(data)
        {
            saveData = data;
        },
        getState : function()
        {
            return saveData;
        },
        list: function(callback) {
            $http.get('/api/project/'+Project.getUrl()+'/classifications')
                .success(callback)
                .error(notify.serverError);
        },
        getDetails: function(classificationId, callback) {
            $http.get('/api/project/' + Project.getUrl() + '/classification/' + classificationId)
                .success(callback)
                .error(notify.serverError);
        },
        getResultDetails: function(classificationId, first, limit, callback) {
            $http.get('/api/project/'+ Project.getUrl() +'/classification/'+classificationId+'/more/'+ first + '/' + limit)
                .success(callback)
                .error(notify.serverError);
        },
        getRecVector: function(classificationId, recId, callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/classification/'+classificationId+'/vector/'+recId);
        },
        create: function(classificationData, callback) {
            $http.post('/api/project/'+Project.getUrl()+'/classification/new', classificationData)
                .success(callback)
                .error(notify.serverError);
        },
        delete: function(classificationId) {
            $http.get('/api/project/' + Project.getUrl() + '/classification/' + classificationId + '/delete')
                .success(callback)
                .error(notify.serverError);
        },
    };
})
;
