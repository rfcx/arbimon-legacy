angular.module('a2.srv.audio-event-detections-clustering', [
    'a2.srv.project',
    'humane'
])
.factory('a2AudioEventDetectionsClustering', function($http, Project, notify) {

    return {
        list: function(rec_id, callback) {
            var config = {
                params: {}
            };
            if (rec_id) {
                config.params.rec_id = rec_id;
            }
            return $http.get('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering', config).then(function(response){
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
