angular.module('a2.srv.audio-event-detections-clustering', [
    'a2.srv.project',
    'humane'
])
.factory('a2AudioEventDetectionsClustering', function($http, Project, notify) {

    return {
        list: function(opts, callback) {
            const config = {
                params: opts
            };
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/audio-event-detections-clustering', config).then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        count: function() {
            return $http.get('/legacy-api/project/'+Project.getUrl()+'/audio-event-detections-clustering/total-recordings').then(function(response){
                return response.data;
            });
        },
        create: function(data) {
            return $http.post('/legacy-api/project/'+Project.getUrl()+'/audio-event-detections-clustering/new', data).then(function(response){
                return response.data;
            });
        },
        validate: function(opts) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/validate', opts)
                .then(function(response){
                    return response.data;
                });
        },
        unvalidate: function(opts) {
          return $http.post('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/unvalidate', opts)
              .then(function(response){
                  return response.data;
              });
        },
        delete: function(jobId) {
            return $http.post('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/' + jobId + '/remove').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        }
    };
})
;
