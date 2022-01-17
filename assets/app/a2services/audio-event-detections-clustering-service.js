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
            if (opts && opts.rec_id) {
                config.params.rec_id = opts.rec_id;
            }
            if (opts && opts.playlist) {
                config.params.playlist = opts.playlist;
            }
            if (opts && opts.user) {
                config.params.user = opts.user;
            }
            if (opts && opts.dataExtended) {
                config.params.dataExtended = opts.dataExtended;
            }
            return $http.get('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering', config).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        searchClusteredDetections: function(opts, callback) {
            var params = {};

            if (opts.aed_id) {
                params.aed_id = opts.aed_id;
            }
            if (opts.aed_id_in) {
                params.aed_id_in = opts.aed_id_in;
            }
            return $http.post('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering/records', params).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/audio-event-detections-clustering/new', data).then(function(response){
                return response.data;
            });
        },
        validate: function(opts) {
            return $http.post('/api/project/' + Project.getUrl() + '/audio-event-detections-clustering/validate', {
                aed: opts.aed,
                validation: opts.validation
            }).then(function(response){
                return response.data;
            });
        },
    };
})
;
