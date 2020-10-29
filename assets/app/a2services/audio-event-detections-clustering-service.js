angular.module('a2.srv.audio-event-detections-clustering', [
    'a2.srv.project',
    'humane'
])
.factory('a2AudioEventDetectionsClustering', function($http, Project, notify) {

    return {
        list: function(callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering/new', data).then(function(response){
                return response.data;
            });
        },
    };
})
;
