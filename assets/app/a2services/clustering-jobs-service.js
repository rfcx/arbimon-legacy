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
            }).catch(notify.serverError);
        },
        getClusteringDetails: function(jobId) {
            return $http.get('/api/project/' + Project.getUrl() + '/clustering-jobs/' + jobId + '/clustering-details').then(function(response){
                return response.data;
            });
        },
        getRoisDetails: function(opts) {
            var config = {
                params: {}
            };
            if (opts.aed) {
                config.params.aed = opts.aed;
            }
            if (opts.search && opts.search == 'by_site')  {
                config.params.perSiteCount = true;
            }
            else if (opts.search && opts.search == 'by_date') {
                config.params.perDateCount = true;
            }
            else config.params.all = true;

            return $http.get('/api/project/' + Project.getUrl() + '/clustering-jobs/' + opts.jobId + '/rois-details', config).then(function(response){
                return response.data;
            });
        },
        getAudioUrlFor: function(recId) {
            return '/api/project/' + Project.getUrl() + '/clustering-jobs/' + recId + '/audio';
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
