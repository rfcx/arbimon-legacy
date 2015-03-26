angular.module('a2-classi-service', [
    'a2-project-service',
    'humane'
])
.factory('a2Classi', function($http, Project, notify) {
    var serverError = function() {
        notify.error('Error Communicating With Server');
    };
    
    return {
        list: function(callback) {
            $http.get('/api/project/'+Project.getUrl()+'/classifications')
                .success(callback)
                .error(serverError);
        },
        getDetails: function(classificationId, callback) {
            $http.get('/api/project/' + Project.getUrl() + '/classification/' + classificationId)
                .success(callback)
                .error(serverError);
        },
        getResultDetails: function(classificationId, first, limit, callback) {
            $http.get('/api/project/'+ Project.getUrl() +'/classification/'+classificationId+'/more/'+ first + '/' + limit)
                .success(callback)
                .error(serverError);
        },
        getRecVector: function(vectorUri, callback) {
            $http.post('/api/project/'+Project.getUrl()+'/classification/vector', { v: vectorUri })
                .success(callback)
                .error(serverError);
        },
        create: function(classificationData, callback) {
            $http.post('/api/project/'+Project.getUrl()+'/classification/new', classificationData)
                .success(callback)
                .error(serverError);
        },
        delete: function(classificationId) {
            $http.get('/api/project/' + Project.getUrl() + '/classification/' + classificationId + '/delete')
                .success(callback)
                .error(serverError);
        },
    };
})
;
