angular.module('a2.srv.clustering-jobs', [
    'a2.srv.project',
    'humane'
])
.factory('a2ClusteringJobs', function($http, Project, notify) {

    return {
        list: function(callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/clustering-jobs').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        getJobDetails: function(clusteringJobId) {
            return $http.get('/api/project/' + Project.getUrl() + '/clustering-jobs/' + clusteringJobId + '/job-details').then(function(response){
                return response.data;
            });
        },
        getClusteringDetails: function(jobId) {
            return $http.get('/api/project/' + Project.getUrl() + '/clustering-jobs/' + jobId + '/clustering-details').then(function(response){
                return response.data;
            });
        },
        audioEventDetections: function(callback) {
            return $http.get('/api/project/'+Project.getUrl()+'/clustering-jobs/audio-event-detections').then(function(response){
                return response.data;
            }).catch(notify.serverError);
        },
        create: function(data) {
            return $http.post('/api/project/'+Project.getUrl()+'/clustering-jobs/new', data).then(function(response){
                return response.data;
            });
        },
    };
})
;
