angular.module('a2.srv.audio-event-detections-clustering', [
    'a2.srv.project',
    'humane'
])
.factory('a2AudioEventDetectionsClustering', function($http, Project, notify) {

    return {
        list: function(opts, callback) {
            var config = {
                params: {}
            };
            if (opts.rec_id) {
                config.params.rec_id = opts.rec_id;
            }
            return $http.get('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering', config).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getClusteredRecords: function(opts, callback) {
            var config = {
                params: {}
            };
            if (opts.aed_id) {
                config.params.aed_id = opts.aed_id;
            }
            if (opts.aed_id_in) {
                config.params.aed_id_in = opts.aed_id_in;
            }
            return $http.get('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering/records', config).then(function(response){
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
